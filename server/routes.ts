import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import 'dotenv/config';
import { db, dbReady, getNextVoucherNumber } from './db.js';
import { createDatabaseBackup, getBackupPath, listDatabaseBackups } from './backup.js';

export const router = express.Router();

void dbReady.catch((error) => {
  console.error('Error inicializando la base de datos:', error);
});

const SESSION_COOKIE = 'ccp_session';
const IDLE_MS = 20 * 60 * 1000;
const SESSION_MS = 8 * 60 * 60 * 1000;
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET es obligatorio en producción.');
}
const CHALLENGE_SECRET = process.env.SESSION_SECRET || 'ccp-local-challenge-key';

const rateBuckets = new Map<string, number[]>();

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'local';
}

function allowRate(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (rateBuckets.get(key) || []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    rateBuckets.set(key, recent);
    return false;
  }
  recent.push(now);
  rateBuckets.set(key, recent);
  return true;
}

function rateLimit(scope: string, limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!allowRate(`${scope}:${clientIp(req)}`, limit, windowMs)) {
      return res.status(429).json({
        error: 'Demasiados intentos. Espere un momento antes de volver a intentar.'
      });
    }
    next();
  };
}

function readCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie || '';
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) continue;
    cookies[rawKey] = decodeURIComponent(rest.join('='));
  }
  return cookies;
}

function sessionCookie(token: string, maxAge: number): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAge}`
  ].join('; ');
}

function sqliteTime(value: string | null | undefined): number {
  if (!value) return Date.now();
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = Date.parse(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

async function writeAudit(action: string, entity: string, entityId: string | number | null, detail: string, role?: string) {
  await db.prepare(
    'INSERT INTO audit_log (action, entity, entity_id, detail, user_role) VALUES (?, ?, ?, ?, ?)'
  ).run(action, entity, entityId == null ? null : String(entityId), detail, role || null);
}

function hashPassword(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

function normalizeRecoveryTarget(raw: string): string {
  const value = raw.trim();
  return value.includes('@') ? value.toLowerCase() : value.replace(/\D/g, '');
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// -------------------------------------------------------------
// Auth Middleware & Helpers
// -------------------------------------------------------------
export interface AuthUser {
  userId: number;
  username: string;
  role: 'dueno' | 'empleado';
  displayName: string;
  tenantId: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const cookies = readCookies(req);
  const cookieToken = cookies[SESSION_COOKIE];
  const authHeader = req.headers.authorization;
  const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const token = cookieToken || bearer;
  if (!token) return next();

  const session = await db.prepare(`
    SELECT s.token, s.user_id as userId, s.role, s.username, s.display_name as displayName,
           s.expires_at as expiresAt, s.last_seen_at as lastSeenAt,
           COALESCE(u.tenant_id, 1) as tenantId
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP
  `).get(token) as (AuthUser & { token: string; expiresAt: string; lastSeenAt: string | null }) | undefined;

  if (!session) return next();

  const idleFor = Date.now() - sqliteTime(session.lastSeenAt || session.expiresAt);
  if (session.lastSeenAt && idleFor > IDLE_MS) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    return next();
  }

  await db.prepare('UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token = ?').run(token);
  req.user = {
    userId: session.userId,
    username: session.username,
    role: session.role as 'dueno' | 'empleado',
    displayName: session.displayName,
    tenantId: Number(session.tenantId) || 1
  };
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Sesión no iniciada o expirada. Por favor inicie sesión.' });
  }
  next();
}

export function requireRole(allowedRoles: ('dueno' | 'empleado')[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado. Inicie sesión.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Acceso restringido. Esta función requiere perfil de ${allowedRoles.join(' o ')}.`
      });
    }
    next();
  };
}

// -------------------------------------------------------------
// 1. Authentication Routes (Roles: Empleado vs Dueño)
// -------------------------------------------------------------
function challengeHash(id: string, answer: string): string {
  return crypto.createHmac('sha256', CHALLENGE_SECRET).update(`${id}:${answer}`).digest('hex');
}

router.get('/auth/challenge', async (_req: Request, res: Response) => {
  const left = 2 + crypto.randomInt(8);
  const right = 1 + crypto.randomInt(8);
  const id = crypto.randomBytes(16).toString('hex');
  const answer = String(left + right);
  await db.prepare('DELETE FROM login_challenges WHERE created_at < ?').run(Date.now() - 10 * 60 * 1000);
  await db.prepare(
    'INSERT INTO login_challenges (id, answer_hash, created_at, used) VALUES (?, ?, ?, 0)'
  ).run(id, challengeHash(id, answer), Date.now());

  res.json({
    id,
    prompt: `¿Cuánto es ${left} + ${right}?`,
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null
  });
});

async function assertHuman(req: Request): Promise<string | null> {
  const company = typeof req.body?.company === 'string' ? req.body.company.trim() : '';
  if (company) return 'No se pudo validar la solicitud.';

  const turnstileSecret = process.env.TURNSTILE_SECRET;
  if (turnstileSecret) {
    const token = String(req.body?.turnstileToken || '');
    if (!token) return 'Complete la verificación de seguridad para continuar.';
    const params = new URLSearchParams();
    params.set('secret', turnstileSecret);
    params.set('response', token);
    params.set('remoteip', clientIp(req));
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: params
    });
    const data = await response.json().catch(() => ({ success: false })) as { success?: boolean };
    if (!data.success) return 'La verificación anti-bots no fue válida. Intente de nuevo.';
    return null;
  }

  const challengeId = String(req.body?.challengeId || '');
  const challengeAnswer = String(req.body?.challengeAnswer || '').trim();
  if (challengeId) {
    const row = await db.prepare(
      'SELECT id, answer_hash, created_at, used FROM login_challenges WHERE id = ?'
    ).get(challengeId) as { id: string; answer_hash: string; created_at: number; used: number } | undefined;

    if (!row || row.used) return 'La verificación expiró. Recargue e intente de nuevo.';
    const age = Date.now() - row.created_at;
    if (age < 500 || age > 10 * 60 * 1000) {
      return 'La verificación no es válida. Espere un momento y vuelva a intentar.';
    }
    const expected = challengeHash(row.id, challengeAnswer);
    const valid = expected.length === row.answer_hash.length
      && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(row.answer_hash));
    await db.prepare('UPDATE login_challenges SET used = 1 WHERE id = ?').run(row.id);
    if (!valid) return 'La respuesta de verificación es incorrecta.';
  }

  return null;
}

