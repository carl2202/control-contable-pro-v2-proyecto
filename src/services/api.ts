// ============================================================
// api.ts — Cliente HTTP base autenticado
//
// • Prefija '/api' a cada endpoint.
// • Adjunta el Bearer token de localStorage en cada petición.
// • Si recibe HTTP 401 limpia la sesión y emite 'auth:expired'.
// • Convierte errores de red en ApiError con mensajes amigables.
// ============================================================

const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('contable_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('contable_token');
        localStorage.removeItem('contable_user');
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
      const message = data.error || data.message || `Error ${res.status}: ${res.statusText}`;
      throw new ApiError(message, res.status, data);
    }

    return data as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    // Network or connectivity error
    const netError = new ApiError(
      err.message === 'Failed to fetch' || !navigator.onLine
        ? 'No se pudo conectar con el servidor. Verifica tu conexión de red.'
        : (err.message || 'Error inesperado de comunicación con la API.'),
      0
    );
    console.error(`[API Network Error] ${endpoint}:`, err);
    throw netError;
  }
}
