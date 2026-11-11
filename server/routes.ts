import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { db, getNextVoucherNumber } from './db.js';

export const router = express.Router();

// -------------------------------------------------------------
// Auth Middleware & Helpers
// -------------------------------------------------------------
export interface AuthUser {
  userId: number;
  username: string;
  role: 'dueno' | 'empleado';
  displayName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.slice(7).trim();
  const session = db.prepare(`
    SELECT s.token, s.user_id as userId, s.role, s.username, s.display_name as displayName, s.expires_at
    FROM sessions s
    WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP
  `).get(token) as (AuthUser & { token: string; expires_at: string }) | undefined;

  if (session) {
    req.user = {
      userId: session.userId,
      username: session.username,
      role: session.role as 'dueno' | 'empleado',
      displayName: session.displayName
    };
  }
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
router.post('/auth/login', (req: Request, res: Response) => {
  const { role, pin, username, password } = req.body;

  let user: any = null;
  if (role && pin) {
    user = db.prepare('SELECT * FROM users WHERE role = ? AND pin = ?').get(role, String(pin));
  } else if (pin) {
    user = db.prepare('SELECT * FROM users WHERE pin = ?').get(String(pin));
  } else if (username && password) {
    user = db.prepare('SELECT * FROM users WHERE username = ? AND password_hash = ?').get(username, password);
  } else if (role) {
    // Quick role switch for prototype demo if pin not provided
    user = db.prepare('SELECT * FROM users WHERE role = ? LIMIT 1').get(role);
  }

  if (!user) {
    return res.status(401).json({ error: 'PIN o credenciales incorrectas. Verifique e intente nuevamente.' });
  }

  // Create session valid for 7 days
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (token, user_id, role, username, display_name, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(token, user.id, user.role, user.username, user.display_name, expiresAt);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name
    }
  });
});

router.get('/auth/me', (req: Request, res: Response) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  res.json({ user: req.user });
});

router.post('/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.json({ success: true });
});

router.get('/auth/profiles', (_req: Request, res: Response) => {
  const users = db.prepare('SELECT id, username, role, display_name FROM users').all();
  res.json(users);
});

router.post('/auth/change-password', (req: Request, res: Response) => {
  const { targetRole, oldPassword, newPassword } = req.body;

  // 1. Validar campos obligatorios
  if (!targetRole || !['dueno', 'empleado'].includes(targetRole)) {
    return res.status(400).json({ error: 'Debe especificar el rol a modificar (Dueño / Jefe o Empleado / Cajero).' });
  }

  if (!oldPassword || typeof oldPassword !== 'string' || oldPassword.trim().length === 0) {
    return res.status(400).json({ error: 'Es obligatorio ingresar la contraseña actual (antigua) para autorizar el cambio.' });
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
    return res.status(400).json({ error: 'La nueva contraseña / PIN debe tener al menos 4 caracteres.' });
  }

  const cleanOld = oldPassword.trim();
  const cleanNew = newPassword.trim();

  // 2. Obtener usuarios de la base de datos
  const targetUser = db.prepare('SELECT * FROM users WHERE role = ?').get(targetRole) as any;
  const duenoUser = db.prepare("SELECT * FROM users WHERE role = 'dueno'").get() as any;

  if (!targetUser) {
    return res.status(404).json({ error: 'El usuario especificado no existe.' });
  }

  // 3. Verificar que se autorice con la contraseña antigua:
  // Coincide con la contraseña actual/PIN del usuario objetivo o con la del Dueño
  const matchesTarget = (targetUser.pin === cleanOld || targetUser.password_hash === cleanOld);
  const matchesDueno = duenoUser && (duenoUser.pin === cleanOld || duenoUser.password_hash === cleanOld);

  if (!matchesTarget && !matchesDueno) {
    return res.status(401).json({ error: 'La contraseña actual (antigua) ingresada es incorrecta. No se autorizó el cambio.' });
  }

  // 4. Actualizar la contraseña y PIN del usuario objetivo
  db.prepare(`
    UPDATE users 
    SET pin = ?, password_hash = ?
    WHERE role = ?
  `).run(cleanNew, cleanNew, targetRole);

  res.json({
    success: true,
    message: `Contraseña del perfil ${targetRole === 'dueno' ? 'Dueño / Jefe' : 'Empleado / Cajero'} actualizada correctamente.`
  });
});