router.post('/auth/login', rateLimit('login', 8, 15 * 60 * 1000), async (req: Request, res: Response) => {
  const humanError = await assertHuman(req);
  if (humanError) {
    return res.status(400).json({ error: humanError });
  }

  const { role, pin, username, password } = req.body;

  let user: any = null;
  if (role && pin) {
    const matches = await db.prepare(
      "SELECT * FROM users WHERE role = ? AND pin = ? AND COALESCE(active, 1) = 1"
    ).all(role, String(pin)) as any[];
    if (matches.length === 1) {
      user = matches[0];
    } else if (matches.length > 1) {
      const requestedUsername = String(username || '').trim().toLowerCase();
      if (requestedUsername) {
        user = matches.find((match) =>
          String(match.username).toLowerCase() === requestedUsername ||
          String(match.username).toLowerCase() === `${requestedUsername}_empleado`
        ) || null;
      }
      if (!user) {
        return res.status(409).json({
          error: 'Este PIN pertenece a varios negocios. Indique el usuario del negocio para continuar.'
        });
      }
    }
  } else if (pin) {
    user = await db.prepare('SELECT * FROM users WHERE pin = ? AND COALESCE(active, 1) = 1').get(String(pin));
  } else if (username && password) {
    const pwHash = hashPassword(String(password));
    user = await db.prepare('SELECT * FROM users WHERE username = ? AND COALESCE(active, 1) = 1').get(username);
    if (user && user.password_hash !== pwHash && user.password_hash !== String(password)) {
      // Also allow plain-text comparison for legacy records not yet hashed
      user = null;
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'PIN o credenciales incorrectas. Verifique e intente nuevamente.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();

  await db.prepare(`
    INSERT INTO sessions (token, user_id, role, username, display_name, expires_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(token, user.id, user.role, user.username, user.display_name, expiresAt);

  res.setHeader('Set-Cookie', sessionCookie(token, Math.floor(SESSION_MS / 1000)));
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name,
      tenantId: user.tenant_id || 1
    }
  });
});

// POST /auth/otp/send — Generar y enviar código de verificación (Correo o Teléfono)
router.post('/auth/otp/send', rateLimit('otp_send', 10, 15 * 60 * 1000), async (req: Request, res: Response) => {
  const rawTarget = String(req.body?.target || '').trim();
  if (!rawTarget || rawTarget.length < 4) {
    return res.status(400).json({ error: 'Ingrese un correo electrónico válido o número de teléfono.' });
  }

  const cleanTarget = normalizeRecoveryTarget(rawTarget);
  const digitsOnly = rawTarget.replace(/\D/g, '');

  const demoOtp = process.env.NODE_ENV !== 'production' && process.env.DEMO_OTP === 'true';
  if (!demoOtp) {
    return res.status(503).json({
      error: 'La recuperación por correo o teléfono no está configurada en este servidor.'
    });
  }

  // Buscar usuario por email o teléfono
  const user = await db.prepare(`
    SELECT id, username, role, display_name, tenant_id, email, phone
    FROM users
    WHERE LOWER(COALESCE(email, '')) = ?
       OR REPLACE(REPLACE(COALESCE(phone, ''), '-', ''), ' ', '') = ?
       OR phone = ?
    LIMIT 1
  `).get(cleanTarget, digitsOnly, rawTarget) as any;

  if (!user) {
    return res.status(404).json({
      error: 'No encontramos ninguna cuenta asociada al correo o teléfono ingresado. Verifique los datos o consulte al Administrador.'
    });
  }

  // Generar código numérico de 6 dígitos
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutos de validez


  await db.prepare(`
    INSERT INTO otp_codes (target, code, user_id, expires_at, used, tenant_id)
    VALUES (?, ?, ?, ?, 0, ?)
  `).run(cleanTarget, code, user.id, expiresAt, user.tenant_id || 1);

  await writeAudit('send-otp', 'users', user.id, `Código OTP generado para ${user.display_name}`, user.role);

  // Retornamos el código para facilitar el acceso rápido sin requerir gateway externo de pago
  res.json({
    success: true,
    message: `Código de verificación de 6 dígitos generado con éxito para ${user.display_name}.`,
    target: rawTarget,
    ...(demoOtp ? { code } : {})
  });
});

// POST /auth/otp/verify — Iniciar sesión directamente con código OTP (Passwordless)
router.post('/auth/otp/verify', rateLimit('otp_verify', 10, 15 * 60 * 1000), async (req: Request, res: Response) => {
  const rawTarget = normalizeRecoveryTarget(String(req.body?.target || '').trim());
  const code = String(req.body?.code || '').trim();

  if (!rawTarget || !code) {
    return res.status(400).json({ error: 'Indique el correo/teléfono y el código de verificación.' });
  }

  const now = Date.now();
  const otp = await db.prepare(`
    SELECT * FROM otp_codes
    WHERE (LOWER(target) = ? OR target = ?) AND code = ? AND used = 0 AND expires_at > ?
    ORDER BY id DESC
    LIMIT 1
  `).get(rawTarget, rawTarget.replace(/\D/g, ''), code, now) as any;

  if (!otp) {
    return res.status(400).json({ error: 'Código de verificación inválido o expirado. Solicite uno nuevo.' });
  }

  // Marcar código como usado
  await db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(otp.id);

  // Obtener usuario
  const user = await db.prepare('SELECT * FROM users WHERE id = ? AND COALESCE(active, 1) = 1').get(otp.user_id) as any;
  if (!user) {
    return res.status(404).json({ error: 'La cuenta de usuario no está activa o no existe.' });
  }

  // Generar sesión segura
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAtIso = new Date(Date.now() + SESSION_MS).toISOString();

  await db.prepare(`
    INSERT INTO sessions (token, user_id, role, username, display_name, expires_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(token, user.id, user.role, user.username, user.display_name, expiresAtIso);

  await writeAudit('otp-login', 'users', user.id, `Inicio de sesión sin contraseña (OTP) de ${user.display_name}`, user.role);

  res.setHeader('Set-Cookie', sessionCookie(token, Math.floor(SESSION_MS / 1000)));
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name,
      tenantId: user.tenant_id || 1
    }
  });
});

// POST /auth/recover-account — Recuperar cuenta y restablecer clave mediante código OTP
router.post('/auth/recover-account', rateLimit('recover', 6, 15 * 60 * 1000), async (req: Request, res: Response) => {
  const rawTarget = normalizeRecoveryTarget(String(req.body?.target || '').trim());
  const code = String(req.body?.code || '').trim();
  const newPassword = String(req.body?.newPassword || '').trim();

  if (!rawTarget || !code) {
    return res.status(400).json({ error: 'Indique su correo/teléfono y el código recibido.' });
  }

  if (!/^\d{4,6}$/.test(newPassword)) {
    return res.status(400).json({ error: 'El nuevo PIN debe contener entre 4 y 6 dígitos.' });
  }

  const now = Date.now();
  const otp = await db.prepare(`
    SELECT * FROM otp_codes
    WHERE (LOWER(target) = ? OR target = ?) AND code = ? AND used = 0 AND expires_at > ?
    ORDER BY id DESC
    LIMIT 1
  `).get(rawTarget, rawTarget.replace(/\D/g, ''), code, now) as any;

  if (!otp) {
    return res.status(400).json({ error: 'Código de verificación inválido o expirado. Solicite uno nuevo.' });
  }

  // Marcar como usado
  await db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(otp.id);

  // Actualizar credenciales del usuario
  const pwHash = hashPassword(newPassword);
  await db.prepare('UPDATE users SET pin = ?, password_hash = ? WHERE id = ?').run(newPassword, pwHash, otp.user_id);

  await writeAudit('recover-account', 'users', otp.user_id, 'Restablecimiento de clave mediante verificación OTP', 'dueno');

  res.json({
    success: true,
    message: 'Contraseña y PIN restablecidos exitosamente. Ahora puede iniciar sesión con su nueva clave.'
  });
});

// POST /auth/register — Register a new business (new tenant)
router.post('/auth/register', rateLimit('register', 3, 15 * 60 * 1000), async (req: Request, res: Response) => {
  // Honeypot
  const company = typeof req.body?.company === 'string' ? req.body.company.trim() : '';
  if (company) return res.status(400).json({ error: 'No se pudo validar la solicitud.' });

  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '').trim();
  const pin = String(req.body?.pin || '').trim();
  const businessName = String(req.body?.businessName || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase() || null;
  const phone = String(req.body?.phone || '').trim().replace(/\D/g, '') || null;

  // Validate username: at least 4 chars, alphanumeric + underscore only
  if (!/^[a-zA-Z0-9_]{4,}$/.test(username)) {
    return res.status(400).json({
      error: 'El nombre de usuario debe tener al menos 4 caracteres (solo letras, números y guión bajo).'
    });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }
  if (!/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({ error: 'El PIN debe contener entre 4 y 6 dígitos.' });
  }
  if (businessName.length < 2) {
    return res.status(400).json({ error: 'Indique el nombre del negocio (mínimo 2 caracteres).' });
  }
  if (!email && !phone) {
    return res.status(400).json({ error: 'Indique un correo electrónico o teléfono para recuperación.' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'El correo electrónico de recuperación no es válido.' });
  }
  if (phone && phone.length < 8) {
    return res.status(400).json({ error: 'El teléfono de recuperación debe tener al menos 8 dígitos.' });
  }

  // Check username uniqueness
  const existing = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso. Elija otro.' });
  }
  if (email) {
    const existingEmail = await db.prepare('SELECT id FROM users WHERE LOWER(COALESCE(email, \'\')) = ?').get(email);
    if (existingEmail) {
      return res.status(409).json({ error: 'Ese correo electrónico ya está asociado a otra cuenta.' });
    }
  }
  if (phone) {
    const existingPhone = await db.prepare(
      "SELECT id FROM users WHERE REPLACE(REPLACE(COALESCE(phone, ''), '-', ''), ' ', '') = ?"
    ).get(phone);
    if (existingPhone) {
      return res.status(409).json({ error: 'Ese teléfono ya está asociado a otra cuenta.' });
    }
  }

  // Generate new tenant_id = max(tenant_id) + 1
  const maxTenant = await db.prepare('SELECT COALESCE(MAX(tenant_id), 0) as mx FROM users').get() as { mx: number };
  const newTenantId = maxTenant.mx + 1;

  const pwHash = hashPassword(password);
  const empPwHash = hashPassword('empleado123');

  // Create owner user with email and phone for recovery
  const ownerResult = await db.prepare(`
    INSERT INTO users (username, password_hash, pin, role, display_name, tenant_id, email, phone)
    VALUES (?, ?, ?, 'dueno', ?, ?, ?, ?)
  `).run(username, pwHash, pin, `${businessName} (Dueño)`, newTenantId, email, phone);

  const ownerId = Number(ownerResult.lastInsertRowid);

  // Create default employee for new tenant
  const empUsername = `${username}_empleado`;
  await db.prepare(`
    INSERT INTO users (username, password_hash, pin, role, display_name, tenant_id)
    VALUES (?, ?, ?, 'empleado', ?, ?)
  `).run(empUsername, empPwHash, '0000', `${businessName} (Cajero)`, newTenantId);

  // Create session for the new owner
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
  await db.prepare(`
    INSERT INTO sessions (token, user_id, role, username, display_name, expires_at, last_seen_at)
    VALUES (?, ?, 'dueno', ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(token, ownerId, username, `${businessName} (Dueño)`, expiresAt);

  await writeAudit('register-tenant', 'users', ownerId, `Nuevo negocio: ${businessName} (tenant ${newTenantId})`, 'dueno');

  res.setHeader('Set-Cookie', sessionCookie(token, Math.floor(SESSION_MS / 1000)));
  res.status(201).json({
    success: true,
    token,
    tenantId: newTenantId,
    user: {
      id: ownerId,
      username,
      role: 'dueno',
      displayName: `${businessName} (Dueño)`,
      tenantId: newTenantId
    }
  });
});

// GET /auth/users — List users belonging to the same tenant (dueno only)
router.get('/auth/users', requireAuth, requireRole(['dueno']), async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const users = await db.prepare(
    'SELECT id, username, role, display_name, COALESCE(active, 1) as active FROM users WHERE COALESCE(tenant_id, 1) = ?'
  ).all(tenantId) as any[];
  res.json(users.map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    displayName: u.display_name,
    active: u.active === 1
  })));
});

// POST /auth/users — Add a new employee to the same tenant (dueno only)
router.post('/auth/users', requireAuth, requireRole(['dueno']), async (req: Request, res: Response) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '').trim();
  const displayName = String(req.body?.displayName || '').trim();
  const pin = String(req.body?.pin || '0000').trim();

  if (!/^[a-zA-Z0-9_]{4,}$/.test(username)) {
    return res.status(400).json({
      error: 'El nombre de usuario debe tener al menos 4 caracteres (solo letras, números y guión bajo).'
    });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres.' });
  }

  const existing = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso.' });
  }

  const tenantId = req.user!.tenantId;
  const pwHash = hashPassword(password);
  const result = await db.prepare(`
    INSERT INTO users (username, password_hash, pin, role, display_name, tenant_id)
    VALUES (?, ?, ?, 'empleado', ?, ?)
  `).run(username, pwHash, pin, displayName || `${username} (Empleado)`, tenantId);

  await writeAudit('add-user', 'users', Number(result.lastInsertRowid), `Nuevo empleado: ${username}`, req.user?.role);
  res.status(201).json({ success: true, id: Number(result.lastInsertRowid) });
});

router.get('/auth/me', async (req: Request, res: Response) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  res.json({ user: req.user });
});

router.post('/auth/logout', async (req: Request, res: Response) => {
  const cookies = readCookies(req);
  const authHeader = req.headers.authorization;
  const token = cookies[SESSION_COOKIE]
    || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');
  if (token) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.json({ success: true });
});

router.get('/auth/profiles', async (req: Request, res: Response) => {
  // Only return profiles belonging to the same tenant (or tenant 1 for unauthenticated)
  const tenantId = req.user?.tenantId ?? 1;
  const users = await db.prepare(
    'SELECT id, username, role, display_name FROM users WHERE COALESCE(active, 1) = 1 AND COALESCE(tenant_id, 1) = ?'
  ).all(tenantId) as any[];
  res.json(users.map((user) => ({
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.display_name
  })));
});

router.post('/auth/reset-password', requireAuth, requireRole(['dueno']), async (req: Request, res: Response) => {
  const userId = Number(req.body?.userId);
  const newPassword = String(req.body?.newPassword || '').trim();
  if (!userId || newPassword.length < 4) {
    return res.status(400).json({ error: 'Indique el usuario y una contraseña de al menos 4 caracteres.' });
  }

  // Verify target belongs to same tenant
  const target = await db.prepare(
    'SELECT id, role, display_name, COALESCE(tenant_id, 1) as tenant_id FROM users WHERE id = ?'
  ).get(userId) as any;
  if (!target) {
    return res.status(404).json({ error: 'El usuario indicado no existe.' });
  }
  if (Number(target.tenant_id) !== req.user!.tenantId) {
    return res.status(404).json({ error: 'El usuario indicado no existe.' });
  }

  const pwHash = hashPassword(newPassword);
  await db.prepare('UPDATE users SET pin = ?, password_hash = ? WHERE id = ?').run(newPassword, pwHash, userId);
  await writeAudit('reset-password', 'users', userId, `Restablecida la clave de ${target.display_name}`, req.user?.role);
  res.json({ success: true, message: `Contraseña de ${target.display_name} restablecida.` });
});

router.post('/auth/change-password', requireAuth, requireRole(['dueno']), rateLimit('password', 8, 15 * 60 * 1000), async (req: Request, res: Response) => {
  const humanError = await assertHuman(req);
  if (humanError) {
    return res.status(400).json({ error: humanError });
  }

  const { targetRole, oldPassword, newPassword } = req.body;

  // 1. Validar campos obligatorios
  if (!targetRole || !['dueno', 'empleado'].includes(targetRole)) {
    return res.status(400).json({ error: 'Debe especificar el rol a modificar (Dueño / Jefe o Empleado / Cajero).' });
  }

  if (!oldPassword || typeof oldPassword !== 'string' || oldPassword.trim().length === 0) {
    return res.status(400).json({ error: 'Es obligatorio ingresar la contraseña actual (antigua) para autorizar el cambio.' });
  }

  if (!newPassword || typeof newPassword !== 'string' || !/^\d{4,6}$/.test(newPassword.trim())) {
    return res.status(400).json({ error: 'El nuevo PIN debe contener entre 4 y 6 dígitos.' });
  }

  const cleanOld = oldPassword.trim();
  const cleanNew = newPassword.trim();

  // 2. Obtener usuarios de la base de datos
  const tenantId = req.user!.tenantId;
  const targetUser = await db.prepare(
    'SELECT * FROM users WHERE role = ? AND COALESCE(tenant_id, 1) = ?'
  ).get(targetRole, tenantId) as any;
  const duenoUser = await db.prepare(
    "SELECT * FROM users WHERE role = 'dueno' AND COALESCE(tenant_id, 1) = ?"
  ).get(tenantId) as any;

  if (!targetUser) {
    return res.status(404).json({ error: 'El usuario especificado no existe.' });
  }

  // 3. Verificar autorización con contraseña antigua
  const oldHash = hashPassword(cleanOld);
  const matchesTarget = (targetUser.pin === cleanOld || targetUser.password_hash === cleanOld || targetUser.password_hash === oldHash);
  const matchesDueno = duenoUser && (duenoUser.pin === cleanOld || duenoUser.password_hash === cleanOld || duenoUser.password_hash === oldHash);

  if (!matchesTarget && !matchesDueno) {
    return res.status(401).json({ error: 'La contraseña actual (antigua) ingresada es incorrecta. No se autorizó el cambio.' });
  }

  // 4. Actualizar la contraseña y PIN del usuario objetivo
  const newHash = hashPassword(cleanNew);
  await db.prepare(`
    UPDATE users 
    SET pin = ?, password_hash = ?
    WHERE role = ? AND COALESCE(tenant_id, 1) = ?
  `).run(cleanNew, newHash, targetRole, tenantId);

  res.json({
    success: true,
    message: `Contraseña del perfil ${targetRole === 'dueno' ? 'Dueño / Jefe' : 'Empleado / Cajero'} actualizada correctamente.`
  });
});

// -------------------------------------------------------------
// 2. Secure Database Backups
// -------------------------------------------------------------
router.get('/admin/backups', requireAuth, requireRole(['dueno']), async (_req: Request, res: Response) => {
  res.json(await listDatabaseBackups());
});

router.post('/admin/backups', requireAuth, requireRole(['dueno']), async (_req: Request, res: Response) => {
  try {
    const filePath = await createDatabaseBackup();
    await writeAudit('create-backup', 'database', null, 'Respaldo de base de datos creado manualmente', 'dueno');
    res.json({ success: true, name: filePath.split(/[\\\\/]/).pop(), created: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'No se pudo crear el respaldo.' });
  }
});

router.get('/admin/backups/:name', requireAuth, requireRole(['dueno']), async (req: Request, res: Response) => {
  const filePath = await getBackupPath(req.params.name);
  if (!filePath) return res.status(404).json({ error: 'Respaldo no encontrado.' });
  res.download(filePath, req.params.name);
});

router.get('/admin/audit', requireAuth, requireRole(['dueno']), async (req: Request, res: Response) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const rows = await db.prepare(`
    SELECT id, action, entity, entity_id, detail, user_role, created_at
    FROM audit_log
    ORDER BY id DESC
    LIMIT ?
  `).all(limit) as any[];
  res.json(rows);
});

// -------------------------------------------------------------
// 3. Active Dates (Gestión dinámica de fechas: añadir y quitar)
// -------------------------------------------------------------
router.get('/dates', requireAuth, async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId ?? 1;
  const rows = await db.prepare(
    'SELECT date FROM active_dates WHERE COALESCE(tenant_id, 1) = ? ORDER BY date DESC'
  ).all(tenantId) as { date: string }[];
  res.json(rows.map(r => r.date));
});

router.post('/dates', requireAuth, async (req: Request, res: Response) => {
  const { date } = req.body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Formato de fecha inválido (debe ser AAAA-MM-DD).' });
  }
  const tenantId = req.user?.tenantId ?? 1;
  try {
    await db.prepare('INSERT OR IGNORE INTO active_dates (date, tenant_id) VALUES (?, ?)').run(date, tenantId);
    res.json({ success: true, date });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/dates/:date', requireAuth, async (req: Request, res: Response) => {
  const { date } = req.params;
  const userRole = req.user?.role;
  const tenantId = req.user!.tenantId;

  // Check if date has movements for this tenant
  const countRow = await db.prepare(
    'SELECT COUNT(*) as count FROM movements WHERE date = ? AND COALESCE(tenant_id, 1) = ?'
  ).get(date, tenantId) as { count: number };
  if (countRow.count > 0 && userRole !== 'dueno') {
    return res.status(403).json({
      error: 'Solo el Dueño puede eliminar una fecha que contiene movimientos registrados.'
    });
  }

  if (userRole === 'dueno') {
    const linked = await db.prepare(
      'SELECT * FROM movements WHERE date = ? AND COALESCE(voided, 0) = 0 AND COALESCE(tenant_id, 1) = ?'
    ).all(date, tenantId) as any[];
    try {
      await db.exec('BEGIN');
      for (const mov of linked) await voidMovementRecord(mov, userRole);
      await db.exec('COMMIT');
    } catch (err: any) {
      try { await db.exec('ROLLBACK'); } catch { /* transacción ya cerrada */ }
      const status = err instanceof CashError ? err.status : 500;
      return res.status(status).json({ error: err.message || 'No se pudieron anular los movimientos de la fecha.' });
    }
  }

  await db.prepare('DELETE FROM active_dates WHERE date = ? AND COALESCE(tenant_id, 1) = ?').run(date, tenantId);
  res.json({ success: true, message: `Fecha ${date} eliminada.` });
});

// -------------------------------------------------------------
// 2b. Cajas (alta y archivo; no se borran para conservar el historial)
// -------------------------------------------------------------
function mapRegister(row: any, includeBalance: boolean) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    active: row.active === 1,
    balance: includeBalance ? Math.round(Number(row.balance) * 100) / 100 : undefined,
    createdAt: row.created_at
  };
}

router.get('/registers', requireAuth, async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const rows = await db.prepare(
    'SELECT * FROM cash_registers WHERE COALESCE(tenant_id, 1) = ? ORDER BY active DESC, id ASC'
  ).all(tenantId) as any[];
  const includeBalance = req.user?.role === 'dueno';
  res.json(rows.map((row) => mapRegister(row, includeBalance)));
});

// GET /registers/:id/balance — returns current balance of a specific register (dueno only)
router.get('/registers/:id/balance', requireAuth, requireRole(['dueno']), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const tenantId = req.user!.tenantId;
  const register = await db.prepare(
    'SELECT * FROM cash_registers WHERE id = ? AND COALESCE(tenant_id, 1) = ?'
  ).get(id, tenantId) as any;
  if (!register) {
    return res.status(404).json({ error: 'Caja no encontrada.' });
  }
  res.json({
    id: register.id,
    name: register.name,
    kind: register.kind,
    balance: Math.round(Number(register.balance) * 100) / 100,
    active: register.active === 1
  });
});

router.post('/registers', requireAuth, requireRole(['dueno']), async (req: Request, res: Response) => {
  const name = String(req.body?.name || '').trim();
  const kind = req.body?.kind === 'chica' ? 'chica' : 'operativa';
  const opening = Math.round((Number(req.body?.openingBalance) || 0) * 100) / 100;
  if (name.length < 2) {
    return res.status(400).json({ error: 'Indique un nombre de caja de al menos 2 caracteres.' });
  }
  if (opening < 0) {
    return res.status(400).json({ error: 'El saldo inicial no puede ser negativo.' });
  }
  const tenantId = req.user!.tenantId;
  const result = await db.prepare(
    'INSERT INTO cash_registers (name, kind, balance, active, tenant_id) VALUES (?, ?, ?, 1, ?)'
  ).run(name, kind, opening, tenantId);
  await writeAudit('create-register', 'cash_registers', Number(result.lastInsertRowid), name, req.user?.role);
  res.json({ success: true, id: Number(result.lastInsertRowid) });
});

router.patch('/registers/:id', requireAuth, requireRole(['dueno']), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const tenantId = req.user!.tenantId;
  const register = await db.prepare(
    'SELECT * FROM cash_registers WHERE id = ? AND COALESCE(tenant_id, 1) = ?'
  ).get(id, tenantId) as any;
  if (!register) {
    return res.status(404).json({ error: 'Caja no encontrada.' });
  }
  const active = req.body?.active === false || req.body?.active === 0 ? 0 : 1;
  if (active === 0) {
    const remaining = await db.prepare(
      'SELECT COUNT(*) as count FROM cash_registers WHERE kind = ? AND active = 1 AND id != ? AND COALESCE(tenant_id, 1) = ?'
    ).get(register.kind, id, tenantId) as { count: number };
    if (remaining.count === 0) {
      return res.status(400).json({
        error: 'Debe permanecer al menos una caja activa de este tipo para seguir operando.'
      });
    }
  }
  await db.prepare('UPDATE cash_registers SET active = ? WHERE id = ?').run(active, id);
  await writeAudit(active ? 'activate-register' : 'archive-register', 'cash_registers', id, register.name, req.user?.role);
  res.json({ success: true, active: active === 1 });
});

router.delete('/registers/:id', requireAuth, requireRole(['dueno']), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const tenantId = req.user!.tenantId;
  const register = await db.prepare(
    'SELECT * FROM cash_registers WHERE id = ? AND COALESCE(tenant_id, 1) = ?'
  ).get(id, tenantId) as any;
  if (!register) {
    return res.status(404).json({ error: 'Caja no encontrada.' });
  }

  // Verificar si es la única activa de su tipo
  const remaining = await db.prepare(
    'SELECT COUNT(*) as count FROM cash_registers WHERE kind = ? AND active = 1 AND id != ? AND COALESCE(tenant_id, 1) = ?'
  ).get(register.kind, id, tenantId) as { count: number };
  if (remaining.count === 0) {
    return res.status(400).json({
      error: 'No se puede quitar esta caja porque debe permanecer al menos una caja activa de este tipo.'
    });
  }

  // Verificar si tiene movimientos registrados en historial
  const hasMovements = await db.prepare(
    'SELECT COUNT(*) as count FROM movements WHERE register_id = ?'
  ).get(id) as { count: number };
  const hasCC = await db.prepare(
    'SELECT COUNT(*) as count FROM caja_chica WHERE register_id = ?'
  ).get(id) as { count: number };

  if (hasMovements.count > 0 || hasCC.count > 0) {
    // Para no violar la inmutabilidad y auditoría contable, se archiva
    await db.prepare('UPDATE cash_registers SET active = 0 WHERE id = ?').run(id);
    await writeAudit('archive-register', 'cash_registers', id, `Caja archivada: ${register.name}`, req.user?.role);
    return res.json({
      success: true,
      message: `La caja "${register.name}" contiene transacciones históricas, por lo que fue archivada de forma segura.`
    });
  }

  // Si no tiene transacciones registradas, se puede eliminar físicamente
  await db.prepare('DELETE FROM cash_registers WHERE id = ?').run(id);
  await writeAudit('delete-register', 'cash_registers', id, `Caja eliminada: ${register.name}`, req.user?.role);
  res.json({ success: true, message: `Caja "${register.name}" eliminada correctamente.` });
});

class CashError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function adjustRegister(registerId: number, delta: number, options?: { allowInactive?: boolean }) {
  const register = await db.prepare('SELECT * FROM cash_registers WHERE id = ?').get(registerId) as any;
  if (!register) throw new CashError('La caja indicada no existe.');
  if (register.active !== 1 && !options?.allowInactive) throw new CashError(`La caja "${register.name}" está archivada y no acepta movimientos.`);
  const next = Math.round((Number(register.balance) + delta) * 100) / 100;
  if (next < -0.005) {
    throw new CashError(
      `Fondos insuficientes en ${register.name}. Saldo disponible: $${Number(register.balance).toFixed(2)}`
    );
  }
  await db.prepare('UPDATE cash_registers SET balance = ? WHERE id = ?').run(next, register.id);
  return register as { id: number; name: string; kind: string; balance: number };
}

async function defaultRegister(kind: 'operativa' | 'chica', tenantId: number) {
  return await db.prepare(
    'SELECT * FROM cash_registers WHERE kind = ? AND active = 1 AND COALESCE(tenant_id, 1) = ? ORDER BY id LIMIT 1'
  ).get(kind, tenantId) as any;
}

async function getCajaChicaCurrentBalance(tenantId: number): Promise<number> {
  const rows = await db.prepare(
    'SELECT type, amount FROM caja_chica WHERE COALESCE(voided, 0) = 0 AND COALESCE(tenant_id, 1) = ?'
  ).all(tenantId) as { type: string; amount: number }[];
  let totalIn = 0;
  let totalOut = 0;
  for (const row of rows) {
    if (row.type === 'ingreso') totalIn += row.amount;
    else totalOut += row.amount;
  }
  return Math.round((totalIn - totalOut) * 100) / 100;
}

// -------------------------------------------------------------
// 3. Movements (Ventas, Gastos, Servicios, etc.)
// -------------------------------------------------------------
router.get('/movements', requireAuth, async (req: Request, res: Response) => {
  const { date, search } = req.query;
  const tenantId = req.user?.tenantId ?? 1;
  let sql = `
    SELECT m.*, r.name as register_name
    FROM movements m
    LEFT JOIN cash_registers r ON r.id = m.register_id
    WHERE COALESCE(m.tenant_id, 1) = ?
  `;
  const params: any[] = [tenantId];

  if (date && date !== 'TODOS') {
    sql += ' AND m.date = ?';
    params.push(date);
  }

  if (search) {
    sql += ' AND (m.desc LIKE ? OR m.doc LIKE ? OR m.voucher_code LIKE ? OR r.name LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  sql += ' ORDER BY m.id DESC';
  const rows = await db.prepare(sql).all(...params) as any[];

  const movements = rows.map(r => ({
    id: r.id,
    date: r.date,
    type: r.type,
    desc: r.desc,
    amount: r.amount,
    tax: r.tax,
    doc: r.doc,
    voucherCode: r.voucher_code,
    voucherRecipient: r.voucher_recipient,
    time: r.time,
    items: r.items_json ? JSON.parse(r.items_json) : null,
    ccId: r.cc_id,
    userRole: r.user_role,
    registerId: r.register_id,
    registerName: r.register_name || 'Sin caja',
    debit: r.debit || 0,
    credit: r.credit || 0,
    voided: r.voided === 1
  }));

  res.json(movements);
});

router.post('/movements', requireAuth, rateLimit('movements', 40, 60 * 1000), async (req: Request, res: Response) => {
  const { date, type, desc, amount, tax, doc, time, items, ccCategory, voucherRecipient, registerId } = req.body;
  if (!date || !type || !amount || !doc) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para registrar la operación.' });
  }

  const tenantId = req.user!.tenantId;
  const amt = Math.round(Number(amount) * 100) / 100;
  if (!(amt > 0)) {
    return res.status(400).json({ error: 'El monto debe ser mayor a cero.' });
  }
  const tx = (tax !== undefined && tax !== null && !isNaN(Number(tax)) && Number(tax) > 0)
    ? Math.round(Number(tax) * 100) / 100
    : Math.round((amt / 1.13 * 0.13) * 100) / 100;
  let voucherCode: string | null = null;
  const recDesc = desc;

  if (doc === 'Sin Comprobante') {
    voucherCode = await getNextVoucherNumber();
  }

  const moneyIn = type === 'venta';
  const wantedKind = type === 'cajachica' ? 'chica' : 'operativa';
  const requestedId = Number(registerId) || 0;
  const register = requestedId
    ? await db.prepare(
        'SELECT * FROM cash_registers WHERE id = ? AND COALESCE(tenant_id, 1) = ?'
      ).get(requestedId, tenantId)
    : await defaultRegister(wantedKind, tenantId);
  if (!register || (register as any).kind !== wantedKind) {
    return res.status(400).json({ error: 'Seleccione una caja activa del tipo correcto para esta operación.' });
  }

  const debit = moneyIn ? 0 : amt;
  const credit = moneyIn ? amt : 0;
  const delta = credit - debit;

  try {
    await db.exec('BEGIN');
    await adjustRegister((register as any).id, delta);

    let ccId: number | null = null;
    if (type === 'cajachica') {
      const ccBal = await getCajaChicaCurrentBalance(tenantId);
      if (amt - ccBal > 0.005) {
        throw new CashError(`Fondos insuficientes en Caja Chica. Saldo actual disponible: $${ccBal.toFixed(2)}`);
      }
      const ccRes = await db.prepare(`
        INSERT INTO caja_chica (type, category, desc, amount, date, time, user_role, register_id, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'gasto',
        ccCategory || 'Gasto General',
        desc || 'Gasto desde Contable',
        amt,
        date,
        time || 'Ahora',
        req.user?.role || 'empleado',
        (register as any).id,
        tenantId
      );
      ccId = Number(ccRes.lastInsertRowid);
    }

    if (type === 'venta' && Array.isArray(items) && items.length > 0) {
      const variant = db.prepare(`
        SELECT stock FROM inventory_variants
        WHERE item_code = ? AND size = ? AND color = ? AND COALESCE(tenant_id, 1) = ?
      `);
      const deductStock = db.prepare(`
        UPDATE inventory_variants
        SET stock = stock - ?
        WHERE item_code = ? AND size = ? AND color = ? AND stock >= ? AND COALESCE(tenant_id, 1) = ?
      `);
      for (const it of items) {
        const qty = Number(it.qty);
        if (!Number.isInteger(qty) || qty <= 0) {
          throw new CashError(`Cantidad inválida para ${it.code} talla ${it.size}.`);
        }
        const current = await variant.get(it.code, it.size, it.color, tenantId) as { stock: number } | undefined;
        if (!current || current.stock < qty) {
          throw new CashError(`Stock insuficiente para ${it.code} talla ${it.size}.`);
        }
        const updated = await deductStock.run(qty, it.code, it.size, it.color, qty, tenantId);
        if (updated.changes !== 1) {
          throw new CashError(`No se pudo descontar el stock de ${it.code}.`);
        }
      }
    }

    if (type === 'compra' && Array.isArray(items) && items.length > 0) {
      const addStock = db.prepare(`
        UPDATE inventory_variants
        SET stock = stock + ?
        WHERE item_code = ? AND size = ? AND color = ? AND COALESCE(tenant_id, 1) = ?
      `);
      for (const it of items) {
        const qty = Number(it.qty);
        if (!Number.isInteger(qty) || qty <= 0) {
          throw new CashError(`Cantidad inválida para ${it.code} talla ${it.size}.`);
        }
        const updated = await addStock.run(qty, it.code, it.size, it.color, tenantId);
        if (updated.changes !== 1) {
          throw new CashError(`No existe la variante ${it.code} talla ${it.size} y color ${it.color}.`);
        }
      }
    }

    const result = await db.prepare(`
      INSERT INTO movements (
        date, type, desc, amount, tax, doc, voucher_code, voucher_recipient, time,
        items_json, cc_id, user_role, register_id, debit, credit, voided, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      date,
      type,
      recDesc,
      amt,
      tx,
      doc,
      voucherCode,
      voucherRecipient || null,
      time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items ? JSON.stringify(items) : null,
      ccId,
      req.user?.role || 'empleado',
      (register as any).id,
      debit,
      credit,
      tenantId
    );

    await db.prepare('INSERT OR IGNORE INTO active_dates (date, tenant_id) VALUES (?, ?)').run(date, tenantId);
    await db.exec('COMMIT');
    res.json({
      success: true,
      id: result.lastInsertRowid,
      voucherCode,
      registerName: (register as any).name
    });
  } catch (err: any) {
    try { await db.exec('ROLLBACK'); } catch { /* transacción ya cerrada */ }
    const status = err instanceof CashError ? err.status : 500;
    res.status(status).json({ error: err.message || 'No se pudo registrar la operación.' });
  }
});

async function voidMovementRecord(mov: any, role?: string) {
  if (!mov || mov.voided === 1) return;
  if (mov.register_id) {
    const reversal = (Number(mov.debit) || 0) - (Number(mov.credit) || 0);
    await adjustRegister(mov.register_id, reversal, { allowInactive: true });
  }
  if (mov.type === 'venta' && mov.items_json) {
    const items = JSON.parse(mov.items_json);
    const tenantId = mov.tenant_id ?? 1;
    const restoreStock = db.prepare(`
      UPDATE inventory_variants
      SET stock = stock + ?
      WHERE item_code = ? AND size = ? AND color = ? AND COALESCE(tenant_id, 1) = ?
    `);
    for (const it of items) {
      await restoreStock.run(Number(it.qty) || 1, it.code, it.size, it.color, tenantId);
    }
  }
  if (mov.type === 'compra' && mov.items_json) {
    const items = JSON.parse(mov.items_json);
    const tenantId = mov.tenant_id ?? 1;
    const reversePurchase = db.prepare(`
      UPDATE inventory_variants
      SET stock = stock - ?
      WHERE item_code = ? AND size = ? AND color = ? AND stock >= ? AND COALESCE(tenant_id, 1) = ?
    `);
    for (const it of items) {
      const qty = Number(it.qty) || 1;
      const updated = await reversePurchase.run(qty, it.code, it.size, it.color, qty, tenantId);
      if (updated.changes !== 1) {
        throw new CashError(`No se puede revertir la compra de ${it.code}: stock insuficiente.`);
      }
    }
  }
  if (mov.cc_id) {
    await db.prepare('UPDATE caja_chica SET voided = 1 WHERE id = ?').run(mov.cc_id);
  }
  await db.prepare('UPDATE movements SET voided = 1 WHERE id = ?').run(mov.id);
  await writeAudit('void-movement', 'movements', mov.id, mov.desc || mov.type, role);
}

router.get('/movements/:id/receipt', requireAuth, async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const id = Number(req.params.id);
  const movement = await db.prepare(
    'SELECT * FROM movements WHERE id = ? AND COALESCE(tenant_id, 1) = ? AND COALESCE(voided, 0) = 0'
  ).get(id, tenantId) as any;
  if (!movement) return res.status(404).json({ error: 'Movimiento no encontrado.' });

  const amount = Number(movement.amount).toFixed(2);
  const tax = Number(movement.tax).toFixed(2);
  const itemRows = movement.items_json
    ? (JSON.parse(movement.items_json) as any[]).map((item) =>
        `<tr><td>${escapeHtml(item.code)}</td><td>${escapeHtml(item.size)} / ${escapeHtml(item.color)}</td><td>${escapeHtml(item.qty)}</td></tr>`
      ).join('')
    : '';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante ${escapeHtml(movement.voucher_code || movement.id)}</title>
<style>@page{margin:12mm}body{font-family:Arial,sans-serif;color:#21342a;max-width:800px;margin:auto;padding:24px}h1{margin-bottom:4px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:20px 0}.box{border:1px solid #cbdcc5;border-radius:8px;padding:12px}.total{font-size:24px;font-weight:bold;text-align:right;margin-top:16px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}@media print{button{display:none}}</style></head>
<body><button onclick="window.print()">Imprimir / Guardar PDF</button><h1>Control Contable Pro</h1><small>Comprobante de operación</small>
<div class="meta"><div class="box"><b>Correlativo</b><br>${escapeHtml(movement.voucher_code || `MOV-${movement.id}`)}</div><div class="box"><b>Fecha y hora</b><br>${escapeHtml(movement.date)} ${escapeHtml(movement.time)}</div></div>
<div class="box"><b>Concepto</b><br>${escapeHtml(movement.desc)}<br><small>Tipo: ${escapeHtml(movement.type)} · Documento: ${escapeHtml(movement.doc)}</small></div>
${itemRows ? `<table><thead><tr><th>Código</th><th>Variante</th><th>Cantidad</th></tr></thead><tbody>${itemRows}</tbody></table>` : ''}
<div class="total">$${amount}</div><div style="text-align:right">IVA 13% incluido: $${tax}</div>
</body></html>`);
});

