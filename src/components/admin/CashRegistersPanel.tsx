// ============================================================
// CashRegistersPanel.tsx — Panel de Administración de Cajas
//
// Muestra la tabla de cajas registradoras del sistema.
// Permite crear nuevas cajas y activar/desactivar existentes.
// Solo visible para rol 'dueno'.
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFeedback } from '../../context/FeedbackContext';
import { RegistersService, Register, CreateRegisterPayload } from '../../services/registers.service';

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Skeleton de carga ─────────────────────────────────────
function TableSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 0' }}>
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          style={{
            height: '40px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-alt, #E9EDE4)',
            animation: 'pulse 1.5s ease-in-out infinite',
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}

export function CashRegistersPanel() {
  const { isOwner } = useAuth();
  const { showToast, confirm } = useFeedback();

  const [registers, setRegisters] = useState<Register[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formKind, setFormKind] = useState<'operativa' | 'chica'>('operativa');
  const [formBalance, setFormBalance] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadRegisters = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await RegistersService.getRegisters();
      setRegisters(data || []);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar cajas.', true);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isOwner) loadRegisters();
  }, [isOwner, loadRegisters]);

  if (!isOwner) return null;

  // ── Crear nueva caja ──────────────────────────────────────
  const handleCreateRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Escribe un nombre para la caja.', true);
      return;
    }
    const balance = parseFloat(formBalance) || 0;
    if (balance < 0) {
      showToast('El saldo inicial no puede ser negativo.', true);
      return;
    }

    setIsSaving(true);
    try {
      const payload: CreateRegisterPayload = {
        name: formName.trim(),
        kind: formKind,
        openingBalance: balance,
      };
      await RegistersService.createRegister(payload);
      showToast(`Caja "${formName.trim()}" creada con éxito.`, false, 'success');
      setFormName('');
      setFormKind('operativa');
      setFormBalance('');
      setShowForm(false);
      await loadRegisters();
    } catch (err: any) {
      showToast(err.message || 'Error al crear la caja.', true);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Activar / Desactivar caja ─────────────────────────────
  const handleToggle = async (reg: Register) => {
    const action = reg.active ? 'desactivar' : 'reactivar';
    const ok = await confirm({
      title: `${reg.active ? 'Desactivar' : 'Reactivar'} caja`,
      message: `¿Deseas ${action} la caja "${reg.name}"?${
        reg.active ? '\nLa caja quedará archivada y no podrá recibir nuevos movimientos.' : ''
      }`,
      tone: reg.active ? 'warning' : 'primary',
      confirmText: reg.active ? 'Desactivar' : 'Reactivar',
    });
    if (!ok) return;

    try {
      await RegistersService.toggleRegister(reg.id, !reg.active);
      showToast(
        `Caja "${reg.name}" ${reg.active ? 'desactivada' : 'reactivada'} con éxito.`,
        false,
        reg.active ? 'warning' : 'success'
      );
      await loadRegisters();
    } catch (err: any) {
      showToast(err.message || `Error al ${action} la caja.`, true);
    }
  };

  // ── Quitar caja (eliminar o archivar preservando historial) ─
  const handleDelete = async (reg: Register) => {
    const ok = await confirm({
      title: `Quitar caja "${reg.name}"`,
      message: `¿Estás seguro de que deseas quitar la caja "${reg.name}"?\nSi contiene transacciones registradas quedará archivada para preservar la auditoría legal, o se eliminará si no posee movimientos.`,
      tone: 'danger',
      confirmText: 'Quitar Caja',
    });
    if (!ok) return;

    try {
      const res = await RegistersService.deleteRegister(reg.id);
      showToast(res.message || `Caja "${reg.name}" procesada.`, false, 'success');
      await loadRegisters();
    } catch (err: any) {
      showToast(err.message || 'Error al quitar la caja.', true);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Cabecera con botón de nueva caja */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Cajas Registradoras
          </h4>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {registers.length} caja(s) registradas en el sistema
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ minHeight: '44px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => setShowForm((v) => !v)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {showForm ? 'Cancelar' : '＋ Nueva Caja'}
        </button>
      </div>

      {/* Formulario de nueva caja */}
      {showForm && (
        <form
          onSubmit={handleCreateRegister}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <h5 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Nueva Caja Registradora
          </h5>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Nombre de la caja *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej. Caja Principal"
                required
                style={{
                  fontSize: '0.8rem',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-main)',
                  outline: 'none',
                  minHeight: '36px',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Tipo
              </label>
              <select
                value={formKind}
                onChange={(e) => setFormKind(e.target.value as 'operativa' | 'chica')}
                style={{
                  fontSize: '0.8rem',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-main)',
                  outline: 'none',
                  minHeight: '36px',
                }}
              >
                <option value="operativa">Operativa (Principal)</option>
                <option value="chica">Caja Chica (Fondo Menor)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Saldo Inicial ($)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={formBalance}
                onChange={(e) => setFormBalance(e.target.value)}
                placeholder="0.00"
                style={{
                  fontSize: '0.8rem',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-base)',
                  color: 'var(--text-main)',
                  outline: 'none',
                  minHeight: '36px',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-light"
              style={{ minHeight: '44px', fontSize: '0.82rem' }}
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ minHeight: '44px', fontSize: '0.82rem' }}
              disabled={isSaving}
            >
              {isSaving ? 'Guardando...' : 'Crear Caja'}
            </button>
          </div>
        </form>
      )}

      {/* Tabla de cajas */}
      {isLoading ? (
        <TableSkeleton />
      ) : registers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          No hay cajas registradas. Crea la primera caja con el botón de arriba.
        </div>
      ) : (
        <div className="phone-table-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surface)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Nombre</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Tipo</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Saldo</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Estado</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {registers.map((reg) => (
                <tr
                  key={reg.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    transition: 'background 0.15s',
                    opacity: reg.active ? 1 : 0.65,
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-hover, #EDF3E8)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = '')}
                >
                  <td style={{ padding: '11px 12px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {reg.name}
                  </td>
                  <td style={{ padding: '11px 12px', color: 'var(--text-muted)' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: reg.kind === 'operativa' ? '#E1EBDC' : '#FBF3E1',
                      color: reg.kind === 'operativa' ? '#2F4A38' : '#7A5A1F',
                      border: `1px solid ${reg.kind === 'operativa' ? '#B8CDB2' : '#EBD6A4'}`,
                    }}>
                      {reg.kind === 'operativa' ? 'Operativa' : 'Caja Chica'}
                    </span>
                  </td>
                  <td style={{
                    padding: '11px 12px',
                    textAlign: 'right',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
                    color: reg.balance > 0 ? 'var(--success, #2F4A38)' : reg.balance < 0 ? 'var(--danger, #B2603F)' : 'var(--text-muted)',
                  }}>
                    {formatCurrency(reg.balance)}
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: reg.active ? '#E1EBDC' : '#F0F0EE',
                      color: reg.active ? '#2F4A38' : '#6F7B72',
                      border: `1px solid ${reg.active ? '#B8CDB2' : '#D7DDCF'}`,
                    }}>
                      {reg.active ? '● Activa' : '○ Archivada'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        type="button"
                        className={reg.active ? 'btn btn-light' : 'btn btn-primary'}
                        style={{ fontSize: '0.75rem', minHeight: '32px', padding: '4px 10px' }}
                        onClick={() => handleToggle(reg)}
                        title={reg.active ? 'Desactivar para archivar' : 'Reactivar caja'}
                      >
                        {reg.active ? 'Desactivar' : 'Reactivar'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ fontSize: '0.75rem', minHeight: '32px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => handleDelete(reg)}
                        title="Quitar caja del sistema"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Quitar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