// -------------------------------------------------------------
// 2. Active Dates (Gestión dinámica de fechas: añadir y quitar)
// -------------------------------------------------------------
router.get('/dates', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT date FROM active_dates ORDER BY date DESC').all() as { date: string }[];
  res.json(rows.map(r => r.date));
});

router.post('/dates', (req: Request, res: Response) => {
  const { date } = req.body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Formato de fecha inválido (debe ser AAAA-MM-DD).' });
  }
  try {
    db.prepare('INSERT OR IGNORE INTO active_dates (date) VALUES (?)').run(date);
    res.json({ success: true, date });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/dates/:date', requireAuth, (req: Request, res: Response) => {
  const { date } = req.params;
  const userRole = req.user?.role;

  // Check if date has movements
  const countRow = db.prepare('SELECT COUNT(*) as count FROM movements WHERE date = ?').get(date) as { count: number };
  if (countRow.count > 0 && userRole !== 'dueno') {
    return res.status(403).json({
      error: 'Solo el Dueño puede eliminar una fecha que contiene movimientos registrados.'
    });
  }

  // If dueno deletes date with movements, delete movements as well
  if (userRole === 'dueno') {
    db.prepare('DELETE FROM movements WHERE date = ?').run(date);
  }

  db.prepare('DELETE FROM active_dates WHERE date = ?').run(date);
  res.json({ success: true, message: `Fecha ${date} eliminada.` });
});

// -------------------------------------------------------------
// 3. Movements (Ventas, Gastos, Servicios, etc.)
// -------------------------------------------------------------
router.get('/movements', (req: Request, res: Response) => {
  const { date, search } = req.query;
  let sql = 'SELECT * FROM movements WHERE 1=1';
  const params: any[] = [];

  if (date && date !== 'TODOS') {
    sql += ' AND date = ?';
    params.push(date);
  }

  if (search) {
    sql += ' AND (desc LIKE ? OR doc LIKE ? OR voucher_code LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  sql += ' ORDER BY id DESC';
  const rows = db.prepare(sql).all(...params) as any[];

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
    userRole: r.user_role
  }));

  res.json(movements);
});