router.delete('/movements/:id', requireAuth, requireRole(['dueno']), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const tenantId = req.user!.tenantId;
  const mov = await db.prepare(
    'SELECT * FROM movements WHERE id = ? AND COALESCE(tenant_id, 1) = ?'
  ).get(id, tenantId) as any;
  if (!mov) {
    return res.status(404).json({ error: 'Movimiento no encontrado.' });
  }
  if (mov.voided === 1) {
    return res.status(400).json({ error: 'Este movimiento ya está anulado y permanece en el historial.' });
  }

  try {
    await db.exec('BEGIN');
    await voidMovementRecord(mov, req.user?.role);
    await db.exec('COMMIT');
    res.json({ success: true, message: 'Movimiento anulado. El historial se conserva y el stock o el saldo fueron revertidos.' });
  } catch (err: any) {
    try { await db.exec('ROLLBACK'); } catch { /* transacción ya cerrada */ }
    const status = err instanceof CashError ? err.status : 500;
    res.status(status).json({ error: err.message || 'No se pudo anular el movimiento.' });
  }
});

// -------------------------------------------------------------
// 4. Inventory Module
// -------------------------------------------------------------
router.get('/inventory', requireAuth, async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId ?? 1;
  const items = await db.prepare(
    'SELECT * FROM inventory_items WHERE COALESCE(tenant_id, 1) = ? ORDER BY code ASC'
  ).all(tenantId) as any[];
  const variants = await db.prepare(
    'SELECT * FROM inventory_variants WHERE COALESCE(tenant_id, 1) = ? ORDER BY id ASC'
  ).all(tenantId) as any[];

  const variantsByCode: { [key: string]: any[] } = {};
  variants.forEach(v => {
    if (!variantsByCode[v.item_code]) variantsByCode[v.item_code] = [];
    variantsByCode[v.item_code].push({
      size: v.size,
      color: v.color,
      cost: v.cost,
      price: v.price,
      stock: v.stock
    });
  });

  const fullList = items.map(it => ({
    code: it.code,
    name: it.name,
    audience: it.audience,
    category: it.category,
    variants: variantsByCode[it.code] || []
  }));

  res.json(fullList);
});

