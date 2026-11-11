import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'control_contable.db');
export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode & foreign keys for concurrency and relational integrity
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    pin TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('dueno', 'empleado')),
    display_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  );

  CREATE TABLE IF NOT EXISTS active_dates (
    date TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('venta', 'compra', 'cajachica', 'luz', 'agua', 'internet')),
    desc TEXT NOT NULL,
    amount REAL NOT NULL,
    tax REAL NOT NULL,
    doc TEXT NOT NULL,
    voucher_code TEXT,
    voucher_recipient TEXT,
    time TEXT NOT NULL,
    items_json TEXT,
    cc_id INTEGER,
    user_role TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory_items (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    audience TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code TEXT NOT NULL REFERENCES inventory_items(code) ON DELETE CASCADE,
    size TEXT NOT NULL,
    color TEXT NOT NULL,
    cost REAL NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS apartados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    prenda_desc TEXT NOT NULL,
    total REAL NOT NULL,
    abono REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'apartado',
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS caja_chica (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('ingreso', 'gasto')),
    category TEXT NOT NULL,
    desc TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    user_role TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cierres_inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    scope TEXT NOT NULL,
    categories_json TEXT NOT NULL,
    note TEXT,
    totals_json TEXT NOT NULL,
    items_json TEXT NOT NULL,
    user_role TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cierres_caja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    cashier_name TEXT NOT NULL,
    cashier_role TEXT NOT NULL,
    opening_fund REAL NOT NULL,
    sales_total REAL NOT NULL,
    expenses_total REAL NOT NULL,
    expected_total REAL NOT NULL,
    counted_total REAL NOT NULL,
    difference REAL NOT NULL,
    breakdown_json TEXT NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS calendar_days (
    date TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK(status IN ('laborado', 'sinventas', 'asueto')),
    note TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS voucher_sequences (
    name TEXT PRIMARY KEY,
    next_val INTEGER NOT NULL DEFAULT 1
  );
`);

// Seed default users if none exist
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, pin, role, display_name)
    VALUES (?, ?, ?, ?, ?)
  `);
  // Seed Dueño (Owner) - PIN: 1234
  insertUser.run('dueno', 'admin123', '1234', 'dueno', 'Don Roberto (Dueño / Admin)');
  // Seed Empleado (Employee) - PIN: 0000
  insertUser.run('empleado', 'caja123', '0000', 'empleado', 'Ana Martínez (Cajera / Empleada)');
}

// Seed default active date (today) if none
const todayIso = new Date().toISOString().slice(0, 10);
const dateExists = db.prepare('SELECT date FROM active_dates WHERE date = ?').get(todayIso);
if (!dateExists) {
  db.prepare('INSERT INTO active_dates (date) VALUES (?)').run(todayIso);
}

// Seed initial inventory items if empty so store has immediate apparel data
const invCount = db.prepare('SELECT COUNT(*) as count FROM inventory_items').get() as { count: number };
if (invCount.count === 0) {
  const insertItem = db.prepare(`
    INSERT INTO inventory_items (code, name, audience, category)
    VALUES (?, ?, ?, ?)
  `);
  const insertVariant = db.prepare(`
    INSERT INTO inventory_variants (item_code, size, color, cost, price, stock)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const initialItems = [
    {
      code: 'CAM-01',
      name: 'Camisa Oxford Manga Larga',
      audience: 'Hombre',
      category: 'Camisa',
      variants: [
        { size: 'M', color: 'Azul Celeste', cost: 12.00, price: 24.50, stock: 8 },
        { size: 'L', color: 'Blanco Puro', cost: 12.00, price: 24.50, stock: 5 },
        { size: 'S', color: 'Azul Marino', cost: 11.50, price: 24.50, stock: 2 }
      ]
    },
    {
      code: 'PAN-02',
      name: 'Pantalón Chino Slim Fit',
      audience: 'Hombre',
      category: 'Pantalón',
      variants: [
        { size: '32', color: 'Beige Arena', cost: 15.00, price: 32.00, stock: 6 },
        { size: '34', color: 'Negro', cost: 15.00, price: 32.00, stock: 4 }
      ]
    },
    {
      code: 'VES-03',
      name: 'Vestido Floral de Temporada',
      audience: 'Mujer',
      category: 'Vestido',
      variants: [
        { size: 'S', color: 'Floral Rosa', cost: 14.50, price: 29.90, stock: 4 },
        { size: 'M', color: 'Floral Amarillo', cost: 14.50, price: 29.90, stock: 3 }
      ]
    },
    {
      code: 'BLU-04',
      name: 'Blusa Casual de Lino',
      audience: 'Mujer',
      category: 'Camisa',
      variants: [
        { size: 'M', color: 'Blanco', cost: 9.00, price: 18.00, stock: 7 },
        { size: 'L', color: 'Verde Oliva', cost: 9.00, price: 18.00, stock: 3 }
      ]
    },
    {
      code: 'SHO-05',
      name: 'Short Denim Juvenil',
      audience: 'Mujer',
      category: 'Short',
      variants: [
        { size: '28', color: 'Azul Claro', cost: 8.50, price: 16.50, stock: 5 },
        { size: '30', color: 'Azul Medio', cost: 8.50, price: 16.50, stock: 2 }
      ]
    }
  ];

  for (const item of initialItems) {
    insertItem.run(item.code, item.name, item.audience, item.category);
    for (const v of item.variants) {
      insertVariant.run(item.code, v.size, v.color, v.cost, v.price, v.stock);
    }
  }

  // Seed sample initial petty cash fund ($100.00)
  const ccCount = db.prepare('SELECT COUNT(*) as count FROM caja_chica').get() as { count: number };
  if (ccCount.count === 0) {
    db.prepare(`
      INSERT INTO caja_chica (type, category, desc, amount, date, time, user_role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('ingreso', 'Inyección de Fondo', 'Fondo Inicial de Apertura de Caja Chica', 100.00, todayIso, '08:00 AM', 'dueno');
  }

  // Seed sample opening day movements
  db.prepare(`
    INSERT INTO movements (date, type, desc, amount, tax, doc, voucher_code, time, items_json, user_role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    todayIso,
    'venta',
    'Venta mostrador - CAM-01 x 1 [M]',
    24.50,
    3.19,
    'Factura',
    null,
    '09:15 AM',
    JSON.stringify([{ code: 'CAM-01', size: 'M', color: 'Azul Celeste', qty: 1, price: 24.50 }]),
    'empleado'
  );
}

// Function to generate sequential internal voucher number (Vale de caja interno)
export function getNextVoucherNumber(): string {
  const row = db.prepare('SELECT next_val FROM voucher_sequences WHERE name = ?').get('vale') as { next_val: number } | undefined;
  let nextVal = 1;
  if (!row) {
    db.prepare('INSERT INTO voucher_sequences (name, next_val) VALUES (?, ?)').run('vale', 2);
  } else {
    nextVal = row.next_val;
    db.prepare('UPDATE voucher_sequences SET next_val = ? WHERE name = ?').run(nextVal + 1, 'vale');
  }
  return `VLE-${String(nextVal).padStart(4, '0')}`;
}
