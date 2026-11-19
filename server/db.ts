import { createClient, type Client, type Transaction, type InValue, type ResultSet } from '@libsql/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';

type RequestDatabaseContext = { transaction?: Transaction };
type QueryResult = Omit<ResultSet, 'lastInsertRowid'> & {
  lastInsertRowid: number | bigint;
  changes: number;
};
type BindValue = InValue | undefined;

const DB_DIR = path.resolve(process.cwd(), 'data');
fs.mkdirSync(DB_DIR, { recursive: true });

const localDbPath = path.join(DB_DIR, 'control_contable.db').replace(/\\/g, '/');
const localUrl = process.platform === 'win32' ? `file:/${localDbPath}` : `file:${localDbPath}`;
const remoteUrl = process.env.TURSO_DATABASE_URL?.trim();
const remoteToken = process.env.TURSO_AUTH_TOKEN?.trim();

if (Boolean(remoteUrl) !== Boolean(remoteToken)) {
  throw new Error('TURSO_DATABASE_URL y TURSO_AUTH_TOKEN deben configurarse juntos.');
}

export const isRemoteDatabase = Boolean(remoteUrl);
const client: Client = createClient({
  url: remoteUrl || localUrl,
  ...(remoteToken ? { authToken: remoteToken } : {}),
});

const requestContext = new AsyncLocalStorage<RequestDatabaseContext>();

function normalizeArgs(args: BindValue[]): InValue[] {
  return args.map((value) => value === undefined ? null : value);
}

async function execute(sql: string, args: BindValue[] = []): Promise<QueryResult> {
  const transaction = requestContext.getStore()?.transaction;
  const result = await (transaction || client).execute({ sql, args: normalizeArgs(args) });
  return {
    ...result,
    changes: result.rowsAffected,
    lastInsertRowid: result.lastInsertRowid ?? 0,
  };
}