router.post('/inventory', requireAuth, async (req: Request, res: Response) => {
  const { code, name, audience, category, variants } = req.body;
  const cleanCode = String(code || '').trim().toUpperCase();

  if (!cleanCode || !name || !variants || variants.length === 0) {
    return res.status(400).json({ error: 'Datos de prenda o variantes incompletos.' });
  }

  const tenantId = req.user!.tenantId;

  const existing = await db.prepare(
    'SELECT code FROM inventory_items WHERE code = ? AND COALESCE(tenant_id, 1) = ?'
  ).get(cleanCode, tenantId);
  if (existing) {
    return res.status(400).json({
      error: `El código ${cleanCode} ya existe. Utiliza el botón Editar en la tabla para modificarlo.`
    });
  }

  const insertItem = db.prepare(
    'INSERT INTO inventory_items (code, name, audience, category, tenant_id) VALUES (?, ?, ?, ?, ?)'
  );
  const insertVariant = db.prepare(
    'INSERT INTO inventory_variants (item_code, size, color, cost, price, stock, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  await insertItem.run(cleanCode, name.trim(), audience, category, tenantId);
  for (const v of variants) {
    await insertVariant.run(
      cleanCode,
      String(v.size || '').trim(),
      String(v.color || '').trim(),
      Number(v.cost || 0),
      Number(v.price || 0),
      Math.max(0, parseInt(v.stock) || 0),
      tenantId
    );
  }

  res.json({ success: true, code: cleanCode });
});

router.put('/inventory/:code', requireAuth, async (req: Request, res: Response) => {
  const codeParam = req.params.code.trim().toUpperCase();
  const { name, audience, category, variants } = req.body;
  const tenantId = req.user!.tenantId;

  const existing = await db.prepare(
    'SELECT * FROM inventory_items WHERE code = ? AND COALESCE(tenant_id, 1) = ?'
  ).get(codeParam, tenantId) as any;
  if (!existing) {
    return res.status(404).json({ error: `Modelo ${codeParam} no encontrado en inventario.` });
  }

  if (!name || !variants || variants.length === 0) {
    return res.status(400).json({ error: 'Debe ingresar nombre y al menos una variante con talla y precio.' });
  }

  // Update item master data
  await db.prepare(`
    UPDATE inventory_items
    SET name = ?, audience = ?, category = ?, updated_at = CURRENT_TIMESTAMP
    WHERE code = ? AND COALESCE(tenant_id, 1) = ?
  `).run(name.trim(), audience, category, codeParam, tenantId);

  // If user is employee, keep existing cost prices
  const existingVariants = await db.prepare(
    'SELECT size, color, cost FROM inventory_variants WHERE item_code = ? AND COALESCE(tenant_id, 1) = ?'
  ).all(codeParam, tenantId) as any[];
  const costLookup = new Map<string, number>();
  existingVariants.forEach(ev => {
    costLookup.set(`${ev.size}|${ev.color}`.toLowerCase(), ev.cost);
  });

  // Replace variants atomically
  await db.prepare(
    'DELETE FROM inventory_variants WHERE item_code = ? AND COALESCE(tenant_id, 1) = ?'
  ).run(codeParam, tenantId);
  const insertVariant = db.prepare(`
    INSERT INTO inventory_variants (item_code, size, color, cost, price, stock, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const v of variants) {
    const key = `${v.size}|${v.color}`.toLowerCase();
    let finalCost = Number(v.cost);
    if ((v.cost === undefined || v.cost === null || isNaN(finalCost)) && costLookup.has(key)) {
      finalCost = costLookup.get(key) || 0;
    }
    await insertVariant.run(
      codeParam,
      String(v.size || '').trim(),
      String(v.color || '').trim(),
      isNaN(finalCost) ? 0 : Math.max(0, finalCost),
      Math.max(0, Number(v.price || 0)),
      Math.max(0, parseInt(v.stock) || 0),
      tenantId
    );
  }

  res.json({ success: true, message: `Modelo ${codeParam} actualizado exitosamente.` });
});

router.delete('/inventory/:code', requireAuth, requireRole(['dueno']), async (req: Request, res: Response) => {
  const codeParam = req.params.code.trim().toUpperCase();
  const tenantId = req.user!.tenantId;
  // Only delete if belongs to this tenant
  const existing = await db.prepare(
    'SELECT code FROM inventory_items WHERE code = ? AND COALESCE(tenant_id, 1) = ?'
  ).get(codeParam, tenantId);
  if (!existing) {
    return res.status(404).json({ error: `Modelo ${codeParam} no encontrado en inventario.` });
  }
  await db.prepare('DELETE FROM inventory_variants WHERE item_code = ? AND COALESCE(tenant_id, 1) = ?').run(codeParam, tenantId);
  await db.prepare('DELETE FROM inventory_items WHERE code = ? AND COALESCE(tenant_id, 1) = ?').run(codeParam, tenantId);
  res.json({ success: true, message: `Modelo ${codeParam} eliminado de inventario.` });
});

// -------------------------------------------------------------
// 5. Caja Chica
// -------------------------------------------------------------
router.get('/caja-chica', requireAuth, async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId ?? 1;
  const rows = await db.prepare(
    'SELECT * FROM caja_chica WHERE COALESCE(tenant_id, 1) = ? ORDER BY id DESC'
  ).all(tenantId) as any[];
  let totalIn = 0;
  let totalOut = 0;
  rows.forEach(r => {
    if (r.voided === 1) return;
    if (r.type === 'ingreso') totalIn += r.amount;
    else totalOut += r.amount;
  });
  const balance = totalIn - totalOut;

  res.json({
    balance,
    totalIn,
    totalOut,
    movements: rows.map(r => ({
      id: r.id,
      type: r.type,
      category: r.category,
      desc: r.desc,
      amount: r.amount,
      date: r.date,
      time: r.time,
      userRole: r.user_role,
      voided: r.voided === 1
    }))
  });
});

router.post('/caja-chica', requireAuth, rateLimit('caja', 40, 60 * 1000), async (req: Request, res: Response) => {
  const { type, category, desc, amount, date, time, registerId } = req.body;
  const amt = Math.round(Number(amount) * 100) / 100;
  if (!amt || amt <= 0) {
    return res.status(400).json({ error: 'Monto debe ser mayor a 0.' });
  }
  if (type !== 'ingreso' && type !== 'gasto') {
    return res.status(400).json({ error: 'El tipo de movimiento de caja chica no es válido.' });
  }

  const tenantId = req.user!.tenantId;
  const requestedId = Number(registerId) || 0;
  const register = requestedId
    ? await db.prepare(
        "SELECT * FROM cash_registers WHERE id = ? AND kind = 'chica' AND COALESCE(tenant_id, 1) = ?"
      ).get(requestedId, tenantId)
    : await defaultRegister('chica', tenantId);
  if (!register) {
    return res.status(400).json({ error: 'No hay una caja chica activa para registrar el movimiento.' });
  }

  const finalDate = date || new Date().toISOString().slice(0, 10);
  const finalTime = time || (new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const delta = type === 'ingreso' ? amt : -amt;

  try {
    await db.exec('BEGIN');
    if (type === 'gasto') {
      const ccBal = await getCajaChicaCurrentBalance(tenantId);
      if (amt - ccBal > 0.005) {
        throw new CashError(`Fondos insuficientes en Caja Chica. Saldo actual disponible: $${ccBal.toFixed(2)}`);
      }
    }
    await adjustRegister((register as any).id, delta);
    const result = await db.prepare(`
      INSERT INTO caja_chica (type, category, desc, amount, date, time, user_role, register_id, voided, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      type,
      type === 'gasto' ? (category || 'Gasto General') : 'Inyección de Fondo',
      desc || (type === 'ingreso' ? 'Carga de fondo' : 'Gasto operativo'),
      amt,
      finalDate,
      finalTime,
      req.user?.role || 'empleado',
      (register as any).id,
      tenantId
    );
    await db.exec('COMMIT');
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err: any) {
    try { await db.exec('ROLLBACK'); } catch { /* transacción ya cerrada */ }
    const status = err instanceof CashError ? err.status : 500;
    res.status(status).json({ error: err.message || 'No se pudo registrar el movimiento de caja chica.' });
  }
});

router.delete('/caja-chica/:id', requireAuth, requireRole(['dueno']), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const tenantId = req.user!.tenantId;
  const item = await db.prepare(
    'SELECT * FROM caja_chica WHERE id = ? AND COALESCE(tenant_id, 1) = ?'
  ).get(id, tenantId) as any;
  if (!item) {
    return res.status(404).json({ error: 'Movimiento no encontrado.' });
  }

  if (item.voided === 1) {
    return res.status(400).json({ error: 'Este movimiento de caja chica ya está anulado.' });
  }

  if (item.type === 'ingreso' && await getCajaChicaCurrentBalance(tenantId) - item.amount < -0.005) {
    return res.status(400).json({
      error: 'No se puede anular este ingreso: el saldo de caja chica quedaría negativo.'
    });
  }

  const linked = await db.prepare(
    'SELECT * FROM movements WHERE cc_id = ? AND COALESCE(voided, 0) = 0 AND COALESCE(tenant_id, 1) = ?'
  ).get(id, tenantId) as any;

  try {
    await db.exec('BEGIN');
    if (linked) {
      await voidMovementRecord(linked, req.user?.role);
    } else if (item.register_id) {
      const delta = item.type === 'ingreso' ? -item.amount : item.amount;
      await adjustRegister(item.register_id, delta, { allowInactive: true });
      await db.prepare('UPDATE caja_chica SET voided = 1 WHERE id = ?').run(id);
      await writeAudit('void-caja-chica', 'caja_chica', id, item.desc || item.type, req.user?.role);
    } else {
      await db.prepare('UPDATE caja_chica SET voided = 1 WHERE id = ?').run(id);
    }
    await db.exec('COMMIT');
    res.json({ success: true, message: 'Movimiento anulado. El historial de caja chica se conserva.' });
  } catch (err: any) {
    try { await db.exec('ROLLBACK'); } catch { /* transacción ya cerrada */ }
    const status = err instanceof CashError ? err.status : 500;
    res.status(status).json({ error: err.message || 'No se pudo anular el movimiento de caja chica.' });
  }
});

