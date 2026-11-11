// ============================================================
// AuthContext.tsx
// Contexto global de autenticación para Control Contable Pro.
//
// Gestiona:
//   • user   — objeto del usuario autenticado (o null si no hay sesión).
//   • token  — Bearer token almacenado en localStorage.
//   • loading — true mientras se verifica la sesión guardada al inicio.
//   • isOwner / isEmployee — atajos de rol para condicionales en la UI.
//
// Flujo de sesión:
//   1. Al montar, llama a AuthService.getMe() para validar el token
//      guardado en localStorage (si existe).
//   2. loginWithPin() invoca al servidor con PIN + rol y guarda el token.
//   3. logout() llama al servidor y limpia localStorage.
//   4. Si la API devuelve 401, el evento global 'auth:expired' dispara
//      la limpieza automática de la sesión (ver api.ts).
// ============================================================
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Role, User } from '../types';
import { AuthService } from '../services/auth.service';

// ── Interfaz del contexto ──────────────────────────────────
interface AuthContextType {
  /** Usuario autenticado actual (null = sin sesión). */
  user: User | null;
  /** Bearer token de la sesión actual (null = sin sesión). */
  token: string | null;
  /** True mientras AuthService.getMe() verifica la sesión al inicio. */
  loading: boolean;
  /** Atajo: true si el usuario tiene rol 'dueno'. */
  isOwner: boolean;
  /** Atajo: true si el usuario tiene rol 'empleado'. */
  isEmployee: boolean;
  /** Autentica con un PIN y un rol; devuelve {success, error?}. */
  loginWithPin: (pin: string, role?: Role) => Promise<{ success: boolean; error?: string }>;
  /** Cierra la sesión actual limpiando token y usuario. */
  logout: () => Promise<void>;
  /** Refresca los datos del usuario desde el servidor. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Proveedor ──────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  // Intentar restaurar la sesión desde localStorage al instanciar
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('contable_user');
    if (saved) {
      try { return JSON.parse(saved); }
      catch { return null; }
    }
    return null;
  });

  // Token Bearer almacenado en localStorage
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('contable_token')
  );

  // Loading inicial: true hasta que se valide (o descarte) la sesión guardada
  const [loading, setLoading] = useState<boolean>(true);

  // ── refreshUser ────────────────────────────────────────────
  // Consulta /auth/me para validar el token actual y actualizar
  // los datos del usuario. Si falla, limpia la sesión.
  const refreshUser = useCallback(async () => {
    try {
      const current = await AuthService.getMe();
      setUser(current);
      if (!current) setToken(null);
    } catch {
      // Token inválido o error de red: limpiar sesión
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Verificar sesión al montar + escuchar el evento de expiración global
  useEffect(() => {
    refreshUser();

    // El cliente api.ts emite 'auth:expired' cuando recibe HTTP 401
    const handleExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, [refreshUser]);

  // ── loginWithPin ───────────────────────────────────────────
  // Llama al servidor con el PIN y el rol seleccionado.
  // Si es exitoso actualiza user y token; si falla devuelve el error.
  const loginWithPin = async (
    pin: string,
    role?: Role
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const data = await AuthService.login({ pin, role });
      setUser(data.user);
      setToken(data.token);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Error al iniciar sesión. Verifique el PIN.',
      };
    }
  };

  // ── logout ─────────────────────────────────────────────────
  // Invalida la sesión en el servidor y limpia el estado local.
  const logout = async () => {
    await AuthService.logout();
    setUser(null);
    setToken(null);
  };

  // Atajos de rol para condicionales simples en la UI
  const isOwner    = user?.role === 'dueno';
  const isEmployee = user?.role === 'empleado';

  return (
    <AuthContext.Provider
      value={{ user, token, loading, isOwner, isEmployee, loginWithPin, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook de acceso al contexto ─────────────────────────────
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}
