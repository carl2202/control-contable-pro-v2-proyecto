// ============================================================
// auth.service.ts — Servicio de Autenticación
//
// Envuelve las llamadas REST al backend para el flujo de sesión:
//   login()      POST /api/auth/login  — autentica con PIN + rol.
//   getMe()      GET  /api/auth/me     — valida el token actual.
//   logout()     POST /api/auth/logout — invalida la sesión.
//   getProfiles()GET  /api/auth/profiles — lista perfiles disponibles.
//
// El token recibido en login() se persiste en localStorage para
// que apiRequest() lo adjunte en cada petición posterior.
// ============================================================
import { apiRequest } from './api';
import { AuthSession, Role, User } from '../types';

export const AuthService = {
  /**
   * Autentica al usuario con un PIN y un rol.
   * Guarda el token y los datos del usuario en localStorage.
   * @throws ApiError si el PIN es incorrecto o hay error de red.
   */
  async login(credentials: { pin?: string; role?: Role; username?: string; password?: string }): Promise<AuthSession> {
    try {
      const data = await apiRequest<AuthSession>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      // Persistir credenciales para restaurar la sesión al recargar
      if (data.token) {
        localStorage.setItem('contable_token', data.token);
        localStorage.setItem('contable_user', JSON.stringify(data.user));
      }
      return data;
    } catch (error) {
      console.error('Error en AuthService.login:', error);
      throw error;
    }
  },

  /**
   * Verifica el token actual contra el servidor.
   * Si no hay token intenta restaurar el usuario desde localStorage.
   * Devuelve null si la sesión no es válida.
   */
  async getMe(): Promise<User | null> {
    try {
      const token = localStorage.getItem('contable_token');
      if (!token) {
        // Sin token: intentar restaurar solo desde caché local
        const saved = localStorage.getItem('contable_user');
        if (saved) {
          try { return JSON.parse(saved); }
          catch { return null; }
        }
        return null;
      }
      // Con token: validar contra el servidor
      const data = await apiRequest<{ user: User | null }>('/auth/me');
      if (data.user) {
        localStorage.setItem('contable_user', JSON.stringify(data.user));
      }
      return data.user;
    } catch (error) {
      console.warn('Sesión no válida o expirada:', error);
      return null;
    }
  },

  /**
   * Cierra la sesión en el servidor y limpia localStorage.
   * No lanza error aunque falle la petición de red.
   */
  async logout(): Promise<void> {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Ignorar errores de red en logout; limpiar local siempre
    } finally {
      localStorage.removeItem('contable_token');
      localStorage.removeItem('contable_user');
    }
  },

  /**
   * Obtiene la lista de perfiles de usuario disponibles en el sistema.
   * Usado para mostrar los roles disponibles en la pantalla de login.
   */
  async getProfiles(): Promise<User[]> {
    try {
      return await apiRequest<User[]>('/auth/profiles');
    } catch (error) {
      console.error('Error obteniendo perfiles de usuario:', error);
      return [];
    }
  },

  /**
   * Cambia la contraseña/PIN de un rol (Dueño o Empleado).
   * Requiere obligatoriamente el ingreso de la contraseña antigua para autorizar el cambio.
   */
  async changePassword(data: {
    targetRole: Role;
    oldPassword: string;
    newPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      return await apiRequest<{ success: boolean; message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Error en AuthService.changePassword:', error);
      throw error;
    }
  },
};
