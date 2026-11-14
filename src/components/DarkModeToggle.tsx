// ============================================================
// DarkModeToggle.tsx
// Interruptor discreto de tema claro/oscuro.
//
// - Lee 'ccp-theme' de localStorage al montar.
// - Aplica data-theme al document.documentElement.
// - Persiste la preferencia en localStorage.
// - Ícono SVG inline de luna (oscuro) o sol (claro).
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export default function DarkModeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('ccp-theme') as Theme | null;
    return stored === 'dark' ? 'dark' : 'light';
  });

  // Aplica el tema al montar y cada vez que cambia
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('ccp-theme', theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      style={{
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(255,255,255,0.12)',
        border: '1px solid rgba(255,255,255,0.22)',
        color: '#FFFFFF',
        cursor: 'pointer',
        transition: 'var(--transition-smooth)',
        flexShrink: 0,
      }}
    >
      {isDark ? (
        /* Ícono sol — modo oscuro activo, clic pasa a claro */
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        /* Ícono luna — modo claro activo, clic pasa a oscuro */
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
