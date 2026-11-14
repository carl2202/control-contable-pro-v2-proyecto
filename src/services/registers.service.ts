// ============================================================
// registers.service.ts — Servicio de Cajas Registradoras
//
// Gestiona las cajas del sistema:
//   getRegisters()      — lista todas las cajas del tenant.
//   createRegister()    — crea una nueva caja (solo dueno).
//   toggleRegister()    — activa o desactiva una caja (solo dueno).
// ============================================================
import { apiRequest } from './api';

export interface Register {
  id: number;
  name: string;
  kind: 'operativa' | 'chica';
  active: boolean;
  balance: number;
  createdAt: string;
}

export interface CreateRegisterPayload {
  name: string;
  kind: 'operativa' | 'chica';
  openingBalance: number;
}

export const RegistersService = {
  /**
   * Obtiene la lista de cajas del sistema.
   */
  async getRegisters(): Promise<Register[]> {
    try {
      return await apiRequest<Register[]>('/registers');
    } catch (error) {
      console.error('Error al obtener cajas:', error);
      throw error;
    }
  },

  /**
   * Crea una nueva caja registradora (solo rol 'dueno').
   */
  async createRegister(payload: CreateRegisterPayload): Promise<{ success: boolean; id: number }> {
    try {
      return await apiRequest<{ success: boolean; id: number }>('/registers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Error al crear caja:', error);
      throw error;
    }
  },

  /**
   * Activa o desactiva una caja por su ID (solo rol 'dueno').
   */
  async toggleRegister(id: number, active: boolean): Promise<{ success: boolean }> {
    try {
      return await apiRequest<{ success: boolean }>(`/registers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      });
    } catch (error) {
      console.error(`Error al cambiar estado de caja #${id}:`, error);
      throw error;
    }
  },

  /**
   * Quita / elimina una caja registradora (solo rol 'dueno').
   */
  async deleteRegister(id: number): Promise<{ success: boolean; message: string }> {
    try {
      return await apiRequest<{ success: boolean; message: string }>(`/registers/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Error al quitar caja #${id}:`, error);
      throw error;
    }
  },
};
