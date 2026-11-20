// ============================================================
// Header.tsx
// Encabezado principal de la aplicación con soporte para:
//   • Indicador de sincronización en la nube (SyncIndicator)
//   • Interruptor discreto de modo claro / oscuro (DarkModeToggle)
//   • Acceso rápido al buscador global (Ctrl + K)
//   • Navegación adaptativa para dispositivos móviles y escritorio
// ============================================================
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { DeviceSwitcher } from '../context/DeviceContext';
import DarkModeToggle from './DarkModeToggle';
import SyncIndicator from './SyncIndicator';

interface HeaderProps {
  onOpenLogin: () => void;
  onExportCSV: () => void;
  onOpenSearch?: () => void;
  onToggleSidebar?: () => void;
}

export function Header({ onOpenLogin, onExportCSV, onOpenSearch, onToggleSidebar }: HeaderProps) {
  const { user, logout, isOwner } = useAuth();
  const { showToast } = useFeedback();

  // Cerrar sesión con confirmación visual via toast
  const handleLogout = async () => {
    await logout();
    showToast('Sesión cerrada correctamente.', false, 'info');
  };

  return (
    <header className="mb-4" role="banner" style={{ transition: 'var(--transition-smooth)' }}>
      {/* ── Área de marca ── */}
      <div className="terminal-brand-area">
        {/* Barra superior con status, sincronización y tema */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
          {/* Botón hamburguesa móvil */}
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="btn btn-outline header-menu-toggle"
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '40px',
                minHeight: '36px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#FFFFFF',
              }}
              aria-label="Abrir menú de navegación móvil"
              title="Módulos del Sistema"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          )}

          {/* Insignia "SISTEMA ACTIVO" */}
          <div className="terminal-sys-badge" aria-label="Sistema operativo">
            <span className="sys-pulse" aria-hidden="true" />
            <span>SISTEMA ACTIVO • CONTROL CONTABLE</span>
          </div>

          {/* Indicador de sincronización en la nube */}
          <SyncIndicator />

          {/* Interruptor de modo oscuro corporativo */}
          <DarkModeToggle />

          {/* Selector de dispositivo (Computadora / Teléfono) */}
          <div className="header-device-switcher">
            <DeviceSwitcher compact />
          </div>
        </div>

        {/* Título principal con ícono SVG de tienda */}
        <h1>
          <div className="header-brand-icon-box" aria-hidden="true">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          Control Contable Pro • Tienda de Ropa
        </h1>

        {/* Subtítulo con contexto fiscal */}
        <p>El Salvador • Régimen Fiscal IVA 13% • Control de Cajas, Inventario y Arqueos en Tiempo Real</p>
      </div>

      {/* ── Área de acciones (sesión + buscador + exportar) ── */}
      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Botón rápido del Buscador Global (Ctrl + K) */}
        {onOpenSearch && (
          <button
            type="button"
            onClick={onOpenSearch}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: '38px',
              padding: '0 12px',
              fontSize: '0.8rem',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.24)',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
            }}
            title="Búsqueda rápida en el sistema"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>Buscar</span>
            <kbd className="header-search-shortcut"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                padding: '1px 5px',
                borderRadius: '3px',
                background: 'rgba(0,0,0,0.25)',
                color: 'rgba(255,255,255,0.85)',
                marginLeft: '4px',
              }}
            >
              Ctrl+K
            </kbd>
          </button>
        )}

        {user ? (
          /* ── Usuario autenticado: insignia de rol + botones ── */
          <div
            className="header-user-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.28)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
            }}
            aria-label={`Sesión activa: ${user.displayName}`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>

            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.2 }}>
                {user.displayName || user.username}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#D1FAE5', lineHeight: 1.2 }}>
                {isOwner ? (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      style={{ display: 'inline', verticalAlign: '-1px', marginRight: '3px' }}
                      aria-hidden="true">
                      <path d="M2 20h20M5 20V10l7-7 7 7v10" />
                    </svg>
                    Dueño / Administrador
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      style={{ display: 'inline', verticalAlign: '-1px', marginRight: '3px' }}
                      aria-hidden="true">
                      <rect x="2" y="7" width="20" height="13" rx="2" />
                      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                    </svg>
                    Cajero / Empleado
                  </>
                )}
              </span>
            </div>

            <div className="header-user-actions">
              <button
                type="button"
                onClick={onOpenLogin}
                style={{
                  fontSize: '0.7rem',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.28)',
                  color: '#E1EBDC',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)',
                  whiteSpace: 'nowrap',
                  minHeight: '32px',
                }}
                title="Cambiar de usuario o rol"
              >
                Cambiar Rol
              </button>

              <button
                type="button"
                onClick={handleLogout}
                style={{
                  fontSize: '0.7rem',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(178,96,63,0.25)',
                  border: '1px solid rgba(178,96,63,0.5)',
                  color: '#FED7C8',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)',
                  whiteSpace: 'nowrap',
                  minHeight: '32px',
                }}
                title="Cerrar sesión actual"
              >
                Salir
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenLogin}
            className="btn btn-primary"
            style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Iniciar Sesión
          </button>
        )}

        {/* Badge de modo de operación */}
        <div className="terminal-telemetry-badge" aria-label="Modo de operación del sistema">
          <span className="telemetry-label">MODO CAJERO:</span>
          <span className="telemetry-val">ALTA VELOCIDAD</span>
        </div>

        {/* Botón de exportar respaldo CSV */}
        <button
          type="button"
          className="btn btn-success"
          onClick={onExportCSV}
          title="Descargar copia de seguridad completa en CSV / Excel"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px' }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Exportar Respaldo CSV</span>
        </button>
      </div>
    </header>
  );
}
export default Header;
