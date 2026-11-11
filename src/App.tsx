import React, { useState, useEffect } from 'react';
import { ActiveModule } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FeedbackProvider, useFeedback } from './context/FeedbackContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginModal } from './components/LoginModal';
import { ContableModule } from './components/modules/ContableModule';
import { InventoryModule } from './components/modules/InventoryModule';
import { ApartadosModule } from './components/modules/ApartadosModule';
import { CajaChicaModule } from './components/modules/CajaChicaModule';
import { ReportsModule } from './components/modules/ReportsModule';
import { CierreModule } from './components/modules/CierreModule';
import { CalendarModule } from './components/modules/CalendarModule';
import { exportComprehensiveBackupCSV } from './utils/exportCsv';

// ============================================================
// MainApp — componente raíz interno (requiere AuthContext activo)
// ============================================================
// Gestiona el módulo activo, los atajos de teclado F1–F7 y la
// pantalla de bloqueo que exige autenticación antes de usar el
// sistema. El LoginModal se muestra SIEMPRE que no hay sesión
// iniciada (isOpen controlado por la ausencia de user).
// ============================================================
function MainApp() {
  // Módulo visible actualmente (F1=contable … F7=calendario)
  const [activeModule, setActiveModule] = useState<ActiveModule>('contable');

  // Controla si el modal de login está abierto manualmente
  // (p.ej. para cambiar de rol desde el encabezado).
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // user: null = sin sesión; objeto = sesión activa con rol.
  const { user, loading } = useAuth();
  const { showToast } = useFeedback();

  // ──────────────────────────────────────────────────────────
  // Efecto: atajos de teclado F1–F7 para cambiar de módulo.
  // Se ignoran si el foco está en un campo de texto.
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // No interceptar si el usuario escribe en un campo de formulario
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      switch (e.key) {
        case 'F1': e.preventDefault(); setActiveModule('contable');   break;
        case 'F2': e.preventDefault(); setActiveModule('inventario'); break;
        case 'F3': e.preventDefault(); setActiveModule('apartados');  break;
        case 'F4': e.preventDefault(); setActiveModule('cajaChica');  break;
        case 'F5':
          // Alt+F5 cambia a Reportes; F5 solo recarga el navegador normalmente
          if (e.altKey) { e.preventDefault(); setActiveModule('reportes'); }
          break;
        case 'F6': e.preventDefault(); setActiveModule('cierre');     break;
        case 'F7': e.preventDefault(); setActiveModule('calendario'); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ──────────────────────────────────────────────────────────
  // Exportar respaldo CSV con feedback de toast al usuario.
  // ──────────────────────────────────────────────────────────
  const handleExportBackup = async () => {
    try {
      showToast('Generando respaldo integral en CSV...', false, 'info');
      await exportComprehensiveBackupCSV();
      showToast('Respaldo descargado exitosamente.', false, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al exportar respaldo CSV.', true);
    }
  };

  // ──────────────────────────────────────────────────────────
  // Pantalla de carga mientras AuthContext verifica la sesión
  // guardada en localStorage (evita flash de login innecesario).
  // ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          background: 'var(--bg-base)',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          fontFamily: 'var(--font-sans)',
        }}
        aria-label="Cargando sistema..."
      >
        {/* Spinner SVG animado — sin dependencias externas */}
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: 'spin 1s linear infinite' }}
          aria-hidden="true"
        >
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        <span>Verificando sesión...</span>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // PANTALLA DE BLOQUEO: si no hay sesión activa, se muestra
  // únicamente la pantalla de inicio de sesión.
  // El usuario NO puede acceder a ningún módulo sin autenticarse.
  // ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      /* Fondo de bloqueo con gradiente suave del tema */
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, var(--bg-base) 0%, var(--surface-alt) 100%)',
          padding: '20px',
        }}
        aria-label="Pantalla de acceso al sistema"
      >
        {/* Logo / título de la tienda en la pantalla de bloqueo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          {/* Ícono de tienda SVG */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              boxShadow: '0 8px 24px rgba(79,111,82,0.25)',
            }}
            aria-hidden="true"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h1
            style={{
              fontSize: '1.3rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              margin: '0 0 4px',
              fontFamily: "'Source Serif 4', Georgia, serif",
            }}
          >
            Control Contable Pro
          </h1>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Tienda de Ropa • El Salvador • IVA 13%
          </p>
        </div>

        {/* Tarjeta del formulario de acceso */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 20px 40px -10px rgba(47,58,51,0.12)',
            padding: '32px 28px',
            width: '100%',
            maxWidth: '400px',
          }}
        >
          {/* El LoginModal reutilizable se usa aquí en modo embebido */}
          <LoginModal isOpen={true} onClose={() => {}} isEmbedded={true} />
        </div>

        {/* Pie de crédito */}
        <p style={{ marginTop: '24px', fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
          Acceso protegido por PIN • Solo personal autorizado
        </p>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // APLICACIÓN PRINCIPAL — solo visible con sesión activa.
  // ──────────────────────────────────────────────────────────
  return (
    <div className="container min-h-screen py-4 px-2 sm:px-4">
      {/* Encabezado con marca, estado de sesión y botón de exportar */}
      <Header
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onExportCSV={handleExportBackup}
      />

      {/* Rejilla principal: módulo activo (izq.) + panel de navegación (der.) */}
      <div className="app-layout">
        <main className="main-content-area">
          {activeModule === 'contable'   && <ContableModule />}
          {activeModule === 'inventario' && <InventoryModule />}
          {activeModule === 'apartados'  && <ApartadosModule />}
          {activeModule === 'cajaChica'  && <CajaChicaModule />}
          {activeModule === 'reportes'   && <ReportsModule onExportCSV={handleExportBackup} />}
          {activeModule === 'cierre'     && <CierreModule />}
          {activeModule === 'calendario' && <CalendarModule />}
        </main>

        {/* Barra lateral derecha: botones F1–F7 de módulos */}
        <Sidebar
          activeModule={activeModule}
          onSelectModule={(mod) => setActiveModule(mod)}
        />
      </div>

      {/* Modal de cambio de rol / re-autenticación (solo cuando ya hay sesión) */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FeedbackProvider>
        <MainApp />
      </FeedbackProvider>
    </AuthProvider>
  );
}
