// ============================================================
// movements.service.ts — Servicio de Movimientos Contables
//
// Gestiona los movimientos de ventas, compras y servicios:
//   getByDate() — lista movimientos filtrados por fecha y/o búsqueda.
//   create()    — registra un nuevo movimiento (descuenta stock en ventas).
//   delete()    — elimina un movimiento (solo Dueño; restaura stock en ventas).
//
// Reglas de negocio aplicadas en el backend (ver server/routes.ts):
//   RN-02: IVA 13% → amount / 1.13 * 0.13
//   RN-03: "Sin Comprobante" genera correlativo VLE-XXXX
//   RN-04: venta descuenta stock; delete restaura stock
// ============================================================
import { apiRequest } from './api';
import { Movement } from '../types';

/** Payload para crear un nuevo movimiento contable */
export interface CreateMovementPayload {
  date: string;             // Fecha ISO (YYYY-MM-DD)
  type: string;             // 'venta' | 'compra' | 'cajachica' | 'luz' | 'agua' | 'internet'
  desc: string;             // Descripción del movimiento
  amount: number;           // Monto total (IVA incluido)
  tax?: number;             // IVA calculado (amount / 1.13 * 0.13)
  doc: string;              // 'Factura' | 'Sin Comprobante' | 'CCF'
  time?: string;            // Hora (HH:MM AM/PM), si no se envía el backend usa la hora actual
  items?: any[] | null;     // Variantes vendidas [{code, size, color, qty, price}]
  isCajaChica?: boolean;    // Si true, crea también un movimiento en caja_chica
  ccCategory?: string;      // Categoría para el movimiento de caja chica
  voucherRecipient?: string;// Nombre del receptor del vale interno (Solo Comprobante)
}

export const MovementsService = {
  /**
   * Obtiene todos los movimientos de una fecha específica.
   * Si date = 'TODOS' devuelve todos los movimientos acumulados.
   * El parámetro search filtra por descripción o código de producto.
   */
  async getByDate(date?: string, search?: string): Promise<Movement[]> {
    try {
      const params = new URLSearchParams();
      if (date)   params.append('date', date);
      if (search) params.append('search', search);
      return await apiRequest<Movement[]>(`/movements?${params.toString()}`);
    } catch (error) {
      console.error('Error al obtener movimientos contables:', error);
      throw error;
    }
  },

  /**
   * Registra un nuevo movimiento contable.
   * Para ventas descuenta el stock de las variantes involucradas.
   * @returns id del movimiento creado y voucherCode si aplica.
   */
  async create(payload: CreateMovementPayload): Promise<{ success: boolean; id: number; voucherCode?: string }> {
    try {
      return await apiRequest<{ success: boolean; id: number; voucherCode?: string }>('/movements', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Error al crear movimiento contable:', error);
      throw error;
    }
  },

  /**
   * Elimina un movimiento (solo rol 'dueno').
   * Para ventas, restaura automáticamente el stock de las variantes.
   */
  async delete(id: number): Promise<{ success: boolean; message: string }> {
    try {
      return await apiRequest<{ success: boolean; message: string }>(`/movements/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Error al eliminar movimiento #${id}:`, error);
      throw error;
    }
  },
};
