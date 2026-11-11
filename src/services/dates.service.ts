// ============================================================
// dates.service.ts — Servicio de Fechas Activas
//
// Las "fechas activas" son las pestañas del módulo Contable (F1).
// Cada fecha activa es una pestaña desde la que se pueden registrar
// y ver movimientos de ese día específico.
//
//   getAll()   — lista todas las fechas activas como strings ISO.
//   add()      — agrega una nueva fecha activa (crea la pestaña).
//   remove()   — elimina una fecha (solo Dueño).
//
// La fecha actual siempre está incluida; el backend la garantiza.
// ============================================================
import { apiRequest } from './api';

export const DatesService = {
  /**
   * Obtiene todas las fechas activas (pestañas del módulo Contable).
   * @returns Array de strings ISO 'YYYY-MM-DD' en orden descendente.
   */
  async getAll(): Promise<string[]> {
    try {
      return await apiRequest<string[]>('/dates');
    } catch (error) {
      console.error('Error al obtener fechas activas:', error);
      return [];
    }
  },

  /**
   * Agrega una nueva fecha activa al sistema (crea una pestaña nueva).
   * @param date  Fecha ISO 'YYYY-MM-DD'.
   */
  async add(date: string): Promise<{ success: boolean; date: string }> {
    try {
      return await apiRequest<{ success: boolean; date: string }>('/dates', {
        method: 'POST',
        body: JSON.stringify({ date }),
      });
    } catch (error) {
      console.error('Error al registrar fecha activa:', error);
      throw error;
    }
  },

  /**
   * Elimina una fecha activa (solo rol 'dueno').
   * No elimina los movimientos de esa fecha; solo la pestaña.
   */
  async remove(date: string): Promise<{ success: boolean; message: string }> {
    try {
      return await apiRequest<{ success: boolean; message: string }>(
        `/dates/${encodeURIComponent(date)}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      console.error(`Error al eliminar fecha ${date}:`, error);
      throw error;
    }
  },
};