export const db = {
  prepare(sql: string) {
    return {
      get: async (...args: BindValue[]): Promise<any> => {
        const result = await execute(sql, args);
        return result.rows[0];
      },
      all: async (...args: BindValue[]): Promise<any[]> => {
        const result = await execute(sql, args);
        return result.rows;
      },
      run: async (...args: BindValue[]) => execute(sql, args),
    };
  },
  async exec(sql: string): Promise<void> {
    const command = sql.trim().replace(/;$/, '').toUpperCase();
    const context = requestContext.getStore();
    if (command === 'BEGIN' || command === 'BEGIN TRANSACTION' || command === 'BEGIN IMMEDIATE') {
      if (!context) throw new Error('No hay contexto de solicitud para iniciar la transacción.');
      if (context.transaction) throw new Error('Ya existe una transacción activa para esta solicitud.');
      context.transaction = await client.transaction('write');
      return;
    }
    if (command === 'COMMIT' || command === 'END' || command === 'END TRANSACTION') {
      if (!context?.transaction) throw new Error('No hay una transacción activa para confirmar.');
      const transaction = context.transaction;
      context.transaction = undefined;
      await transaction.commit();
      return;
    }
    if (command === 'ROLLBACK') {
      if (!context?.transaction) throw new Error('No hay una transacción activa para revertir.');
      const transaction = context.transaction;
      context.transaction = undefined;
      await transaction.rollback();
      return;
    }
    await client.executeMultiple(sql);
  },
  async transaction<T>(callback: (transaction: Transaction) => Promise<T>): Promise<T> {
    const transaction = await client.transaction('write');
    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
  async close(): Promise<void> {
    await client.close();
  },
};

export function withDatabaseContext(req: unknown, res: unknown, next: (error?: unknown) => void): void {
  requestContext.run({}, next);
}

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  pin TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('dueno', 'empleado')), display_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, tenant_id INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1, email TEXT, phone TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, username TEXT NOT NULL, display_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME NOT NULL, last_seen_at DATETIME
);
CREATE TABLE IF NOT EXISTS active_dates (
  date TEXT NOT NULL, tenant_id INTEGER NOT NULL DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, date)
);
CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('venta', 'compra', 'cajachica', 'luz', 'agua', 'internet')),
  "desc" TEXT NOT NULL, amount REAL NOT NULL, tax REAL NOT NULL, doc TEXT NOT NULL,
  voucher_code TEXT, voucher_recipient TEXT, time TEXT NOT NULL, items_json TEXT, cc_id INTEGER,
  user_role TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, tenant_id INTEGER NOT NULL DEFAULT 1,
  register_id INTEGER, debit REAL NOT NULL DEFAULT 0, credit REAL NOT NULL DEFAULT 0,
  voided INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS inventory_items (
  code TEXT NOT NULL, name TEXT NOT NULL, audience TEXT NOT NULL, category TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  tenant_id INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (tenant_id, code)
);
CREATE TABLE IF NOT EXISTS inventory_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT, item_code TEXT NOT NULL, size TEXT NOT NULL, color TEXT NOT NULL,
  cost REAL NOT NULL, price REAL NOT NULL, stock INTEGER NOT NULL DEFAULT 0,
  tenant_id INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (item_code, tenant_id) REFERENCES inventory_items(code, tenant_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS apartados (
  id INTEGER PRIMARY KEY AUTOINCREMENT, client_name TEXT NOT NULL, prenda_desc TEXT NOT NULL,
  total REAL NOT NULL, abono REAL NOT NULL, status TEXT NOT NULL DEFAULT 'apartado',
  date TEXT NOT NULL, time TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  tenant_id INTEGER NOT NULL DEFAULT 1, due_date TEXT
);
CREATE TABLE IF NOT EXISTS caja_chica (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('ingreso', 'gasto')), category TEXT NOT NULL, "desc" TEXT NOT NULL,
  amount REAL NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, user_role TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, register_id INTEGER, voided INTEGER NOT NULL DEFAULT 0,
  tenant_id INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS cierres_inventario (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, time TEXT NOT NULL, scope TEXT NOT NULL,
  categories_json TEXT NOT NULL, note TEXT, totals_json TEXT NOT NULL, items_json TEXT NOT NULL,
  user_role TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, tenant_id INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS cierres_caja (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, time TEXT NOT NULL, cashier_name TEXT NOT NULL,
  cashier_role TEXT NOT NULL, opening_fund REAL NOT NULL, sales_total REAL NOT NULL,
  expenses_total REAL NOT NULL, expected_total REAL NOT NULL, counted_total REAL NOT NULL,
  difference REAL NOT NULL, breakdown_json TEXT NOT NULL, note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, tenant_id INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS calendar_days (
  date TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('laborado', 'sinventas', 'asueto')),
  note TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, tenant_id INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, date)
);
CREATE TABLE IF NOT EXISTS voucher_sequences (name TEXT PRIMARY KEY, next_val INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS cash_registers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('operativa', 'chica')), balance REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  tenant_id INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS login_challenges (
  id TEXT PRIMARY KEY, answer_hash TEXT NOT NULL, created_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT,
  detail TEXT, user_role TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, target TEXT NOT NULL, code TEXT NOT NULL, user_id INTEGER,
  expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, tenant_id INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

async function tableColumns(table: string): Promise<Set<string>> {
  const rows = await db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

async function ensureColumn(table: string, column: string, definition: string): Promise<void> {
  if (!(await tableColumns(table)).has(column)) {
    await db.exec(`ALTER TABLE "${table}" ADD COLUMN ${definition}`);
  }
}

async function migrateExistingSchema(): Promise<void> {
  const columns: Array<[string, string, string]> = [
    ['sessions', 'last_seen_at', 'last_seen_at DATETIME'],
    ['movements', 'register_id', 'register_id INTEGER'],
    ['movements', 'debit', 'debit REAL NOT NULL DEFAULT 0'],
    ['movements', 'credit', 'credit REAL NOT NULL DEFAULT 0'],
    ['movements', 'voided', 'voided INTEGER NOT NULL DEFAULT 0'],
    ['caja_chica', 'register_id', 'register_id INTEGER'],
    ['caja_chica', 'voided', 'voided INTEGER NOT NULL DEFAULT 0'],
    ['users', 'active', 'active INTEGER NOT NULL DEFAULT 1'],
    ['users', 'email', 'email TEXT'],
    ['users', 'phone', 'phone TEXT'],
    ['users', 'tenant_id', 'tenant_id INTEGER NOT NULL DEFAULT 1'],
    ['movements', 'tenant_id', 'tenant_id INTEGER NOT NULL DEFAULT 1'],
    ['inventory_items', 'tenant_id', 'tenant_id INTEGER NOT NULL DEFAULT 1'],
    ['inventory_variants', 'tenant_id', 'tenant_id INTEGER NOT NULL DEFAULT 1'],
    ['apartados', 'tenant_id', 'tenant_id INTEGER NOT NULL DEFAULT 1'],
    ['apartados', 'due_date', 'due_date TEXT'],
    ['caja_chica', 'tenant_id', 'tenant_id INTEGER NOT NULL DEFAULT 1'],
    ['cierres_inventario', 'tenant_id', 'tenant_id INTEGER NOT NULL DEFAULT 1'],
    ['cierres_caja', 'tenant_id', 'tenant_id INTEGER NOT NULL DEFAULT 1'],
    ['calendar_days', 'tenant_id', 'tenant_id INTEGER NOT NULL DEFAULT 1'],
    ['cash_registers', 'tenant_id', 'tenant_id INTEGER NOT NULL DEFAULT 1'],
    ['active_dates', 'tenant_id', 'tenant_id INTEGER NOT NULL DEFAULT 1'],
  ];
  for (const [table, column, definition] of columns) {
    await ensureColumn(table, column, definition);
  }

  await db.prepare("UPDATE users SET email = 'admin@tienda.com', phone = '70001122' WHERE role = 'dueno' AND (email IS NULL OR email = '')").run();
  await db.prepare("UPDATE users SET email = 'cajero@tienda.com', phone = '71112233' WHERE role = 'empleado' AND (email IS NULL OR email = '')").run();

  await migrateCompositeKey('active_dates', ['date', 'created_at'], `
    CREATE TABLE active_dates__new (
      date TEXT NOT NULL, tenant_id INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (tenant_id, date)
    )`, 'INSERT OR IGNORE INTO active_dates__new (date, tenant_id, created_at) SELECT date, COALESCE(tenant_id, 1), created_at FROM active_dates');
  await migrateCompositeKey('calendar_days', ['date', 'status', 'note', 'updated_at'], `
    CREATE TABLE calendar_days__new (
      date TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('laborado', 'sinventas', 'asueto')),
      note TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, tenant_id INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (tenant_id, date)
    )`, 'INSERT OR IGNORE INTO calendar_days__new (date, status, note, updated_at, tenant_id) SELECT date, status, note, updated_at, COALESCE(tenant_id, 1) FROM calendar_days');

  const inventoryInfo = await db.prepare('PRAGMA table_info("inventory_items")').all() as Array<{ name: string; pk: number }>;
  if (inventoryInfo.filter((column) => column.pk > 0).length === 1) {
    const foreignKeys = await db.prepare('PRAGMA foreign_key_list("inventory_variants")').all() as Array<{ table: string }>;
    if (foreignKeys.some((key) => key.table === 'inventory_items')) {
      await db.exec('PRAGMA foreign_keys = OFF');
      await db.exec('ALTER TABLE inventory_variants RENAME TO inventory_variants__old');
      await db.exec('ALTER TABLE inventory_items RENAME TO inventory_items__old');
      await db.exec(`CREATE TABLE inventory_items__new (
        code TEXT NOT NULL, name TEXT NOT NULL, audience TEXT NOT NULL, category TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        tenant_id INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (tenant_id, code)
      )`);
      await db.exec(`INSERT OR IGNORE INTO inventory_items__new
        SELECT code, name, audience, category, created_at, updated_at, COALESCE(tenant_id, 1) FROM inventory_items__old`);
      await db.exec(`CREATE TABLE inventory_variants__new (
        id INTEGER PRIMARY KEY AUTOINCREMENT, item_code TEXT NOT NULL, size TEXT NOT NULL, color TEXT NOT NULL,
        cost REAL NOT NULL, price REAL NOT NULL, stock INTEGER NOT NULL DEFAULT 0, tenant_id INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (item_code, tenant_id) REFERENCES inventory_items__new(code, tenant_id) ON DELETE CASCADE
      )`);
      await db.exec(`INSERT INTO inventory_variants__new (item_code,size,color,cost,price,stock,tenant_id)
        SELECT item_code,size,color,cost,price,stock,COALESCE(tenant_id,1) FROM inventory_variants__old`);
      await db.exec('DROP TABLE inventory_variants__old');
      await db.exec('DROP TABLE inventory_items__old');
      await db.exec('ALTER TABLE inventory_items__new RENAME TO inventory_items');
      await db.exec('ALTER TABLE inventory_variants__new RENAME TO inventory_variants');
      await db.exec('PRAGMA foreign_keys = ON');
    }
  }
}

async function migrateCompositeKey(
  table: string,
  _requiredColumns: string[],
  createSql: string,
  copySql: string
): Promise<void> {
  const info = await db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string; pk: number }>;
  if (info.filter((column) => column.pk > 0).length !== 1) return;
  const oldName = `${table}__old`;
  await db.exec(`ALTER TABLE "${table}" RENAME TO "${oldName}"`);
  await db.exec(createSql.replace(`${table}__new`, table));
  await db.exec(copySql.replace(`${table}__new`, table).replace(`FROM ${table}`, `FROM ${oldName}`));
  await db.exec(`DROP TABLE "${oldName}"`);
}

async function seedData(): Promise<void> {
  const users = await db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
  if (Number(users.count) === 0) {
    const insert = db.prepare(`INSERT INTO users (username,password_hash,pin,role,display_name,tenant_id)
      VALUES (?,?,?,?,?,?)`);
    await insert.run('dueno', 'admin123', '1234', 'dueno', 'Don Roberto (Dueño / Admin)', 1);
    await insert.run('empleado', 'caja123', '0000', 'empleado', 'Ana Martínez (Cajera / Empleada)', 1);
  }

  const today = new Date().toISOString().slice(0, 10);
  await db.prepare('INSERT OR IGNORE INTO active_dates (date, tenant_id) VALUES (?, 1)').run(today);

  const inventory = await db.prepare('SELECT COUNT(*) AS count FROM inventory_items WHERE tenant_id = 1').get() as { count: number };
  if (Number(inventory.count) === 0) {
    const items = [
      ['CAM-01','Camisa Oxford Manga Larga','Hombre','Camisa',[['M','Azul Celeste',12,24.5,8],['L','Blanco Puro',12,24.5,5],['S','Azul Marino',11.5,24.5,2]]],
      ['PAN-02','Pantalón Chino Slim Fit','Hombre','Pantalón',[['32','Beige Arena',15,32,6],['34','Negro',15,32,4]]],
      ['VES-03','Vestido Floral de Temporada','Mujer','Vestido',[['S','Floral Rosa',14.5,29.9,4],['M','Floral Amarillo',14.5,29.9,3]]],
      ['BLU-04','Blusa Casual de Lino','Mujer','Camisa',[['M','Blanco',9,18,7],['L','Verde Oliva',9,18,3]]],
      ['SHO-05','Short Denim Juvenil','Mujer','Short',[['28','Azul Claro',8.5,16.5,5],['30','Azul Medio',8.5,16.5,2]]],
    ] as Array<[string,string,string,string,Array<[string,string,number,number,number]>]>;
    const addItem = db.prepare('INSERT INTO inventory_items (code,name,audience,category,tenant_id) VALUES (?,?,?,?,1)');
    const addVariant = db.prepare('INSERT INTO inventory_variants (item_code,size,color,cost,price,stock,tenant_id) VALUES (?,?,?,?,?,?,1)');
    for (const [code,name,audience,category,variants] of items) {
      await addItem.run(code,name,audience,category);
      for (const [size,color,cost,price,stock] of variants) await addVariant.run(code,size,color,cost,price,stock);
    }
    await db.prepare(`INSERT INTO caja_chica (type,category,"desc",amount,date,time,user_role,tenant_id)
      VALUES ('ingreso','Inyección de Fondo','Fondo Inicial de Apertura de Caja Chica',100,?,'08:00 AM','dueno',1)`).run(today);
    await db.prepare(`INSERT INTO movements (date,type,"desc",amount,tax,doc,voucher_code,time,items_json,user_role,tenant_id)
      VALUES (?,'venta','Venta mostrador - CAM-01 x 1 [M]',24.5,3.19,'Factura',NULL,'09:15 AM',?,'empleado',1)`)
      .run(today, JSON.stringify([{code:'CAM-01',size:'M',color:'Azul Celeste',qty:1,price:24.5}]));
  }

  const registerCount = await db.prepare('SELECT COUNT(*) AS count FROM cash_registers WHERE tenant_id = 1').get() as { count: number };
  if (Number(registerCount.count) === 0) {
    await db.prepare("INSERT INTO cash_registers (name,kind,balance,active,tenant_id) VALUES ('Caja Principal','operativa',0,1,1)").run();
    const petty = await db.prepare("SELECT COALESCE(SUM(CASE WHEN type='ingreso' THEN amount ELSE -amount END),0) AS balance FROM caja_chica WHERE tenant_id=1 AND COALESCE(voided,0)=0").get() as { balance: number };
    await db.prepare("INSERT INTO cash_registers (name,kind,balance,active,tenant_id) VALUES ('Caja Chica','chica',?,1,1)").run(Number(petty.balance) || 0);
  }
}

export const dbReady: Promise<void> = (async () => {
  if (!isRemoteDatabase) await db.exec('PRAGMA foreign_keys = ON');
  await db.exec(schema);
  await migrateExistingSchema();
  await seedData();
})();

export async function getNextVoucherNumber(): Promise<string> {
  const row = await db.prepare('SELECT next_val FROM voucher_sequences WHERE name = ?').get('vale') as { next_val: number } | undefined;
  const next = Number(row?.next_val || 1);
  await db.prepare(`INSERT INTO voucher_sequences (name,next_val) VALUES ('vale',?)
    ON CONFLICT(name) DO UPDATE SET next_val=excluded.next_val`).run(next + 1);
  return `VLE-${String(next).padStart(4, '0')}`;
}

export async function ensureCashRegisters(): Promise<void> {
  const existing = await db.prepare('SELECT id FROM cash_registers WHERE tenant_id=1').all();
  if (existing.length) return;
  const cash = await db.prepare("SELECT COALESCE(SUM(CASE WHEN type='ingreso' THEN amount ELSE -amount END),0) AS balance FROM caja_chica WHERE tenant_id=1 AND COALESCE(voided,0)=0").get() as { balance: number };
  await db.prepare("INSERT INTO cash_registers (name,kind,balance,active,tenant_id) VALUES ('Caja Principal','operativa',0,1,1)").run();
  await db.prepare("INSERT INTO cash_registers (name,kind,balance,active,tenant_id) VALUES ('Caja Chica','chica',?,1,1)").run(Number(cash.balance) || 0);
}

export { client as libsqlClient };