// -------------------------------------------------------------
// 6. Cierre de Caja & Cierre de Inventario
// -------------------------------------------------------------
// 6a. Cierre de Caja
router.get('/cierres/caja', requireAuth, async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId ?? 1;
  const rows = await db.prepare(
    'SELECT * FROM cierres_caja WHERE COALESCE(tenant_id, 1) = ? ORDER BY date DESC, id DESC'
  ).all(tenantId) as any[];
  res.json(rows.map(r => ({
    id: r.id,
    date: r.date,
    time: r.time,
    cashierName: r.cashier_name,
    cashierRole: r.cashier_role,
    openingFund: r.opening_fund,
    salesTotal: r.sales_total,
    expensesTotal: r.expenses_total,
    expectedTotal: r.expected_total,
    countedTotal: r.counted_total,
    difference: r.difference,
    breakdown: r.breakdown_json ? JSON.parse(r.breakdown_json) : {},
    note: r.note,
    createdAt: r.created_at
  })));
});

router.post('/cierres/caja', requireAuth, async (req: Request, res: Response) => {
  const {
    date,
    time,
    cashierName,
    cashierRole,
    openingFund,
    salesTotal,
    expensesTotal,
    expectedTotal,
    countedTotal,
    difference,
    breakdown,
    note
  } = req.body;

  if (!date) {
    return res.status(400).json({ error: 'La fecha de cierre de caja es obligatoria.' });
  }

  const tenantId = req.user!.tenantId;
  const stmt = db.prepare(`
    INSERT INTO cierres_caja (
      date, time, cashier_name, cashier_role, opening_fund, sales_total,
      expenses_total, expected_total, counted_total, difference, breakdown_json, note, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = await stmt.run(
    date,
    time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    cashierName || (req.user?.displayName || 'Cajero de Turno'),
    cashierRole || (req.user?.role || 'empleado'),
    Number(openingFund) || 0,
    Number(salesTotal) || 0,
    Number(expensesTotal) || 0,
    Number(expectedTotal) || 0,
    Number(countedTotal) || 0,
    Number(difference) || 0,
    JSON.stringify(breakdown || {}),
    note || '',
    tenantId
  );

  res.json({ success: true, id: result.lastInsertRowid });
});

router.delete('/cierres/caja/:id', requireAuth, requireRole(['dueno']), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const tenantId = req.user!.tenantId;
  const existing = await db.prepare(
    'SELECT id FROM cierres_caja WHERE id = ? AND COALESCE(tenant_id, 1) = ?'
  ).get(id, tenantId);
  if (!existing) {
    return res.status(404).json({ error: 'Cierre de caja no encontrado.' });
  }
  await db.prepare('DELETE FROM cierres_caja WHERE id = ?').run(id);
  res.json({ success: true, message: 'Cierre de caja eliminado.' });
});

// 6b. Cierre de Inventario (Snapshots)
router.get('/cierres/inventario', requireAuth, async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId ?? 1;
  const rows = await db.prepare(
    'SELECT * FROM cierres_inventario WHERE COALESCE(tenant_id, 1) = ? ORDER BY date DESC, id DESC'
  ).all(tenantId) as any[];
  res.json(rows.map(r => ({
    id: r.id,
    date: r.date,
    time: r.time,
    scope: r.scope,
    categories: JSON.parse(r.categories_json),
    note: r.note,
    totals: JSON.parse(r.totals_json),
    items: JSON.parse(r.items_json),
    userRole: r.user_role
  })));
});

router.post('/cierres/inventario', requireAuth, async (req: Request, res: Response) => {
  const { date, time, scope, categories, note, totals, items } = req.body;
  if (!date || !totals || !items) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para el snapshot de inventario.' });
  }

  const tenantId = req.user!.tenantId;
  const stmt = db.prepare(`
    INSERT INTO cierres_inventario (date, time, scope, categories_json, note, totals_json, items_json, user_role, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = await stmt.run(
    date,
    time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    scope || 'GENERAL',
    JSON.stringify(categories || []),
    note || '',
    JSON.stringify(totals),
    JSON.stringify(items),
    req.user?.role || 'empleado',
    tenantId
  );

  res.json({ success: true, id: result.lastInsertRowid });
});

router.delete('/cierres/inventario/:id', requireAuth, requireRole(['dueno']), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const tenantId = req.user!.tenantId;
  const existing = await db.prepare(
    'SELECT id FROM cierres_inventario WHERE id = ? AND COALESCE(tenant_id, 1) = ?'
  ).get(id, tenantId);
  if (!existing) {
    return res.status(404).json({ error: 'Snapshot de inventario no encontrado.' });
  }
  await db.prepare('DELETE FROM cierres_inventario WHERE id = ?').run(id);
  res.json({ success: true, message: 'Snapshot de cierre de inventario eliminado.' });
});

// -------------------------------------------------------------
// 7. Apartados
// -------------------------------------------------------------
router.get('/apartados', requireAuth, async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId ?? 1;
  const rows = await db.prepare(
    'SELECT * FROM apartados WHERE COALESCE(tenant_id, 1) = ? ORDER BY id DESC'
  ).all(tenantId) as any[];
  res.json(rows.map(r => ({
    id: r.id,
    clientName: r.client_name,
    prendaDesc: r.prenda_desc,
    total: r.total,
    abono: r.abono,
    status: r.status,
    date: r.date,
    time: r.time,
    dueDate: r.due_date || null
  })));
});

