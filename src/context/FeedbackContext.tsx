// ============================================================
// FeedbackContext.tsx
// Contexto global de retroalimentación visual: toasts y diálogos.
//
// Exports:
//   FeedbackProvider  — envuelve la aplicación y renderiza las
//                       notificaciones y el diálogo de confirmación.
//   useFeedback()     — hook que expone showToast() y confirm().
//
// Clases CSS utilizadas: definidas en css/feedback.css
//   • #toastStack / .toast-item / .toast-{tone} → pila de toasts
//   • .dlg-overlay / .dlg / .dlg-head / .dlg-body / .dlg-foot
//     → diálogo de confirmación modal
// ============================================================
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ── Tipos públicos ─────────────────────────────────────────
export type ToastTone = 'success' | 'danger' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'warning' | 'primary' | 'success';
}

interface FeedbackContextType {
  /**
   * Muestra una notificación flotante (toast) que desaparece automáticamente.
   * @param message  Texto del mensaje.
   * @param isError  Si es true el tono será 'danger' (a menos que se pase tone).
   * @param tone     Tono explícito: 'success' | 'danger' | 'warning' | 'info'.
   */
  showToast: (message: string, isError?: boolean, tone?: ToastTone) => void;
  /**
   * Abre un diálogo modal de confirmación. Devuelve una promesa que resuelve
   * true si el usuario confirma o false si cancela.
   */
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

// ── Iconos SVG por tono (sin dependencias externas) ────────
function ToastIcon({ tone }: { tone: ToastTone }) {
  const color =
    tone === 'success' ? 'var(--success)' :
    tone === 'danger'  ? 'var(--danger)'  :
    tone === 'warning' ? 'var(--warning)' :
    '#3b82f6'; // info = azul

  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {tone === 'success' && (
        <><circle cx="12" cy="12" r="10" /><path d="M8 12.5l2.7 2.7L16 9.5" /></>
      )}
      {tone === 'danger' && (
        <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>
      )}
      {tone === 'warning' && (
        <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>
      )}
      {tone === 'info' && (
        <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>
      )}
    </svg>
  );
}

// ── Icono SVG para el diálogo de confirmación ──────────────
function DialogIcon({ tone }: { tone?: string }) {
  if (tone === 'danger') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
  if (tone === 'warning') return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
  // primary / success / default
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><path d="M8 12.5l2.7 2.7L16 9.5" />
    </svg>
  );
}

// ── Proveedor ──────────────────────────────────────────────
export function FeedbackProvider({ children }: { children: ReactNode }) {
  // Lista de toasts activos; cada uno tiene id único, mensaje y tono.
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Estado del diálogo de confirmación (solo uno a la vez).
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    options: ConfirmDialogOptions;
    resolve?: (value: boolean) => void;
  }>({
    isOpen: false,
    options: { title: '', message: '' },
  });

  // ── showToast ──────────────────────────────────────────────
  // Agrega un toast a la pila y lo elimina automáticamente a los 3.8 s.
  const showToast = useCallback((message: string, isError = false, tone?: ToastTone) => {
    const finalTone: ToastTone = tone || (isError ? 'danger' : 'success');
    const id = Math.random().toString(36).substring(2, 9);

    setToasts((prev) => [...prev, { id, message, tone: finalTone }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  // ── confirm ────────────────────────────────────────────────
  // Abre el diálogo y devuelve una promesa que se resuelve cuando
  // el usuario elige Confirmar (true) o Cancelar (false).
  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({ isOpen: true, options, resolve });
    });
  }, []);

  // Cierra el diálogo y resuelve la promesa con el resultado.
  const handleDialogClose = (result: boolean) => {
    if (dialogState.resolve) {
      dialogState.resolve(result);
    }
    setDialogState({ isOpen: false, options: { title: '', message: '' } });
  };

  // Etiqueta de tono para el tag del toast (mayúsculas, breve)
  const toneLabel: Record<ToastTone, string> = {
    success: 'ÉXITO',
    danger:  'ERROR',
    warning: 'AVISO',
    info:    'INFO',
  };

  return (
    <FeedbackContext.Provider value={{ showToast, confirm }}>
      {children}

      {/* ── Pila de notificaciones flotantes (Toasts) ──────── */}
      {/* Posición: esquina superior derecha, z-index altísimo  */}
      <div
        id="toastStack"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Notificaciones del sistema"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-item toast-${toast.tone}`}
            role="alert"
          >
            {/* Ícono de tono */}
            <div className="t-ico">
              <ToastIcon tone={toast.tone} />
            </div>

            {/* Texto del mensaje */}
            <div className="t-msg-box">
              <span className="t-tag">{toneLabel[toast.tone]}</span>
              <span className="t-msg">{toast.message}</span>
            </div>

            {/* Botón de cierre manual */}
            <button
              type="button"
              className="t-close"
              aria-label="Cerrar notificación"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Barra de progreso de tiempo restante */}
            <div className="t-bar" style={{ '--t-life': '3800ms' } as React.CSSProperties} />
          </div>
        ))}
      </div>

      {/* ── Diálogo Modal de Confirmación ──────────────────── */}
      {dialogState.isOpen && (
        <div
          className="dlg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dlg-title-id"
          aria-describedby="dlg-body-id"
        >
          <div className={`dlg tone-${dialogState.options.tone || 'primary'}`}>
            {/* Cabecera con ícono y título */}
            <div className="dlg-head">
              <div className="dlg-ico">
                <DialogIcon tone={dialogState.options.tone} />
              </div>
              <h3 className="dlg-title" id="dlg-title-id">
                {dialogState.options.title}
              </h3>
            </div>

            {/* Cuerpo con el mensaje */}
            <div className="dlg-body" id="dlg-body-id">
              <p className="dlg-msg">{dialogState.options.message}</p>
            </div>

            {/* Pie con botones de acción */}
            <div className="dlg-foot">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => handleDialogClose(false)}
              >
                {dialogState.options.cancelText || 'Cancelar'}
              </button>
              <button
                type="button"
                className={`btn btn-${dialogState.options.tone === 'danger' ? 'danger' : 'primary'}`}
                onClick={() => handleDialogClose(true)}
              >
                {dialogState.options.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

// ── Hook de acceso al contexto ─────────────────────────────
export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback debe ser utilizado dentro de un FeedbackProvider');
  }
  return context;
}
