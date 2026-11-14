// ============================================================
// CookieBanner.tsx
// Banner de consentimiento de cookies técnicas y de sesión.
//
// - Muestra el banner solo si 'ccp-cookies' !== 'accepted'.
// - Exporta useCookieConsent() → { consented: boolean }.
// - Animación interactiva de selección al hacer clic en cualquiera de las opciones.
// - Transición de salida suave (slide down + fade out).
// ============================================================
import React, { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'ccp-cookies';

export function useCookieConsent(): { consented: boolean } {
  const [consented, setConsented] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) === 'accepted'
  );

  useEffect(() => {
    const handler = () => {
      setConsented(localStorage.getItem(STORAGE_KEY) === 'accepted');
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return { consented };
}

export default function CookieBanner() {
  const [visible, setVisible] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) !== 'accepted'
  );
  const [selectedChoice, setSelectedChoice] = useState<'all' | 'essential' | null>(null);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const handleSelect = useCallback((choice: 'all' | 'essential') => {
    setSelectedChoice(choice);

    // Animación visual para que el usuario perciba claramente su elección
    setTimeout(() => {
      setIsClosing(true);
    }, 600);

    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, 'accepted');
      localStorage.setItem('ccp-cookie-preference', choice);
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
      setVisible(false);
    }, 950);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Banner de consentimiento de cookies"
      aria-modal="false"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
        fontFamily: 'var(--font-sans)',
        transform: isClosing ? 'translateY(100%)' : 'translateY(0)',
        opacity: isClosing ? 0 : 1,
        transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease',
      }}
    >
      {/* Ícono de cookie */}
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
        <path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01" />
      </svg>

      <p
        style={{
          margin: 0,
          flex: 1,
          fontSize: '0.82rem',
          color: 'var(--text-body)',
          lineHeight: 1.5,
          minWidth: '220px',
        }}
      >
        Usamos cookies técnicas esenciales para gestionar su sesión de trabajo de forma segura.
        No se usan cookies de rastreo ni publicidad.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
        {/* Botón Aceptar Cookies */}
        <button
          type="button"
          onClick={() => handleSelect('all')}
          disabled={selectedChoice !== null}
          style={{
            padding: '8px 18px',
            borderRadius: 'var(--radius-sm)',
            background: selectedChoice === 'all' ? '#2F4A38' : 'var(--primary)',
            border: selectedChoice === 'all' ? '1px solid #2F4A38' : '1px solid var(--primary)',
            color: '#fff',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: selectedChoice !== null ? 'default' : 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: 'var(--transition-smooth)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transform: selectedChoice === 'all' ? 'scale(1.05)' : selectedChoice === 'essential' ? 'scale(0.95)' : 'scale(1)',
            opacity: selectedChoice === 'essential' ? 0.4 : 1,
            boxShadow: selectedChoice === 'all' ? '0 0 12px rgba(79, 111, 82, 0.45)' : 'none',
          }}
        >
          {selectedChoice === 'all' ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>¡Aceptadas!</span>
            </>
          ) : (
            'Aceptar Cookies'
          )}
        </button>

        {/* Botón Solo esenciales */}
        <button
          type="button"
          onClick={() => handleSelect('essential')}
          disabled={selectedChoice !== null}
          style={{
            padding: '8px 18px',
            borderRadius: 'var(--radius-sm)',
            background: selectedChoice === 'essential' ? 'rgba(79, 111, 82, 0.15)' : 'transparent',
            border: selectedChoice === 'essential' ? '1px solid var(--primary)' : '1px solid var(--border)',
            color: selectedChoice === 'essential' ? 'var(--primary)' : 'var(--text-body)',
            fontSize: '0.8rem',
            fontWeight: 500,
            cursor: selectedChoice !== null ? 'default' : 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: 'var(--transition-smooth)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transform: selectedChoice === 'essential' ? 'scale(1.05)' : selectedChoice === 'all' ? 'scale(0.95)' : 'scale(1)',
            opacity: selectedChoice === 'all' ? 0.4 : 1,
            boxShadow: selectedChoice === 'essential' ? '0 0 10px rgba(79, 111, 82, 0.25)' : 'none',
          }}
        >
          {selectedChoice === 'essential' ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>¡Solo Esenciales!</span>
            </>
          ) : (
            'Solo esenciales'
          )}
        </button>
      </div>
    </div>
  );
}
