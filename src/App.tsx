import React, { useState, useEffect } from 'react';
import { ActiveModule } from './types';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FeedbackProvider, useFeedback } from './context/FeedbackContext';
import { DeviceProvider, useDevice } from './context/DeviceContext';
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
import AdminPanel from './components/admin/AdminPanel';
import GlobalSearch from './components/GlobalSearch';
import CookieBanner, { useCookieConsent } from './components/CookieBanner';
import { exportComprehensiveBackupCSV } from './utils/exportCsv';

const moduleLabels: Record<ActiveModule, string> = {
  contable: 'Ventas y Caja',
  inventario: 'Inventario',
  apartados: 'Apartados',
  cajaChica: 'Caja Chica',
  reportes: 'Reportes',
  cierre: 'Cierres y Arqueo',
  calendario: 'Calendario',
  admin: 'Gestión de Cajas / Usuarios',
};

// ============================================================
// MainApp — componente raíz interno (requiere AuthContext activo)
// ============================================================
function MainApp() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('contable');
  const [isMobileModuleView, setIsMobileModuleView] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  const { user, loading, isOwner } = useAuth();
  const { isMobile } = useDevice();
  const { showToast } = useFeedback();
  const { consented } = useCookieConsent();

  const navigateToModule = (mod: ActiveModule) => {
    setActiveModule(mod);
    if (isMobile) setIsMobileModuleView(true);
  };

  // ──────────────────────────────────────────────────────────
  // Atajos de teclado: F1–F7 para módulos, Ctrl+K para buscador
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Shortcut Ctrl + K o Cmd + K para el buscador global
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
        return;
      }

      // No interceptar si el usuario escribe en un campo de formulario
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      switch (e.key) {
        case 'F1': e.preventDefault(); navigateToModule('contable');   break;
        case 'F2': e.preventDefault(); navigateToModule('inventario'); break;
        case 'F3': e.preventDefault(); navigateToModule('apartados');  break;
        case 'F4': e.preventDefault(); navigateToModule('cajaChica');  break;
        case 'F5':
          if (e.altKey) { e.preventDefault(); navigateToModule('reportes'); }
          break;
        case 'F6': e.preventDefault(); navigateToModule('cierre');     break;
        case 'F7': e.preventDefault(); navigateToModule('calendario'); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile]);

  const handleExportBackup = async () => {
    try {
      showToast('Generando respaldo integral en CSV...', false, 'info');
      await exportComprehensiveBackupCSV();
      showToast('Respaldo descargado exitosamente.', false, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al exportar respaldo CSV.', true);
    }
  };

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
        <span>Verificando sesión segura...</span>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // PANTALLA DE BLOQUEO / ACCESO:
  // Si no hay cookies aceptadas o no hay sesión, se protege el acceso.
  // ──────────────────────────────────────────────────────────
  if (!consented || !user) {
    return (
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
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
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
              fontSize: '1.4rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              margin: '0 0 4px',
              fontFamily: "'Source Serif 4', Georgia, serif",
            }}
          >
            Control Contable Pro
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Tienda de Ropa • El Salvador • IVA 13% • Cajas & Inventario
          </p>
        </div>

        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-lg)',
            padding: '32px 28px',
            width: '100%',
            maxWidth: '420px',
          }}
        >
          {consented ? (
            <LoginModal isOpen={true} onClose={() => {}} isEmbedded={true} />
          ) : (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ marginBottom: '16px', color: 'var(--primary)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
                  <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
                  <path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01" />
                </svg>
              </div>
              <h2 style={{ fontSize: '1.1rem', margin: '0 0 8px', color: 'var(--text-main)' }}>
                Consentimiento de Cookies Requerido
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 20px' }}>
                Para garantizar la seguridad de sus sesiones y la protección de sus datos contables, el sistema requiere almacenar cookies técnicas esenciales.
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', margin: 0 }}>
                Por favor, acepte el banner flotante en la parte inferior para habilitar el formulario de inicio de sesión.
              </p>
            </div>
          )}
        </div>

        <p style={{ marginTop: '24px', fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
          Acceso protegido por credenciales seguras • Sesiones con cierre automático por inactividad
        </p>

        {/* Banner de cookies visible siempre que no se haya aceptado */}
        <CookieBanner />
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // APLICACIÓN PRINCIPAL (Sesión activa y cookies aceptadas)
  // ──────────────────────────────────────────────────────────
  return (
    <div
      className={`container min-h-screen py-4 px-2 sm:px-4${isMobile && isMobileModuleView ? ' mobile-module-screen' : ''}`}
      data-view-mode={isMobile ? 'phone' : 'desktop'}
    >
      {/* Encabezado con estado, tema, sincronización y buscador */}
      <Header
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onExportCSV={handleExportBackup}
        onOpenSearch={() => setIsSearchOpen(true)}
        onToggleSidebar={() => {
          if (isMobile) {
            setIsMobileModuleView(false);
          } else {
            setIsSidebarOpen((open) => !open);
          }
        }}
      />

      {/* Rejilla principal */}
      <div className={`app-layout${isMobile && !isMobileModuleView ? ' mobile-module-menu' : ''}`}>
        <main className="main-content-area">
          {isMobile && isMobileModuleView && (
            <div className="mobile-module-heading">
              <button
                type="button"
                className="mobile-module-back"
                onClick={() => setIsMobileModuleView(false)}
                aria-label="Regresar a la lista de módulos"
              >
                ←
              </button>
              <h2>{moduleLabels[activeModule]}</h2>
            </div>
          )}
          {activeModule === 'contable'   && <ContableModule />}
          {activeModule === 'inventario' && <InventoryModule />}
          {activeModule === 'apartados'  && <ApartadosModule />}
          {activeModule === 'cajaChica'  && <CajaChicaModule />}
          {activeModule === 'reportes'   && <ReportsModule onExportCSV={handleExportBackup} />}
          {activeModule === 'cierre'     && <CierreModule />}
          {activeModule === 'calendario' && <CalendarModule />}
          {activeModule === 'admin' && isOwner && <AdminPanel />}
        </main>

        {/* Barra lateral de navegación F1–F7 + Admin */}
        <Sidebar
          activeModule={activeModule}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onSelectModule={(mod) => {
            navigateToModule(mod);
            setIsSidebarOpen(false);
          }}
        />
      </div>

      {/* Modal de re-autenticación / cambio de rol */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      {/* Buscador Global Inteligente (Ctrl + K) */}
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={(mod) => {
          navigateToModule(mod);
          setIsSearchOpen(false);
        }}
      />

      {/* Banner de cookies flotante (por si aún no se ha aceptado) */}
      <CookieBanner />
    </div>
  );
}

export default function App() {
  return (
    <DeviceProvider>
      <AuthProvider>
        <FeedbackProvider>
          <MainApp />
        </FeedbackProvider>
      </AuthProvider>
    </DeviceProvider>
  );
}
