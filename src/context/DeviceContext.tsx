// ============================================================
// DeviceContext.tsx
// Gestión y sincronización del modo de dispositivo:
// Permite alternar manualmente entre Computadora (Escritorio) y
// Teléfono (Móvil), o utilizar detección automática.
// ============================================================
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type DeviceMode = 'auto' | 'desktop' | 'mobile';

interface DeviceContextType {
  deviceMode: DeviceMode;
  isMobile: boolean;
  setDeviceMode: (mode: DeviceMode) => void;
  toggleDevice: () => void;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [deviceMode, setDeviceModeState] = useState<DeviceMode>(() => {
    if (typeof window === 'undefined') return 'auto';
    const saved = localStorage.getItem('contable_device_mode');
    return saved === 'desktop' || saved === 'mobile' || saved === 'auto' ? saved : 'auto';
  });

  const [autoIsMobile, setAutoIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setAutoIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = deviceMode === 'mobile' ? true : deviceMode === 'desktop' ? false : autoIsMobile;

  const setDeviceMode = (mode: DeviceMode) => {
    setDeviceModeState(mode);
    try {
      localStorage.setItem('contable_device_mode', mode);
    } catch {
      // Ignorar restricciones locales
    }
  };

  const toggleDevice = () => {
    setDeviceMode(isMobile ? 'desktop' : 'mobile');
  };

  // Aplicar clases globales al contenedor HTML/Body para reaccionar ordenadamente a nivel CSS
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const viewMode = isMobile ? 'phone' : 'desktop';
      const modeClasses = ['device-mobile', 'device-desktop', 'mode-phone', 'mode-desktop'];
      [document.documentElement, document.body].forEach((element) => {
        element.dataset.viewMode = viewMode;
        modeClasses.forEach((className) => element.classList.remove(className));
        element.classList.add(isMobile ? 'device-mobile' : 'device-desktop');
        element.classList.add(isMobile ? 'mode-phone' : 'mode-desktop');
      });
    }
  }, [isMobile]);

  return (
    <DeviceContext.Provider value={{ deviceMode, isMobile, setDeviceMode, toggleDevice }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const ctx = useContext(DeviceContext);
  if (!ctx) {
    throw new Error('useDevice debe usarse dentro de un DeviceProvider');
  }
  return ctx;
}

/**
 * Componente interactivo para cambiar entre Computadora y Teléfono
 */
export function DeviceSwitcher({ compact = false }: { compact?: boolean }) {
  const { deviceMode, isMobile, setDeviceMode } = useDevice();

  return (
    <div
      role="group"
      aria-label="Selector de dispositivo"
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        background: 'var(--surface-alt)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '2px',
        gap: '2px',
      }}
    >
      <button
        type="button"
        onClick={() => setDeviceMode('auto')}
        title="Modo Automático / Detectar dispositivo"
        aria-pressed={deviceMode === 'auto'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: compact ? '4px 8px' : '6px 10px',
          fontSize: '0.72rem',
          fontWeight: deviceMode === 'auto' ? 700 : 500,
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          background: deviceMode === 'auto' ? 'var(--primary)' : 'transparent',
          color: deviceMode === 'auto' ? '#FFFFFF' : 'var(--text-muted)',
          cursor: 'pointer',
          transition: 'all 0.16s ease',
          boxShadow: deviceMode === 'auto' ? '0 1px 3px rgba(79, 111, 82, 0.3)' : 'none',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
          <path d="m4.93 4.93 1.42 1.42M17.66 17.66l1.41 1.41M19.07 4.93l-1.41 1.42M6.34 17.66l-1.41 1.41" />
        </svg>
        <span>Automático</span>
      </button>

      <button
        type="button"
        onClick={() => setDeviceMode('desktop')}
        title="Modo Computadora / Pantalla Completa"
        aria-pressed={deviceMode === 'desktop'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: compact ? '4px 8px' : '6px 10px',
          fontSize: '0.72rem',
          fontWeight: deviceMode === 'desktop' ? 700 : 500,
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          background: deviceMode === 'desktop' ? 'var(--primary)' : 'transparent',
          color: deviceMode === 'desktop' ? '#FFFFFF' : 'var(--text-muted)',
          cursor: 'pointer',
          transition: 'all 0.16s ease',
          boxShadow: deviceMode === 'desktop' ? '0 1px 3px rgba(79, 111, 82, 0.3)' : 'none',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <span>Computadora</span>
      </button>

      <button
        type="button"
        onClick={() => setDeviceMode('mobile')}
        title="Modo Teléfono / Interfaz Compacta"
        aria-pressed={deviceMode === 'mobile'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: compact ? '4px 8px' : '6px 10px',
          fontSize: '0.72rem',
          fontWeight: deviceMode === 'mobile' ? 700 : 500,
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          background: deviceMode === 'mobile' ? 'var(--primary)' : 'transparent',
          color: deviceMode === 'mobile' ? '#FFFFFF' : 'var(--text-muted)',
          cursor: 'pointer',
          transition: 'all 0.16s ease',
          boxShadow: deviceMode === 'mobile' ? '0 1px 3px rgba(79, 111, 82, 0.3)' : 'none',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
        <span>Teléfono</span>
      </button>
    </div>
  );
}
