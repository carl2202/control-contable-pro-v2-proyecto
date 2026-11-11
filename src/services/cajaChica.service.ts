// ============================================================
// cajaChica.service.ts — Servicio de Caja Chica
//
// Gestiona el fondo operativo para gastos menores del día:
//   getSummary()     — obtiene balance actual e historial de movimientos.
//   addMovement()    — registra un ingreso o gasto en caja chica.
//   deleteMovement() — elimina un movimiento (solo Dueño).
//
// Regla de negocio RN-06:
//   El backend rechaza cualquier operación que deje el balance
//   de caja chica en negativo (HTTP 400 con mensaje descriptivo).
// ============================================================
import { apiRequest } from './api';
import { CajaChicaSummary, CajaChicaType } from '../types';

/** Payload para agregar un ingreso o gasto a caja chica */
export interface AddCajaChicaPayload {
  type: CajaChicaType;   // 'ingreso' | 'gasto'
  category: string;      // Categoría del gasto (ej. 'Alimentación', 'Papelería')
  desc: string;          // Descripción breve del movimiento
  amount: number;        // Monto en USD
  date?: string;         // Fecha ISO (YYYY-MM-DD); si se omite usa la fecha actual
  time?: string;         // Hora (HH:MM AM/PM)
}

export const CajaChicaService = {
  /**
   * Obtiene el balance actual de caja chica y el historial de movimientos.
   * Devuelve valores en cero en caso de error (tolerancia a fallos en la UI).
   */
  async getSummary(): Promise<CajaChicaSummary> {
    try {
      return await apiRequest<CajaChicaSummary>('/caja-chica');
    } catch (error) {
      console.error('Error al obtener estado de caja chica:', error);
      return { balance: 0, totalIn: 0, totalOut: 0, movements: [] };
    }
  },

  /**
   * Registra un nuevo ingreso o gasto en caja chica.
   * El backend valida que el saldo no quede negativo (RN-06).
   * @throws ApiError si el monto supera el saldo disponible.
   */
  async addMovement(payload: AddCajaChicaPayload): Promise<{ success: boolean; id: number }> {
    try {
      return await apiRequest<{ success: boolean; id: number }>('/caja-chica', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Error al registrar movimiento en caja chica:', error);
      throw error;
    }
  },

  /**
   * Elimina un movimiento de caja chica (solo rol 'dueno').
   * El backend valida que el saldo resultante no sea negativo.
   */
  async deleteMovement(id: number): Promise<{ success: boolean; message: string }> {
    try {
      return await apiRequest<{ success: boolean; message: string }>(`/caja-chica/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Error al eliminar movimiento #${id} de caja chica:`, error);
      throw error;
    }
  },
};
