// ============================================================
// users.service.ts — Servicio de Gestión de Usuarios
//
// Funciones:
//   getUsers()         — lista usuarios del sistema (solo dueno).
//   resetPassword()    — restablece el PIN de un usuario (solo dueno).
// ============================================================
import { apiRequest } from './api';
import { User } from '../types';

export interface SystemUser extends User {
  active?: boolean;
}

export const UsersService = {
  /**
   * Obtiene la lista de usuarios del sistema.
   * Solo accesible por el rol 'dueno'.
   */
  async getUsers(): Promise<SystemUser[]> {
    try {
      return await apiRequest<SystemUser[]>('/auth/users');
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }
  },

  /**
   * Restablece el PIN y la credencial asociada de un usuario.
   * Solo el rol 'dueno' puede ejecutar esta acción.
   */
  async resetPassword(
    userId: number,
    newPin: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      return await apiRequest<{ success: boolean; message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ userId, newPassword: newPin }),
      });
    } catch (error) {
      console.error(`Error al restablecer el PIN del usuario #${userId}:`, error);
      throw error;
    }
  },
};
