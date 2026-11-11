// ============================================================
// reports.service.ts — Servicio de Reportes Financieros
//
// Obtiene el balance financiero consolidado para el módulo F5.
// El servidor filtra los datos según el rol del usuario:
//   • Dueño: ve margen neto, costo de compras y detalle completo.
//   • Empleado: ve solo ventas y gastos operativos (sin margen).
//
// getSummary(date?) — obtiene el resumen financiero.
//   Si date es omitido, devuelve el acumulado de todos los períodos.
//   El campo isOwnerView indica si la vista incluye datos sensibles.
// ============================================================
import { apiRequest } from './api';
import { ReportsSummary } from '../types';

export const ReportsService = {
  /**
   * Obtiene el resumen financiero del sistema.
   * @param date  Fecha ISO opcional para filtrar por período.
   *              Si se omite, devuelve el acumulado total.
   * @returns ReportsSummary con ventas, gastos, IVA y (si es Dueño) margen neto.
   */
  async getSummary(date?: string): Promise<ReportsSummary> {
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      return await apiRequest<ReportsSummary>(`/reports/summary?${params.toString()}`);
    } catch (error) {
      console.error('Error al obtener reporte financiero:', error);
      // Devolver estructura vacía para que la UI no se rompa
      return {
        salesTotal:        0,
        expensesTotal:     0,
        salesTax:          0,
        expensesTax:       0,
        taxTotal:          0,
        netProfit:         null,
        isOwnerView:       false,
        clothingPurchases: 0,
        foodExpenses:      0,
        utilityExpenses:   0,
        otherExpenses:     0,
        totalSpent:        0,
        chartData:         [],
      };
    }
  },
};
