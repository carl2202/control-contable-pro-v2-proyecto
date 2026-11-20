// ============================================================
// AdminPanel.tsx
// Panel Maestro de Administración (Cajas y Usuarios)
// ============================================================
import React, { useState } from 'react';
import { CashRegistersPanel } from './CashRegistersPanel';
import { UserManagementPanel } from './UserManagementPanel';
import { BackupsAuditPanel } from './BackupsAuditPanel';

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'registers' | 'users' | 'backups'>('registers');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Encabezado del Módulo de Administración */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          background: 'var(--surface)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--primary)',
                background: 'rgba(79, 111, 82, 0.12)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              Control Exclusivo • Dueño
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-main)', fontFamily: "'Source Serif 4', Georgia, serif" }}>
            Administración del Negocio
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Configuración de cajas operativas, control de arqueos y gestión de personal.
          </p>
        </div>

        {/* Pestañas de Navegación */}
        <div
          style={{
            display: 'flex',
            background: 'var(--surface-alt)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            gap: '4px',
          }}
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'registers'}
            onClick={() => setActiveTab('registers')}
            style={{
              border: 'none',
              background: activeTab === 'registers' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'registers' ? 'var(--primary)' : 'var(--text-body)',
              fontWeight: 600,
              fontSize: '0.85rem',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              boxShadow: activeTab === 'registers' ? 'var(--shadow-xs)' : 'none',
              transition: 'var(--transition-smooth)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '40px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
            Cajas Registradoras
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'users'}
            onClick={() => setActiveTab('users')}
            style={{
              border: 'none',
              background: activeTab === 'users' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'users' ? 'var(--primary)' : 'var(--text-body)',
              fontWeight: 600,
              fontSize: '0.85rem',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              boxShadow: activeTab === 'users' ? 'var(--shadow-xs)' : 'none',
              transition: 'var(--transition-smooth)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '40px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Usuarios y Cajeros
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'backups'}
            onClick={() => setActiveTab('backups')}
            style={{
              border: 'none',
              background: activeTab === 'backups' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'backups' ? 'var(--primary)' : 'var(--text-body)',
              fontWeight: 600,
              fontSize: '0.85rem',
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              minHeight: '40px',
            }}
          >
            Respaldos y Auditoría
          </button>
        </div>
      </div>

      {/* Contenido de la pestaña activa */}
      {activeTab === 'registers'
        ? <CashRegistersPanel />
        : activeTab === 'users'
          ? <UserManagementPanel />
          : <BackupsAuditPanel />}
    </div>
  );
}

export default AdminPanel;
