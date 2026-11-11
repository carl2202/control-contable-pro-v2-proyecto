export type Role = 'dueno' | 'empleado';

export interface User {
  id: number;
  username: string;
  role: Role;
  displayName: string;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface MovementItem {
  code: string;
  size: string;
  color: string;
  qty: number;
  price?: number;
}

export type MovementType = 'venta' | 'compra' | 'cajachica' | 'luz' | 'agua' | 'internet';
export type DocType = 'Factura' | 'Sin Comprobante' | 'CCF';

export interface Movement {
  id: number;
  date: string;
  type: MovementType;
  desc: string;
  amount: number;
  tax: number;
  doc: DocType;
  voucherCode?: string | null;
  voucherRecipient?: string | null;
  time: string;
  items?: MovementItem[] | null;
  ccId?: number | null;
  userRole?: string;
  _date?: string;
}

export interface InventoryVariant {
  size: string;
  color: string;
  cost: number;
  price: number;
  stock: number;
}

export interface InventoryItem {
  code: string;
  name: string;
  audience: string;
  category: string;
  variants: InventoryVariant[];
}

export type ApartadoStatus = 'apartado' | 'entregado';

export interface Apartado {
  id: number;
  clientName: string;
  prendaDesc: string;
  total: number;
  abono: number;
  status: ApartadoStatus;
  date: string;
  time: string;
}

export type CajaChicaType = 'ingreso' | 'gasto';

export interface CajaChicaMovement {
  id: number;
  type: CajaChicaType;
  category: string;
  desc: string;
  amount: number;
  date: string;
  time: string;
  userRole?: string;
}

export interface CajaChicaSummary {
  balance: number;
  totalIn: number;
  totalOut: number;
  movements: CajaChicaMovement[];
}

export interface CierreCaja {
  id: number;
  date: string;
  time: string;
  cashierName: string;
  cashierRole: string;
  openingFund: number;
  salesTotal: number;
  expensesTotal: number;
  expectedTotal: number;
  countedTotal: number;
  difference: number;
  breakdown: Record<string, number>;
  note?: string;
  createdAt?: string;
}

export interface CierreInventarioTotals {
  totalUnits: number;
  totalCostValue: number;
  totalSaleValue: number;
  potentialMargin: number;
}

export interface CierreInventario {
  id: number;
  date: string;
  time: string;
  scope: string;
  categories: string[];
  note?: string;
  totals: CierreInventarioTotals;
  items: InventoryItem[];
  userRole?: string;
}

export type CalendarStatus = 'laborado' | 'sinventas' | 'asueto';

export interface CalendarDayInfo {
  status: CalendarStatus;
  note: string;
}

export type CalendarMap = Record<string, CalendarDayInfo>;

export interface ChartDataPoint {
  date: string;
  sales: number;
  expenses: number;
}

export interface ReportsSummary {
  salesTotal: number;
  expensesTotal: number;
  salesTax: number;
  expensesTax: number;
  taxTotal: number;
  netProfit: number | null;
  isOwnerView: boolean;
  clothingPurchases: number;
  foodExpenses: number;
  utilityExpenses: number;
  otherExpenses: number;
  totalSpent: number;
  chartData: ChartDataPoint[];
}

export type ActiveModule = 'contable' | 'inventario' | 'apartados' | 'cajaChica' | 'reportes' | 'cierre' | 'calendario';
