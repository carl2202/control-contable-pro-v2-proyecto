import React from 'react';
import { ActiveModule } from '../types';

interface SidebarProps {
  activeModule: ActiveModule;
  onSelectModule: (mod: ActiveModule) => void;
}

export function Sidebar({ activeModule, onSelectModule }: SidebarProps) {
  return (
    <aside className="modules-sidebar-right" aria-label="Navegación de Módulos">
      <div className="sidebar-panel-card">
        <div className="sidebar-header">
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
            <span>MÓDULOS DEL SISTEMA</span>
          </div>
          <h2 className="sidebar-title">Panel de Control</h2>
          <p className="sidebar-subtitle">Gestión Contable & Operativa</p>
        </div>

        <nav className="main-modules" aria-label="Módulos del Sistema">
          {/* F1: Contable */}
          <button
            type="button"
            className={`module-btn ${activeModule === 'contable' ? 'active' : ''}`}
            onClick={() => onSelectModule('contable')}
            title="Ventas, Facturación y Caja"
          >
            <span className="module-key-code">F1</span>
            <span className="module-icon-box icon-sales" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="13" x="3" y="4" rx="2"></rect>
                <path d="M5 8h14"></path>
                <path d="M8 12h.01M12 12h.01M16 12h.01"></path>
                <path d="M7 17v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3"></path>
              </svg>
            </span>
            <span className="module-info">
              <span className="module-name">Ventas y Caja</span>
              <span className="module-desc">POS, IVA y Movimientos</span>
            </span>
            <span className="module-indicator" aria-hidden="true"></span>
          </button>

          {/* F2: Inventario */}
          <button
            type="button"
            className={`module-btn ${activeModule === 'inventario' ? 'active' : ''}`}
            onClick={() => onSelectModule('inventario')}
            title="Inventario, Tallas y Stock"
          >
            <span className="module-key-code">F2</span>
            <span className="module-icon-box icon-inventory" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m7.5 4.27 9 5.15"></path>
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                <path d="m3.3 7 8.7 5 8.7-5"></path>
                <path d="M12 22V12"></path>
              </svg>
            </span>
            <span className="module-info">
              <span className="module-name">Inventario</span>
              <span className="module-desc">Tallas, Stock y Costos</span>
            </span>
            <span className="module-indicator" aria-hidden="true"></span>
          </button>

          {/* F3: Apartados */}
          <button
            type="button"
            className={`module-btn ${activeModule === 'apartados' ? 'active' : ''}`}
            onClick={() => onSelectModule('apartados')}
            title="Apartados y Abonos de Clientes"
          >
            <span className="module-key-code">F3</span>
            <span className="module-icon-box icon-apartados" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <path d="M7 15h0M2 9.5h20"></path>
              </svg>
            </span>
            <span className="module-info">
              <span className="module-name">Apartados</span>
              <span className="module-desc">Reservas y Abonos</span>
            </span>
            <span className="module-indicator" aria-hidden="true"></span>
          </button>

          {/* F4: Caja Chica */}
          <button
            type="button"
            className={`module-btn ${activeModule === 'cajaChica' ? 'active' : ''}`}
            onClick={() => onSelectModule('cajaChica')}
            title="Fondo para gastos menores diarios"
          >
            <span className="module-key-code">F4</span>
            <span className="module-icon-box icon-caja-chica" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                <circle cx="12" cy="12" r="2"></circle>
                <path d="M6 12h.01M18 12h.01"></path>
              </svg>
            </span>
            <span className="module-info">
              <span className="module-name">Caja Chica</span>
              <span className="module-desc">Fondo y Gastos Menores</span>
            </span>
            <span className="module-indicator" aria-hidden="true"></span>
          </button>

          {/* F5: Reportes */}
          <button
            type="button"
            className={`module-btn ${activeModule === 'reportes' ? 'active' : ''}`}
            onClick={() => onSelectModule('reportes')}
            title="Balance consolidado y análisis financiero"
          >
            <span className="module-key-code">F5</span>
            <span className="module-icon-box icon-reports" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18"></path>
                <path d="m19 9-5 5-4-4-3 3"></path>
              </svg>
            </span>
            <span className="module-info">
              <span className="module-name">Reportes</span>
              <span className="module-desc">Balance y Exportación</span>
            </span>
            <span className="module-indicator" aria-hidden="true"></span>
          </button>

          {/* F6: Cierre */}
          <button
            type="button"
            className={`module-btn ${activeModule === 'cierre' ? 'active' : ''}`}
            onClick={() => onSelectModule('cierre')}
            title="Arqueo de caja física y cierre de inventario valorizado"
          >
            <span className="module-key-code">F6</span>
            <span className="module-icon-box icon-cierre" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M12 7v5l3 3"></path>
              </svg>
            </span>
            <span className="module-info">
              <span className="module-name">Cierres y Arqueo</span>
              <span className="module-desc">Caja & Snapshots</span>
            </span>
            <span className="module-indicator" aria-hidden="true"></span>
          </button>

          {/* F7: Calendario */}
          <button
            type="button"
            className={`module-btn ${activeModule === 'calendario' ? 'active' : ''}`}
            onClick={() => onSelectModule('calendario')}
            title="Jornadas, asuetos y días sin ventas"
          >
            <span className="module-key-code">F7</span>
            <span className="module-icon-box icon-calendar" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="16" rx="2"></rect>
                <path d="M3 10h18M8 3v4M16 3v4"></path>
              </svg>
            </span>
            <span className="module-info">
              <span className="module-name">Calendario</span>
              <span className="module-desc">Jornadas y Asuetos</span>
            </span>
            <span className="module-indicator" aria-hidden="true"></span>
          </button>
        </nav>

        <div className="sidebar-footer-info">
          <div className="system-status-pill">
            <span className="pulse-dot"></span>
            <span className="status-name">Sistema Operativo</span>
          </div>
          <div className="system-meta-text">El Salvador • IVA 13% Incl.</div>
        </div>
      </div>
    </aside>
  );
}