router.post('/movements', (req: Request, res: Response) => {
  const { date, type, desc, amount, tax, doc, time, items, isCajaChica, ccCategory, voucherRecipient } = req.body;
  if (!date || !type || !amount || !doc) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para registrar la operación.' });
  }

  const amt = Math.round(Number(amount) * 100) / 100;
  // IVA 13% for El Salvador (included in price) applies to sales and expenses including 'Sin Comprobante'
  const tx = (tax !== undefined && tax !== null && !isNaN(Number(tax)) && Number(tax) > 0)
    ? Math.round(Number(tax) * 100) / 100
    : Math.round((amt / 1.13 * 0.13) * 100) / 100;
  let voucherCode: string | null = null;
  let recDesc = desc;

  // New Feature: If "Sin Comprobante" is selected, automatically generate internal cash voucher (Vale Interno)
  if (doc === 'Sin Comprobante') {
    voucherCode = getNextVoucherNumber();
  }

  let ccId: number | null = null;
  // If registered as caja chica expense from accounting module
  if (type === 'cajachica') {
    const currentCcBalance = getCajaChicaCurrentBalance();
    if (amt - currentCcBalance > 0.005) {
      return res.status(400).json({
        error: `Fondos insuficientes en Caja Chica. Saldo actual disponible: $${currentCcBalance.toFixed(2)}`
      });
    }

    const ccStmt = db.prepare(`
      INSERT INTO caja_chica (type, category, desc, amount, date, time, user_role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const ccRes = ccStmt.run('gasto', ccCategory || 'Gasto General', desc || 'Gasto desde Contable', amt, date, time || 'Ahora', req.user?.role || 'empleado');
    ccId = Number(ccRes.lastInsertRowid);
  }

  // If sale with inventory items, deduct stock
  if (type === 'venta' && Array.isArray(items) && items.length > 0) {
    const deductStock = db.prepare(`
      UPDATE inventory_variants
      SET stock = MAX(0, stock - ?)
      WHERE item_code = ? AND size = ? AND color = ?
    `);

    for (const it of items) {
      deductStock.run(Number(it.qty) || 1, it.code, it.size, it.color);
    }
  }

  const insertMovement = db.prepare(`
    INSERT INTO movements (date, type, desc, amount, tax, doc, voucher_code, voucher_recipient, time, items_json, cc_id, user_role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = insertMovement.run(
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
    req.user?.role || 'empleado'
  );

  // Ensure active date is registered
  db.prepare('INSERT OR IGNORE INTO active_dates (date) VALUES (?)').run(date);

  res.json({
    success: true,
    id: result.lastInsertRowid,
    voucherCode
  });
});

router.delete('/movements/:id', requireAuth, requireRole(['dueno']), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const mov = db.prepare('SELECT * FROM movements WHERE id = ?').get(id) as any;
  if (!mov) {
    return res.status(404).json({ error: 'Movimiento no encontrado.' });
  }

  // Restore inventory stock if this was a sale
  if (mov.type === 'venta' && mov.items_json) {
    try {
      const items = JSON.parse(mov.items_json);
      const restoreStock = db.prepare(`
        UPDATE inventory_variants
        SET stock = stock + ?
        WHERE item_code = ? AND size = ? AND color = ?
      `);
      for (const it of items) {
        restoreStock.run(Number(it.qty) || 1, it.code, it.size, it.color);
      }
    } catch (e) {
      console.error('Error restoring stock:', e);
    }
  }

  // If linked to a caja chica entry, delete that entry as well
  if (mov.cc_id) {
    db.prepare('DELETE FROM caja_chica WHERE id = ?').run(mov.cc_id);
  }

  db.prepare('DELETE FROM movements WHERE id = ?').run(id);
  res.json({ success: true, message: 'Movimiento eliminado y stock restaurado si aplicaba.' });
});

// -------------------------------------------------------------
// 4. Inventory Module (Fixing Bug 6: text truncation & edit persistence)
// -------------------------------------------------------------
router.get('/inventory', (_req: Request, res: Response) => {
  const items = db.prepare('SELECT * FROM inventory_items ORDER BY code ASC').all() as any[];
  const variants = db.prepare('SELECT * FROM inventory_variants ORDER BY id ASC').all() as any[];

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

router.post('/inventory', (req: Request, res: Response) => {
  const { code, name, audience, category, variants } = req.body;
  const cleanCode = String(code || '').trim().toUpperCase();

  if (!cleanCode || !name || !variants || variants.length === 0) {
    return res.status(400).json({ error: 'Datos de prenda o variantes incompletos.' });
  }

  const existing = db.prepare('SELECT code FROM inventory_items WHERE code = ?').get(cleanCode);
  if (existing) {
    return res.status(400).json({
      error: `El código ${cleanCode} ya existe. Utiliza el botón Editar en la tabla para modificarlo.`
    });
  }

  const insertItem = db.prepare('INSERT INTO inventory_items (code, name, audience, category) VALUES (?, ?, ?, ?)');
  const insertVariant = db.prepare('INSERT INTO inventory_variants (item_code, size, color, cost, price, stock) VALUES (?, ?, ?, ?, ?, ?)');

  insertItem.run(cleanCode, name.trim(), audience, category);
  for (const v of variants) {
    insertVariant.run(
      cleanCode,
      String(v.size || '').trim(),
      String(v.color || '').trim(),
      Number(v.cost || 0),
      Number(v.price || 0),
      Math.max(0, parseInt(v.stock) || 0)
    );
  }

  res.json({ success: true, code: cleanCode });
});

router.put('/inventory/:code', (req: Request, res: Response) => {
  const codeParam = req.params.code.trim().toUpperCase();
  const { name, audience, category, variants } = req.body;

  const existing = db.prepare('SELECT * FROM inventory_items WHERE code = ?').get(codeParam) as any;
  if (!existing) {
    return res.status(404).json({ error: `Modelo ${codeParam} no encontrado en inventario.` });
  }

  if (!name || !variants || variants.length === 0) {
    return res.status(400).json({ error: 'Debe ingresar nombre y al menos una variante con talla y precio.' });
  }

  // Update item master data
  db.prepare(`
    UPDATE inventory_items
    SET name = ?, audience = ?, category = ?, updated_at = CURRENT_TIMESTAMP
    WHERE code = ?
  `).run(name.trim(), audience, category, codeParam);

  // If user is employee, keep existing cost prices if employee submitted without or unauthorized
  const existingVariants = db.prepare('SELECT size, color, cost FROM inventory_variants WHERE item_code = ?').all(codeParam) as any[];
  const costLookup = new Map<string, number>();
  existingVariants.forEach(ev => {
    costLookup.set(`${ev.size}|${ev.color}`.toLowerCase(), ev.cost);
  });

  // Replace variants atomically
  db.prepare('DELETE FROM inventory_variants WHERE item_code = ?').run(codeParam);
  const insertVariant = db.prepare(`
    INSERT INTO inventory_variants (item_code, size, color, cost, price, stock)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const v of variants) {
    const key = `${v.size}|${v.color}`.toLowerCase();
    let finalCost = Number(v.cost);
    if ((v.cost === undefined || v.cost === null || isNaN(finalCost)) && costLookup.has(key)) {
      finalCost = costLookup.get(key) || 0;
    }
    insertVariant.run(
      codeParam,
      String(v.size || '').trim(),
      String(v.color || '').trim(),
      isNaN(finalCost) ? 0 : Math.max(0, finalCost),
      Math.max(0, Number(v.price || 0)),
      Math.max(0, parseInt(v.stock) || 0)
    );
  }

  res.json({ success: true, message: `Modelo ${codeParam} actualizado exitosamente.` });
});

router.delete('/inventory/:code', requireAuth, requireRole(['dueno']), (req: Request, res: Response) => {
  const codeParam = req.params.code.trim().toUpperCase();
  db.prepare('DELETE FROM inventory_variants WHERE item_code = ?').run(codeParam);
  db.prepare('DELETE FROM inventory_items WHERE code = ?').run(codeParam);
  res.json({ success: true, message: `Modelo ${codeParam} eliminado de inventario.` });
});

// -------------------------------------------------------------
// 5. Caja Chica
// -------------------------------------------------------------
function getCajaChicaCurrentBalance(): number {
  const rows = db.prepare('SELECT type, amount FROM caja_chica').all() as { type: string; amount: number }[];
  let totalIn = 0;
  let totalOut = 0;
  for (const r of rows) {
    if (r.type === 'ingreso') totalIn += r.amount;
    else totalOut += r.amount;
  }
  return totalIn - totalOut;
}

router.get('/caja-chica', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM caja_chica ORDER BY id DESC').all() as any[];
  let totalIn = 0;
  let totalOut = 0;
  rows.forEach(r => {
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
      userRole: r.user_role
    }))
  });
});

router.post('/caja-chica', (req: Request, res: Response) => {
  const { type, category, desc, amount, date, time } = req.body;
  const amt = Number(amount);
  if (!amt || amt <= 0) {
    return res.status(400).json({ error: 'Monto debe ser mayor a 0.' });
  }

  const currentBalance = getCajaChicaCurrentBalance();
  if (type === 'gasto' && amt - currentBalance > 0.005) {
    return res.status(400).json({
      error: `Fondos insuficientes en Caja Chica. Saldo actual disponible: $${currentBalance.toFixed(2)}`
    });
  }

  const stmt = db.prepare(`
    INSERT INTO caja_chica (type, category, desc, amount, date, time, user_role)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const finalDate = date || new Date().toISOString().slice(0, 10);
  const finalTime = time || (new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  const result = stmt.run(
    type,
    type === 'gasto' ? (category || 'Gasto General') : 'Inyección de Fondo',
    desc || (type === 'ingreso' ? 'Carga de fondo' : 'Gasto operativo'),
    amt,
    finalDate,
    finalTime,
    req.user?.role || 'empleado'
  );

  res.json({ success: true, id: result.lastInsertRowid });
});

router.delete('/caja-chica/:id', requireAuth, requireRole(['dueno']), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const item = db.prepare('SELECT * FROM caja_chica WHERE id = ?').get(id) as any;
  if (!item) {
    return res.status(404).json({ error: 'Movimiento no encontrado.' });
  }

  if (item.type === 'ingreso' && getCajaChicaCurrentBalance() - item.amount < -0.005) {
    return res.status(400).json({
      error: 'No se puede eliminar este ingreso: el saldo de caja chica quedaría negativo.'
    });
  }

  // Remove linked movement in accounting if existed
  db.prepare('DELETE FROM movements WHERE cc_id = ?').run(id);
  db.prepare('DELETE FROM caja_chica WHERE id = ?').run(id);

  res.json({ success: true, message: 'Movimiento eliminado de caja chica.' });
});

// -------------------------------------------------------------
// 6. Cierre de Caja & Cierre de Inventario (Requirement 3)
// -------------------------------------------------------------
// 6a. Cierre de Caja (Arqueo diario y cuadre de efectivo)
router.get('/cierres/caja', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM cierres_caja ORDER BY date DESC, id DESC').all() as any[];
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

router.post('/cierres/caja', (req: Request, res: Response) => {
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

  const stmt = db.prepare(`
    INSERT INTO cierres_caja (
      date, time, cashier_name, cashier_role, opening_fund, sales_total,
      expenses_total, expected_total, counted_total, difference, breakdown_json, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
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
    note || ''
  );

  res.json({ success: true, id: result.lastInsertRowid });
});

router.delete('/cierres/caja/:id', requireAuth, requireRole(['dueno']), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM cierres_caja WHERE id = ?').run(id);
  res.json({ success: true, message: 'Cierre de caja eliminado.' });
});

// 6b. Cierre de Inventario (Snapshots)
router.get('/cierres/inventario', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM cierres_inventario ORDER BY date DESC, id DESC').all() as any[];
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

router.post('/cierres/inventario', (req: Request, res: Response) => {
  const { date, time, scope, categories, note, totals, items } = req.body;
  if (!date || !totals || !items) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para el snapshot de inventario.' });
  }

  const stmt = db.prepare(`
    INSERT INTO cierres_inventario (date, time, scope, categories_json, note, totals_json, items_json, user_role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    date,
    time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    scope || 'GENERAL',
    JSON.stringify(categories || []),
    note || '',
    JSON.stringify(totals),
    JSON.stringify(items),
    req.user?.role || 'empleado'
  );

  res.json({ success: true, id: result.lastInsertRowid });
});

router.delete('/cierres/inventario/:id', requireAuth, requireRole(['dueno']), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM cierres_inventario WHERE id = ?').run(id);
  res.json({ success: true, message: 'Snapshot de cierre de inventario eliminado.' });
});

// -------------------------------------------------------------
// 7. Apartados
// -------------------------------------------------------------
router.get('/apartados', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM apartados ORDER BY id DESC').all() as any[];
  res.json(rows.map(r => ({
    id: r.id,
    clientName: r.client_name,
    prendaDesc: r.prenda_desc,
    total: r.total,
    abono: r.abono,
    status: r.status,
    date: r.date,
    time: r.time
  })));
});

router.post('/apartados', (req: Request, res: Response) => {
  const { clientName, prendaDesc, total, abono, date, time } = req.body;
  const tot = Number(total);
  const ab = Number(abono);

  if (!clientName || !prendaDesc || !(tot > 0) || !(ab >= 0)) {
    return res.status(400).json({ error: 'Datos de cliente, prenda o montos inválidos.' });
  }

  const stmt = db.prepare(`
    INSERT INTO apartados (client_name, prenda_desc, total, abono, status, date, time)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    clientName.trim(),
    prendaDesc.trim(),
    tot,
    ab,
    ab >= tot ? 'entregado' : 'apartado',
    date || new Date().toISOString().slice(0, 10),
    time || (new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  );

  res.json({ success: true, id: result.lastInsertRowid });
});

router.put('/apartados/:id/abono', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { extraAbono, markDelivered } = req.body;

  const ap = db.prepare('SELECT * FROM apartados WHERE id = ?').get(id) as any;
  if (!ap) {
    return res.status(404).json({ error: 'Apartado no encontrado.' });
  }

  let newAbono = ap.abono;
  if (extraAbono) {
    newAbono += Number(extraAbono);
  }
  let newStatus = ap.status;
  if (markDelivered || newAbono >= ap.total) {
    newStatus = 'entregado';
  }

  db.prepare(`
    UPDATE apartados
    SET abono = ?, status = ?
    WHERE id = ?
  `).run(newAbono, newStatus, id);

  res.json({ success: true, abono: newAbono, status: newStatus });
});

router.delete('/apartados/:id', requireAuth, requireRole(['dueno']), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM apartados WHERE id = ?').run(id);
  res.json({ success: true, message: 'Apartado eliminado.' });
});

// -------------------------------------------------------------
// 8. Calendar
// -------------------------------------------------------------
router.get('/calendar', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM calendar_days').all() as any[];
  const map: { [date: string]: { status: string; note: string } } = {};
  rows.forEach(r => {
    map[r.date] = { status: r.status, note: r.note || '' };
  });
  res.json(map);
});

router.put('/calendar/:date', (req: Request, res: Response) => {
  const { date } = req.params;
  const { status, note } = req.body;

  if (!status || !['laborado', 'sinventas', 'asueto'].includes(status)) {
    return res.status(400).json({ error: 'Estado de calendario inválido.' });
  }

  db.prepare(`
    INSERT INTO calendar_days (date, status, note, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(date) DO UPDATE SET
      status = excluded.status,
      note = excluded.note,
      updated_at = CURRENT_TIMESTAMP
  `).run(date, status, note || '');

  res.json({ success: true, date, status, note });
});

// -------------------------------------------------------------
// 9. Balance & Reports (With Role Check for Sensitive Margins)
// -------------------------------------------------------------
router.get('/reports/summary', (req: Request, res: Response) => {
  const { date } = req.query;
  const isDueno = req.user?.role === 'dueno';

  let movQuery = 'SELECT * FROM movements WHERE 1=1';
  const params: any[] = [];
  if (date && date !== 'TODOS') {
    movQuery += ' AND date = ?';
    params.push(date);
  }
  const movs = db.prepare(movQuery).all(...params) as any[];

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

  // Last 7 days balance for chart
  const last7Days = db.prepare(`
    SELECT date,
      SUM(CASE WHEN type = 'venta' THEN amount ELSE 0 END) as sales,
      SUM(CASE WHEN type != 'venta' THEN amount ELSE 0 END) as expenses
    FROM movements
    GROUP BY date
    ORDER BY date DESC
    LIMIT 7
  `).all() as any[];

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