router.post('/apartados', requireAuth, async (req: Request, res: Response) => {
  const { clientName, prendaDesc, total, abono, date, time, dueDate } = req.body;
  const tot = Number(total);
  const ab = Number(abono);

  if (!clientName || !prendaDesc || !(tot > 0) || !(ab >= 0)) {
    return res.status(400).json({ error: 'Datos de cliente, prenda o montos inválidos.' });
  }
  if (ab > tot) {
    return res.status(400).json({ error: 'El abono inicial no puede ser mayor al total del apartado.' });
  }

  const tenantId = req.user!.tenantId;
  const stmt = db.prepare(`
    INSERT INTO apartados (client_name, prenda_desc, total, abono, status, date, time, tenant_id, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = await stmt.run(
    clientName.trim(),
    prendaDesc.trim(),
    tot,
    ab,
    ab >= tot ? 'entregado' : 'apartado',
    date || new Date().toISOString().slice(0, 10),
    time || (new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    tenantId,
    typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null
  );

  res.json({ success: true, id: result.lastInsertRowid });
});

router.put('/apartados/:id/abono', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { extraAbono, markDelivered } = req.body;
  const tenantId = req.user!.tenantId;

  const ap = await db.prepare(
    'SELECT * FROM apartados WHERE id = ? AND COALESCE(tenant_id, 1) = ?'
  ).get(id, tenantId) as any;
  if (!ap) {
    return res.status(404).json({ error: 'Apartado no encontrado.' });
  }

  let newAbono = ap.abono;
  if (extraAbono !== undefined && extraAbono !== null && extraAbono !== '') {
    const extra = Number(extraAbono);
    if (!Number.isFinite(extra) || extra <= 0) {
      return res.status(400).json({ error: 'El abono adicional debe ser mayor a cero.' });
    }
    newAbono += extra;
  }
  if (newAbono > ap.total && !markDelivered) {
    return res.status(400).json({ error: 'El abono acumulado no puede exceder el total.' });
  }
  let newStatus = ap.status;
  if (markDelivered || newAbono >= ap.total) {
    newStatus = 'entregado';
  }

  await db.prepare(`
    UPDATE apartados
    SET abono = ?, status = ?
    WHERE id = ?
  `).run(newAbono, newStatus, id);

  res.json({ success: true, abono: newAbono, status: newStatus });
});

router.delete('/apartados/:id', requireAuth, requireRole(['dueno']), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const tenantId = req.user!.tenantId;
  const existing = await db.prepare(
    'SELECT id FROM apartados WHERE id = ? AND COALESCE(tenant_id, 1) = ?'
  ).get(id, tenantId);
  if (!existing) {
    return res.status(404).json({ error: 'Apartado no encontrado.' });
  }
  await db.prepare('DELETE FROM apartados WHERE id = ?').run(id);
  res.json({ success: true, message: 'Apartado eliminado.' });
});

// -------------------------------------------------------------
// 8. Calendar
// -------------------------------------------------------------
router.get('/calendar', requireAuth, async (req: Request, res: Response) => {
  const tenantId = req.user?.tenantId ?? 1;
  const rows = await db.prepare(
    'SELECT * FROM calendar_days WHERE COALESCE(tenant_id, 1) = ?'
  ).all(tenantId) as any[];
  const map: { [date: string]: { status: string; note: string } } = {};
  rows.forEach(r => {
    map[r.date] = { status: r.status, note: r.note || '' };
  });
  res.json(map);
});

router.put('/calendar/:date', requireAuth, async (req: Request, res: Response) => {
  const { date } = req.params;
  const { status, note } = req.body;
  const tenantId = req.user!.tenantId;

  if (!status || !['laborado', 'sinventas', 'asueto'].includes(status)) {
    return res.status(400).json({ error: 'Estado de calendario inválido.' });
  }

  // calendar_days has (date TEXT PRIMARY KEY) so we need tenant-aware upsert
  // Use (date, tenant_id) logic: since date is PK we store per-tenant as date+tenant composite
  // However the existing schema has date as PRIMARY KEY. We'll do a manual check+insert/update.
  const existing = await db.prepare(
    'SELECT date FROM calendar_days WHERE date = ? AND COALESCE(tenant_id, 1) = ?'
  ).get(date, tenantId);

  if (existing) {
    await db.prepare(`
      UPDATE calendar_days SET status = ?, note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE date = ? AND COALESCE(tenant_id, 1) = ?
    `).run(status, note || '', date, tenantId);
  } else {
    // For tenant 1, the old ON CONFLICT logic won't work if another tenant uses same date.
    // Insert ignoring conflicts only for multi-tenant isolation.
    try {
      await db.prepare(`
        INSERT INTO calendar_days (date, status, note, updated_at, tenant_id)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
      `).run(date, status, note || '', tenantId);
    } catch {
      // If PK conflict (another tenant has same date), do upsert only for our tenant
      await db.prepare(`
        UPDATE calendar_days SET status = ?, note = ?, updated_at = CURRENT_TIMESTAMP
        WHERE date = ? AND COALESCE(tenant_id, 1) = ?
      `).run(status, note || '', date, tenantId);
    }
  }

  res.json({ success: true, date, status, note });
});

// -------------------------------------------------------------
// 9. Operational Alerts
// -------------------------------------------------------------
router.get('/alerts', requireAuth, async (req: Request, res: Response) => {
  const tenantId = req.user!.tenantId;
  const lowStock = await db.prepare(`
    SELECT iv.item_code, iv.size, iv.color, iv.stock, ii.name
    FROM inventory_variants iv
    JOIN inventory_items ii
      ON ii.code = iv.item_code AND ii.tenant_id = iv.tenant_id
    WHERE iv.stock <= 3
      AND COALESCE(iv.tenant_id, 1) = ?
    ORDER BY iv.stock ASC, ii.name ASC
  `).all(tenantId) as any[];

  const today = new Date().toISOString().slice(0, 10);
  const overdueApartados = await db.prepare(`
    SELECT id, client_name, prenda_desc, due_date, total, abono
    FROM apartados
    WHERE status = 'apartado'
      AND due_date IS NOT NULL
      AND due_date < ?
      AND COALESCE(tenant_id, 1) = ?
    ORDER BY due_date ASC
  `).all(today, tenantId) as any[];

  res.json({
    lowStock: lowStock.map((item) => ({
      code: item.item_code,
      name: item.name,
      size: item.size,
      color: item.color,
      stock: item.stock,
    })),
    overdueApartados: overdueApartados.map((item) => ({
      id: item.id,
      clientName: item.client_name,
      prendaDesc: item.prenda_desc,
      dueDate: item.due_date,
      total: item.total,
      abono: item.abono,
      balance: Math.max(0, Number(item.total) - Number(item.abono)),
    })),
  });
});

// -------------------------------------------------------------
// 10. Balance & Reports (With Role Check for Sensitive Margins)
// -------------------------------------------------------------
router.get('/reports/summary', requireAuth, async (req: Request, res: Response) => {
  const { date } = req.query;
  const isDueno = req.user?.role === 'dueno';
  const tenantId = req.user?.tenantId ?? 1;

  let movQuery = 'SELECT * FROM movements WHERE COALESCE(voided, 0) = 0 AND COALESCE(tenant_id, 1) = ?';
  const params: any[] = [tenantId];
  if (date && date !== 'TODOS') {
    movQuery += ' AND date = ?';
    params.push(date);
  }
  const movs = await db.prepare(movQuery).all(...params) as any[];

  let salesTotal = 0;
  let expensesTotal = 0;
  let salesTax = 0;
  let expensesTax = 0;
  let clothingPurchases = 0;
  let foodExpenses = 0;
  let utilityExpenses = 0;
  let otherExpenses = 0;

  movs.forEach(m => {
    if (m.type === 'venta') {
      salesTotal += m.amount;
      salesTax += m.tax || 0;
    } else {
      expensesTotal += m.amount;
      expensesTax += m.tax || 0;

      if (m.type === 'compra') {
        clothingPurchases += m.amount;
      } else if (['luz', 'agua', 'internet'].includes(m.type)) {
        utilityExpenses += m.amount;
      } else if (m.type === 'cajachica') {
        if (m.desc && m.desc.toLowerCase().includes('comida')) {
          foodExpenses += m.amount;
        } else {
          otherExpenses += m.amount;
        }
      } else {
        otherExpenses += m.amount;
      }
    }
  });

  const netTax = Math.round((salesTax - expensesTax) * 100) / 100;
  const netProfit = Math.round((salesTotal - expensesTotal) * 100) / 100;

  // Last 7 days balance for chart (tenant-scoped)
  const last7Days = await db.prepare(`
    SELECT date,
      SUM(CASE WHEN type = 'venta' THEN amount ELSE 0 END) as sales,
      SUM(CASE WHEN type != 'venta' THEN amount ELSE 0 END) as expenses
    FROM movements
    WHERE COALESCE(voided, 0) = 0 AND COALESCE(tenant_id, 1) = ?
    GROUP BY date
    ORDER BY date DESC
    LIMIT 7
  `).all(tenantId) as any[];

  res.json({
    salesTotal: Math.round(salesTotal * 100) / 100,
    expensesTotal: Math.round(expensesTotal * 100) / 100,
    salesTax: Math.round(salesTax * 100) / 100,
    expensesTax: Math.round(expensesTax * 100) / 100,
    taxTotal: netTax,
    // Sensitive profit metrics: visible to owner, masked/restricted for cashier
    netProfit: isDueno ? netProfit : null,
    isOwnerView: isDueno,
    clothingPurchases: Math.round(clothingPurchases * 100) / 100,
    foodExpenses: Math.round(foodExpenses * 100) / 100,
    utilityExpenses: Math.round(utilityExpenses * 100) / 100,
    otherExpenses: Math.round(otherExpenses * 100) / 100,
    totalSpent: Math.round((clothingPurchases + foodExpenses + utilityExpenses + otherExpenses) * 100) / 100,
    chartData: last7Days.reverse()
  });
});
