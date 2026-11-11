// ============================================================
// cierres.service.ts — Servicio de Cierres y Arqueos
//
// Gestiona los cierres de caja (arqueos diarios) y los cierres
// de inventario (snapshots valorizados del stock):
//
// CIERRES DE CAJA (arqueos):
//   getCajaClosures()      — historial de arqueos de caja.
//   createCajaClosure()    — registra un nuevo arqueo con desglose de billetes.
//   deleteCajaClosure()    — elimina un arqueo (solo Dueño).
//
// CIERRES DE INVENTARIO (snapshots):
//   getInventoryClosures() — historial de snapshots valorizados.
//   createInventoryClosure()— captura el stock y valor del inventario actual.
//   deleteInventoryClosure()— elimina un snapshot (solo Dueño).
//
// Los snapshots guardan: unidades, costo total, precio de venta y margen.
// Solo el Dueño puede ver el margen potencial (campo potentialMargin).
// ============================================================
import { apiRequest } from './api';
import { CierreCaja, CierreInventario } from '../types';

export const CierresService = {
  // ── Cierres de Caja (Arqueos Diarios) ──────────────────────

  /** Obtiene el historial completo de arqueos de caja registrados. */
  async getCajaClosures(): Promise<CierreCaja[]> {
    try {
      return await apiRequest<CierreCaja[]>('/cierres/caja');
    } catch (error) {
      console.error('Error al obtener cierres de caja:', error);
      return [];
    }
  },

  /**
   * Registra un nuevo arqueo de caja con desglose de billetes y monedas.
   * Calcula automáticamente la diferencia entre el esperado y lo contado.
   */
  async createCajaClosure(payload: Partial<CierreCaja>): Promise<{ success: boolean; id: number }> {
    try {
      return await apiRequest<{ success: boolean; id: number }>('/cierres/caja', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Error al registrar arqueo de caja:', error);
      throw error;
    }
  },

  /**
   * Elimina un arqueo de caja del historial (solo rol 'dueno').
   */
  async deleteCajaClosure(id: number): Promise<{ success: boolean; message: string }> {
    try {
      return await apiRequest<{ success: boolean; message: string }>(`/cierres/caja/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Error al eliminar arqueo #${id}:`, error);
      throw error;
    }
  },

  // ── Cierres de Inventario (Snapshots Valorizados) ───────────

  /** Obtiene el historial de snapshots de inventario con sus totales. */
  async getInventoryClosures(): Promise<CierreInventario[]> {
    try {
      return await apiRequest<CierreInventario[]>('/cierres/inventario');
    } catch (error) {
      console.error('Error al obtener cierres de inventario:', error);
      return [];
    }
  },

  /**
   * Captura el estado actual del inventario y lo guarda como snapshot.
   * Incluye: unidades totales, valor al costo y valor al precio de venta.
   */
  async createInventoryClosure(payload: Partial<CierreInventario>): Promise<{ success: boolean; id: number }> {
    try {
      return await apiRequest<{ success: boolean; id: number }>('/cierres/inventario', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Error al registrar cierre de inventario:', error);
      throw error;
    }
  },

  /**
   * Elimina un snapshot de inventario del historial (solo rol 'dueno').
   */
  async deleteInventoryClosure(id: number): Promise<{ success: boolean; message: string }> {
    try {
      return await apiRequest<{ success: boolean; message: string }>(`/cierres/inventario/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Error al eliminar cierre de inventario #${id}:`, error);
      throw error;
    }
  },
};
