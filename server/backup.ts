import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';

const BACKUP_DIR = path.resolve(process.cwd(), 'data', 'backups');

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

export function ensureBackupDir(): string {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  return BACKUP_DIR;
}

export function createDatabaseBackup(): string {
  ensureBackupDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(BACKUP_DIR, `control-contable-${stamp}.sqlite3`);
  db.exec(`VACUUM INTO '${escapeSqlString(filePath)}'`);
  return filePath;
}

export function listDatabaseBackups(): Array<{ name: string; size: number; createdAt: string }> {
  ensureBackupDir();
  return fs.readdirSync(BACKUP_DIR)
    .filter((name) => /^control-contable-.+\.(sqlite3|db)$/i.test(name))
    .map((name) => {
      const filePath = path.join(BACKUP_DIR, name);
      const stat = fs.statSync(filePath);
      return { name, size: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getBackupPath(name: string): string | null {
  if (!/^[a-zA-Z0-9_.-]+$/.test(name) || name.includes('..')) return null;
  const filePath = path.join(ensureBackupDir(), name);
  return fs.existsSync(filePath) ? filePath : null;
}

export function startAutomaticBackups(): void {
  if (process.env.AUTO_BACKUP !== 'true') return;
  const intervalHours = Math.max(1, Number(process.env.AUTO_BACKUP_INTERVAL_HOURS) || 24);
  setInterval(() => {
    try {
      createDatabaseBackup();
    } catch (error) {
      console.error('Error creando respaldo automático:', error);
    }
  }, intervalHours * 60 * 60 * 1000);
  if (process.env.AUTO_BACKUP_ON_START === 'true') {
    try {
      createDatabaseBackup();
    } catch (error) {
      console.error('Error creando respaldo inicial:', error);
    }
  }
}
