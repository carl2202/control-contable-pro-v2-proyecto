// ============================================================
// Header.tsx
// Encabezado principal de la aplicación.
//
// Muestra:
//   • Área de marca (logo SVG, nombre del sistema, subtítulo).
//   • Insignia de usuario activo con su rol y botones de acción.
//   • Badge de estado del sistema ("MODO CAJERO: ALTA VELOCIDAD").
//   • Botón de exportar respaldo CSV.
//
// Props:
//   onOpenLogin  — abre el LoginModal para cambiar de rol.
//   onExportCSV  — dispara la exportación de respaldo CSV.
//
// Clases CSS: definidas en css/layout.css
//   header, .terminal-brand-area, .terminal-sys-badge,
//   .header-actions, .terminal-telemetry-badge, .btn-*
// ============================================================
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';

interface HeaderProps {
  onOpenLogin: () => void;
  onExportCSV: () => void;
}

export function Header({ onOpenLogin, onExportCSV }: HeaderProps) {
  const { user, logout, isOwner } = useAuth();
  const { showToast } = useFeedback();

  // Cerrar sesión con confirmación visual via toast
  const handleLogout = async () => {
    await logout();
    showToast('Sesión cerrada correctamente.', false, 'info');
  };

  return (
    <header className="mb-4" role="banner">
      {/* ── Área de marca ── */}
      <div className="terminal-brand-area">
        {/* Insignia "SISTEMA ACTIVO" con punto pulsante */}
        <div className="terminal-sys-badge" aria-label="Sistema operativo">
          <span className="sys-pulse" aria-hidden="true" />
          <span>SISTEMA ACTIVO • CONTROL CONTABLE</span>
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
              {/* Ícono de bolsa / tienda de ropa */}
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          Control Contable Pro • Tienda de Ropa
        </h1>

        {/* Subtítulo con contexto fiscal */}
        <p>El Salvador • Régimen Fiscal IVA 13% • Control de Caja e Inventario Inteligente</p>
      </div>

      {/* ── Área de acciones (sesión + exportar) ── */}
      <div className="header-actions">
        {user ? (
          /* ── Usuario autenticado: insignia de rol + botones ── */
          <div
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
            {/* Ícono de usuario SVG */}
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
              {/* Nombre del usuario */}
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.2 }}>
                {user.displayName || user.username}
              </span>
              {/* Etiqueta de rol con ícono */}
              <span style={{ fontSize: '0.68rem', color: '#D1FAE5', lineHeight: 1.2 }}>
                {isOwner ? (
                  <>
                    {/* Ícono corona para dueño */}
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
                    {/* Ícono maletín para empleado */}
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

            {/* Botón para cambiar de rol (re-abre el LoginModal) */}
            <button
              type="button"
              onClick={onOpenLogin}
              style={{
                fontSize: '0.7rem',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(255,255,255,0.28)',
                color: '#E1EBDC',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
                whiteSpace: 'nowrap',
              }}
              title="Cambiar de usuario o rol"
            >
              Cambiar Rol
            </button>

            {/* Botón de cerrar sesión */}
            <button
              type="button"
              onClick={handleLogout}
              style={{
                fontSize: '0.7rem',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(178,96,63,0.25)',
                border: '1px solid rgba(178,96,63,0.5)',
                color: '#FED7C8',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
                whiteSpace: 'nowrap',
              }}
              title="Cerrar sesión actual"
            >
              Salir
            </button>
          </div>
        ) : (
          /* ── Sin sesión: botón de Iniciar Sesión ── */
          <button
            type="button"
            onClick={onOpenLogin}
            className="btn btn-primary"
            style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {/* Ícono de candado */}
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
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {/* Ícono de descarga SVG */}
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
