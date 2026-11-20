import React, { useEffect } from 'react';
import { ActiveModule } from '../types';
import { useAuth } from '../context/AuthContext';
import { useDevice } from '../context/DeviceContext';

interface SidebarProps {
  activeModule: ActiveModule;
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (mod: ActiveModule) => void;
}

export function Sidebar({ activeModule, isOpen, onClose, onSelectModule }: SidebarProps) {
  const { isOwner } = useAuth();
  const { isMobile: isMobileDevice } = useDevice();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={onClose}
          aria-label="Cerrar menú de módulos"
        />
      )}
      <aside
        className={`modules-sidebar-right${isOpen ? ' mobile-drawer-open' : ''}`}
        aria-label="Navegación de Módulos"
        aria-modal={isOpen ? true : undefined}
        role={isOpen ? 'dialog' : undefined}
        style={{
          width: '100%',
          maxWidth: isMobileDevice ? '100%' : undefined,
        }}
      >
      <div className="sidebar-panel-card" style={{ padding: isMobileDevice ? '12px' : '16px' }}>
        <div className="sidebar-header" style={{ marginBottom: isMobileDevice ? '10px' : '14px' }}>
          <div className="sidebar-brand-badge">
            <svg
              className="sidebar-brand-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
              <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
              <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
              <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
            </svg>
            <span style={{ letterSpacing: '0.04em' }}>MÓDULOS DEL SISTEMA</span>
            <button
              type="button"
              className="sidebar-close-button"
              onClick={onClose}
              aria-label="Cerrar menú de módulos"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="m18 6-12 12M6 6l12 12" />
              </svg>
            </button>
          </div>
          <h2 className="sidebar-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Panel de Control
          </h2>
          <p className="sidebar-subtitle" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Gestión Contable & Operativa
          </p>
        </div>

        <nav
          className="main-modules"
          aria-label="Módulos del Sistema"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobileDevice ? 'repeat(auto-fill, minmax(140px, 1fr))' : '1fr',
            gap: isMobileDevice ? '6px' : '8px',
          }}
        >
          {/* F1: Contable */}
          <button
            type="button"
            className={`module-btn ${activeModule === 'contable' ? 'active' : ''}`}
            onClick={() => onSelectModule('contable')}
            title="Ventas, Facturación y Caja"
            style={{ minHeight: isMobileDevice ? '52px' : '46px' }}
          >
            <span className="module-key-code module-key-shortcut">F1</span>
            <span className="module-icon-box icon-sales" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="13" x="3" y="4" rx="2"></rect>
                <path d="M5 8h14"></path>
                <path d="M8 12h.01M12 12h.01M16 12h.01"></path>
                <path d="M7 17v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3"></path>
              </svg>
            </span>
            <span className="module-info" style={{ minWidth: 0 }}>
              <span className="module-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Ventas y Caja
              </span>
              <span className="module-desc" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                POS, IVA y Movimientos
              </span>
            </span>
            <span className="module-indicator" aria-hidden="true"></span>
          </button>

          {/* F2: Inventario */}
          <button
            type="button"
            className={`module-btn ${activeModule === 'inventario' ? 'active' : ''}`}
            onClick={() => onSelectModule('inventario')}
            title="Inventario, Tallas y Stock"
            style={{ minHeight: isMobileDevice ? '52px' : '46px' }}
          >
            <span className="module-key-code module-key-shortcut">F2</span>
            <span className="module-icon-box icon-inventory" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m7.5 4.27 9 5.15"></path>
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                <path d="m3.3 7 8.7 5 8.7-5"></path>
                <path d="M12 22V12"></path>
              </svg>
            </span>
            <span className="module-info" style={{ minWidth: 0 }}>
              <span className="module-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Inventario
              </span>
              <span className="module-desc" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Tallas, Stock y Costos
              </span>
            </span>
            <span className="module-indicator" aria-hidden="true"></span>
          </button>

          {/* F3: Apartados */}
          <button
            type="button"
            className={`module-btn ${activeModule === 'apartados' ? 'active' : ''}`}
            onClick={() => onSelectModule('apartados')}
            title="Apartados y Abonos de Clientes"
            style={{ minHeight: isMobileDevice ? '52px' : '46px' }}
          >
            <span className="module-key-code module-key-shortcut">F3</span>
            <span className="module-icon-box icon-apartados" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <path d="M7 15h0M2 9.5h20"></path>
              </svg>
            </span>
            <span className="module-info" style={{ minWidth: 0 }}>
              <span className="module-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Apartados
              </span>
              <span className="module-desc" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Reservas y Abonos
              </span>
            </span>
            <span className="module-indicator" aria-hidden="true"></span>
          </button>

          {/* F4: Caja Chica */}
          <button
            type="button"
            className={`module-btn ${activeModule === 'cajaChica' ? 'active' : ''}`}
            onClick={() => onSelectModule('cajaChica')}
            title="Fondo para gastos menores diarios"
            style={{ minHeight: isMobileDevice ? '52px' : '46px' }}
          >
            <span className="module-key-code module-key-shortcut">F4</span>
            <span className="module-icon-box icon-caja-chica" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                <circle cx="12" cy="12" r="2"></circle>
                <path d="M6 12h.01M18 12h.01"></path>
              </svg>
            </span>
            <span className="module-info" style={{ minWidth: 0 }}>
              <span className="module-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Caja Chica
              </span>
              <span className="module-desc" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Fondo y Gastos Menores
              </span>
            </span>
            <span className="module-indicator" aria-hidden="true"></span>
          </button>

          {/* F5: Reportes */}
          <button
            type="button"
            className={`module-btn ${activeModule === 'reportes' ? 'active' : ''}`}
            onClick={() => onSelectModule('reportes')}
            title="Balance consolidado y análisis financiero"
            style={{ minHeight: isMobileDevice ? '52px' : '46px' }}
          >
            <span className="module-key-code module-key-shortcut">F5</span>
            <span className="module-icon-box icon-reports" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18"></path>
                <path d="m19 9-5 5-4-4-3 3"></path>
              </svg>
            </span>
            <span className="module-info" style={{ minWidth: 0 }}>
              <span className="module-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Reportes
              </span>
              <span className="module-desc" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Balance y Exportación
              </span>
            </span>
            <span className="module-indicator" aria-hidden="true"></span>
          </button>

          {/* F6: Cierre */}
          <button
            type="button"
            className={`module-btn ${activeModule === 'cierre' ? 'active' : ''}`}
            onClick={() => onSelectModule('cierre')}
            title="Arqueo de caja física y cierre de inventario valorizado"
            style={{ minHeight: isMobileDevice ? '52px' : '46px' }}
          >
            <span className="module-key-code module-key-shortcut">F6</span>
            <span className="module-icon-box icon-cierre" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M12 7v5l3 3"></path>
              </svg>
            </span>
            <span className="module-info" style={{ minWidth: 0 }}>
              <span className="module-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Cierres y Arqueo
              </span>
              <span className="module-desc" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Caja & Snapshots
              </span>
            </span>
            <span className="module-indicator" aria-hidden="true"></span>
          </button>

          {/* F7: Calendario */}
          <button
            type="button"
            className={`module-btn ${activeModule === 'calendario' ? 'active' : ''}`}
            onClick={() => onSelectModule('calendario')}
            title="Jornadas, asuetos y días sin ventas"
            style={{ minHeight: isMobileDevice ? '52px' : '46px' }}
          >
            <span className="module-key-code module-key-shortcut">F7</span>
            <span className="module-icon-box icon-calendar" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="16" rx="2"></rect>
                <path d="M3 10h18M8 3v4M16 3v4"></path>
              </svg>
            </span>
            <span className="module-info" style={{ minWidth: 0 }}>
              <span className="module-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Calendario
              </span>
              <span className="module-desc" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Jornadas y Asuetos
              </span>
            </span>
            <span className="module-indicator" aria-hidden="true"></span>
          </button>

          {/* Módulo Admin: Exclusivo para Dueño */}
          {isOwner && (
            <button
              type="button"
              className={`module-btn ${activeModule === 'admin' ? 'active' : ''}`}
              onClick={() => onSelectModule('admin')}
              title="Gestión de Cajas, Usuarios y Permisos"
              style={{
                marginTop: isMobileDevice ? '2px' : '8px',
                borderTop: '1px dashed var(--border)',
                paddingTop: '10px',
                minHeight: isMobileDevice ? '52px' : '46px',
              }}
            >
              <span className="module-key-code" style={{ fontSize: '0.65rem', padding: '2px 4px' }}>ADM</span>
              <span className="module-icon-box" style={{ background: 'rgba(79, 111, 82, 0.15)', color: 'var(--primary)' }} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </span>
              <span className="module-info" style={{ minWidth: 0 }}>
                <span className="module-name" style={{ color: 'var(--primary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Administración
                </span>
                <span className="module-desc" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Cajas & Usuarios
                </span>
              </span>
              <span className="module-indicator" aria-hidden="true"></span>
            </button>
          )}
        </nav>

        <div className="sidebar-footer-info" style={{ marginTop: isMobileDevice ? '10px' : '16px' }}>
          <div className="system-status-pill">
            <span className="pulse-dot"></span>
            <span className="status-name">Sistema Operativo</span>
          </div>
          <div className="system-meta-text">El Salvador • IVA 13% Incl.</div>
        </div>
      </div>
      </aside>
    </>
  );
}

export default Sidebar;