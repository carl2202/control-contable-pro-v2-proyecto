// ============================================================
// api.ts — Cliente HTTP base autenticado
//
// • Prefija '/api' a cada endpoint.
// • Adjunta el Bearer token de localStorage en cada petición.
// • Si recibe HTTP 401 limpia la sesión y emite 'auth:expired'.
// • Convierte errores de red en ApiError con mensajes amigables.
// ============================================================

const API_BASE = '/api';
const API_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function expireSession(): void {
  try {
    localStorage.removeItem('contable_token');
    localStorage.removeItem('contable_user');
  } catch (error) {
    console.warn('No se pudo limpiar la sesión local:', error);
  }
  window.dispatchEvent(new CustomEvent('auth:expired'));
}

function getErrorDetails(data: unknown, response: Response): string {
  if (data && typeof data === 'object') {
    const payload = data as Record<string, unknown>;
    if (typeof payload.error === 'string') return payload.error;
    if (typeof payload.message === 'string') return payload.message;
  }
  return `Error ${response.status}${response.statusText ? `: ${response.statusText}` : ''}`;
}

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutSignal = options.signal;
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();

  if (timeoutSignal?.aborted) {
    controller.abort();
  } else {
    timeoutSignal?.addEventListener('abort', forwardAbort, { once: true });
  }

  try {
    const token = localStorage.getItem('contable_token');
    const headers = new Headers(options.headers);
    if (options.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      let data: unknown = {};
      if (body) {
        try {
          data = JSON.parse(body);
        } catch {
          data = { message: body.slice(0, 300) };
        }
      }

      if (response.status === 401) expireSession();
      throw new ApiError(getErrorDetails(data, response), response.status, data);
    }

    return response;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (timedOut) {
      throw new ApiError('El servidor tardó demasiado en responder. Verifica tu conexión e inténtalo de nuevo.', 0);
    }
    if (timeoutSignal?.aborted) {
      throw new ApiError('La solicitud fue cancelada.', 0);
    }

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const message = isOffline
      ? 'No se pudo conectar con el servidor. Verifica tu conexión de red.'
      : 'No se pudo completar la solicitud. Verifica tu conexión e inténtalo de nuevo.';
    console.error(`[API Network Error] ${endpoint}:`, error);
    throw new ApiError(message, 0);
  } finally {
    window.clearTimeout(timeoutId);
    timeoutSignal?.removeEventListener('abort', forwardAbort);
  }
}

export async function apiRequest<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(endpoint, options);
  const body = await response.text();
  if (!body) return null as T;

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new ApiError('El servidor devolvió una respuesta no válida.', response.status, body.slice(0, 300));
  }
}
