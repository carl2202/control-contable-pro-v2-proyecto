import fs from 'node:fs/promises';
import path from 'node:path';
import { db, dbReady, isRemoteDatabase } from './db.js';

const BACKUP_DIR = path.resolve(process.cwd(), 'data', 'backups');
const BACKUP_TABLES = [
  'users',
  'sessions',
  'active_dates',
  'movements',
  'inventory_items',
  'inventory_variants',
  'apartados',
  'caja_chica',
  'cierres_inventario',
  'cierres_caja',
  'calendar_days',
  'voucher_sequences',
  'cash_registers',
  'login_challenges',
  'audit_log',
  'otp_codes',
];

export async function ensureBackupDir(): Promise<string> {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  return BACKUP_DIR;
}

export async function createDatabaseBackup(): Promise<string> {
  await dbReady;
  await ensureBackupDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(BACKUP_DIR, `control-contable-${stamp}.json`);
  const tables = [];

  for (const name of BACKUP_TABLES) {
    const schema = await db.prepare(
      'SELECT sql FROM sqlite_master WHERE type = ? AND name = ?'
    ).get('table', name) as { sql: string } | undefined;
    if (!schema) continue;
    const rows = await db.prepare(`SELECT * FROM "${name}"`).all();
    tables.push({ name, schema: schema.sql, rows });
  }

  await fs.writeFile(filePath, JSON.stringify({
    format: 'control-contable-libsql-backup-v1',
    database: isRemoteDatabase ? 'turso' : 'sqlite-local',
    createdAt: new Date().toISOString(),
    tables,
  }), 'utf8');
  return filePath;
}

export async function listDatabaseBackups(): Promise<Array<{ name: string; size: number; createdAt: string }>> {
  await ensureBackupDir();
  const files = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
  const backups = await Promise.all(files
    .filter((entry) => entry.isFile() && /^control-contable-.+\.(?:json|sqlite3|db)$/i.test(entry.name))
    .map(async (entry) => {
      const stat = await fs.stat(path.join(BACKUP_DIR, entry.name));
      return { name: entry.name, size: stat.size, createdAt: stat.mtime.toISOString() };
    }));
  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getBackupPath(name: string): Promise<string | null> {
  if (!/^[a-zA-Z0-9_.-]+$/.test(name) || name.includes('..')) return null;
  const filePath = path.join(await ensureBackupDir(), name);
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() ? filePath : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export function startAutomaticBackups(): void {
  if (process.env.AUTO_BACKUP !== 'true') return;
  const intervalHours = Math.max(1, Number(process.env.AUTO_BACKUP_INTERVAL_HOURS) || 24);
  const createAndLogBackup = async () => {
    try {
      await createDatabaseBackup();
    } catch (error) {
      console.error('Error creando respaldo automático:', error);
    }
  };
  setInterval(() => { void createAndLogBackup(); }, intervalHours * 60 * 60 * 1000);
  if (process.env.AUTO_BACKUP_ON_START === 'true') void createAndLogBackup();
}
