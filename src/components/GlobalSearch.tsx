// ============================================================
// GlobalSearch.tsx
// Buscador global Ctrl+K — modal centrado con overlay.
//
// Props:
//   isOpen      — controlado desde App.tsx
//   onClose     — callback para cerrar
//   onNavigate  — callback para navegar al módulo seleccionado
// ============================================================
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { ActiveModule } from '../types';

interface SearchResult {
  id: string;
  label: string;
  category: 'Módulos' | 'Acciones rápidas' | 'Cajas';
  module?: ActiveModule;
  action?: () => void;
  icon: React.ReactNode;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: ActiveModule) => void;
}

// ── Íconos SVG inline ──────────────────────────────────────
function IconContable() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
function IconInventory() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  );
}
function IconApartados() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
function IconCaja() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}
function IconReportes() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function IconCierre() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconRegister() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
// ── Fin íconos ─────────────────────────────────────────────

const MODULE_RESULTS: SearchResult[] = [
  { id: 'contable',   label: 'Contable (F1) — Ventas, Compras, IVA',      category: 'Módulos', module: 'contable',   icon: <IconContable /> },
  { id: 'inventario', label: 'Inventario (F2) — Bodega y Variantes',       category: 'Módulos', module: 'inventario', icon: <IconInventory /> },
  { id: 'apartados',  label: 'Apartados (F3) — Reservas y Abonos',         category: 'Módulos', module: 'apartados',  icon: <IconApartados /> },
  { id: 'cajaChica',  label: 'Caja Chica (F4) — Fondo Operativo',          category: 'Módulos', module: 'cajaChica',  icon: <IconCaja /> },
  { id: 'reportes',   label: 'Reportes (Alt+F5) — Balance y Respaldo CSV', category: 'Módulos', module: 'reportes',   icon: <IconReportes /> },
  { id: 'cierre',     label: 'Cierre (F6) — Arqueo Diario',                category: 'Módulos', module: 'cierre',     icon: <IconCierre /> },
  { id: 'calendario', label: 'Calendario (F7) — Jornadas Comerciales',     category: 'Módulos', module: 'calendario', icon: <IconCalendar /> },
];

const QUICK_ACTIONS: SearchResult[] = [
  {
    id: 'exportar-csv',
    label: 'Exportar respaldo CSV',
    category: 'Acciones rápidas',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
    action: () => {
      // Atajo de acción: ir al módulo de reportes para exportar
    },
    module: 'reportes',
  },
];

export default function GlobalSearch({ isOpen, onClose, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [registers, setRegisters] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Foco al abrir
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      // Cargar cajas disponibles
      fetchRegisters();
    }
  }, [isOpen]);

  const fetchRegisters = async () => {
    try {
      const res = await fetch('/api/registers', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json() as Array<{ id: number; name: string }>;
      const mapped: SearchResult[] = data.map((r) => ({
        id: `register-${r.id}`,
        label: `Caja: ${r.name}`,
        category: 'Cajas',
        icon: <IconRegister />,
        module: 'cierre' as ActiveModule,
      }));
      setRegisters(mapped);
    } catch {
      // sin cajas disponibles
    }
  };

  // Filtrar resultados según query
  useEffect(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      setResults([...MODULE_RESULTS, ...QUICK_ACTIONS, ...registers]);
    } else {
      const all = [...MODULE_RESULTS, ...QUICK_ACTIONS, ...registers];
      setResults(all.filter((r) => r.label.toLowerCase().includes(q)));
    }
    setActiveIndex(0);
  }, [query, registers]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (result.module) {
        onNavigate(result.module);
      }
      if (result.action) {
        result.action();
      }
      onClose();
    },
    [onNavigate, onClose]
  );

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter' && results[activeIndex]) {
      handleSelect(results[activeIndex]);
    }
  };

  if (!isOpen) return null;

  // Agrupar resultados por categoría
  const groups = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  let flatIndex = 0; // índice absoluto para saber cuál está activo

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-label="Buscador global"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10001,
          width: 'min(560px, 92vw)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Input de búsqueda */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar cajas, transacciones, módulos..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '0.92rem',
              color: 'var(--text-main)',
              fontFamily: 'var(--font-sans)',
            }}
            aria-label="Buscar en el sistema"
            autoComplete="off"
          />
          <kbd
            style={{
              fontSize: '0.65rem',
              padding: '2px 6px',
              borderRadius: 'var(--radius-xs)',
              background: 'var(--surface-alt)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Esc
          </kbd>
        </div>

        {/* Lista de resultados */}
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Resultados de búsqueda"
          style={{
            margin: 0,
            padding: '8px 0',
            listStyle: 'none',
            maxHeight: '340px',
            overflowY: 'auto',
          }}
        >
          {results.length === 0 && (
            <li
              style={{
                padding: '20px',
                textAlign: 'center',
                fontSize: '0.84rem',
                color: 'var(--text-muted)',
              }}
            >
              Sin resultados para &ldquo;{query}&rdquo;
            </li>
          )}

          {Object.entries(groups).map(([category, items]) => (
            <React.Fragment key={category}>
              {/* Encabezado de categoría */}
              <li
                aria-hidden="true"
                style={{
                  padding: '6px 16px 4px',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color: 'var(--text-subtle)',
                }}
              >
                {category}
              </li>

              {items.map((result) => {
                const thisIndex = flatIndex++;
                const isActive = thisIndex === activeIndex;
                return (
                  <li
                    key={result.id}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setActiveIndex(thisIndex)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '0.84rem',
                      color: isActive ? 'var(--primary)' : 'var(--text-body)',
                      background: isActive ? 'var(--surface-hover)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <span
                      style={{
                        color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {result.icon}
                    </span>
                    {result.label}
                  </li>
                );
              })}
            </React.Fragment>
          ))}
        </ul>

        {/* Pie del modal */}
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '8px 16px',
            display: 'flex',
            gap: '12px',
            fontSize: '0.7rem',
            color: 'var(--text-subtle)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span>↑↓ Navegar</span>
          <span>↵ Seleccionar</span>
          <span>Esc Cerrar</span>
        </div>
      </div>
    </>
  );
}
