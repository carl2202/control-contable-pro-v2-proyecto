import React, { useState, useEffect, useCallback } from 'react';
import { CajaChicaSummary, CajaChicaType } from '../../types';
import { CajaChicaService } from '../../services/cajaChica.service';
import { useAuth } from '../../context/AuthContext';
import { useFeedback } from '../../context/FeedbackContext';
import { MetricCard } from '../MetricCard';

/** Icono SVG moderno según categoría de Caja Chica */
function CategoryIcon({ category, size = 14 }: { category: string; size?: number }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (category) {
    case 'Alimentación y Refrigerios':
      return <svg {...props}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>;
    case 'Papelería y Útiles de Oficina':
      return <svg {...props}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a1 1 0 0 0 1 1h3"/><path d="M10 13h4"/><path d="M10 17h4"/></svg>;
    case 'Artículos de Limpieza y Aseo':
      return <svg {...props}><path d="m12 3-1.9 12.2a1 1 0 0 0 1 1.1h1.8a1 1 0 0 0 1-1.1L12 3Z"/><path d="M6.6 18.4a2 2 0 0 0 1.4.6h8a2 2 0 0 0 1.4-.6l2-2a1 1 0 0 0 0-1.4l-1-1a1 1 0 0 0-1.4 0L16 15l-1-1-1 1-1-1-1 1-1-1L9.4 15a1 1 0 0 0-1.4 0l-1 1a1 1 0 0 0 0 1.4Z"/></svg>;
    case 'Mensajería y Envíos Locales':
      return <svg {...props}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>;
    case 'Transporte y Combustible':
      return <svg {...props}><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12.1 1 13v3c0 .6.4 1 1 1h1"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>;
    case 'Inyección de Fondo':
      return <svg {...props}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>;
    default: // Otros Gastos Operativos Menores
      return <svg {...props}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>;
  }
}

interface CajaChicaModuleProps {
  onRefreshData?: () => void;
}

export function CajaChicaModule({ onRefreshData }: CajaChicaModuleProps) {
  const { isOwner } = useAuth();
  const { showToast, confirm } = useFeedback();

  const [summary, setSummary] = useState<CajaChicaSummary>({
    balance: 0,
    totalIn: 0,
    totalOut: 0,
    movements: [],
  });

  const [opType, setOpType] = useState<CajaChicaType>('gasto');
  const [category, setCategory] = useState<string>('Alimentación y Refrigerios');
  const [desc, setDesc] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadCajaChica = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await CajaChicaService.getSummary();
      setSummary(data);
    } catch (err) {
      console.error('Error cargando caja chica:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCajaChica();
  }, [loadCajaChica]);

  // Submit New Movement
  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Ingresa un monto válido mayor a 0.', true);
      return;
    }

    if (opType === 'gasto' && amt - summary.balance > 0.005) {
      showToast(`Saldo insuficiente en Caja Chica. Saldo disponible: $${summary.balance.toFixed(2)}`, true);
      return;
    }

    try {
      await CajaChicaService.addMovement({
        type: opType,
        category: opType === 'ingreso' ? 'Inyección de Fondo' : category,
        desc: desc.trim() || (opType === 'ingreso' ? 'Carga de fondo' : 'Gasto operativo'),
        amount: amt,
      });

      showToast(`Movimiento de Caja Chica registrado con éxito.`);
      setDesc('');
      setAmount('');
      loadCajaChica();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al registrar en caja chica.', true);
    }
  };

  // Delete Movement
  const handleDeleteMovement = async (id: number) => {
    if (!isOwner) {
      showToast('Solo el Dueño / Administrador puede eliminar registros de caja chica.', true);
      return;
    }

    const ok = await confirm({
      title: 'Eliminar movimiento de caja chica',
      message: `¿Estás seguro de eliminar este movimiento?\nSi fue un gasto desde Contable, el registro espejo también se eliminará.`,
      tone: 'danger',
      confirmText: 'Eliminar Movimiento',
    });

    if (!ok) return;

    try {
      await CajaChicaService.deleteMovement(id);
      showToast('Movimiento eliminado con éxito.', false, 'info');
      loadCajaChica();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar movimiento de caja chica.', true);
    }
  };

  return (
    <div className="section-view active space-y-4">
      {/* Tarjetas de Métricas de Caja Chica */}
      <div className="metrics-grid">
        <MetricCard
          label="Saldo Disponible"
          value={summary.balance}
          tone={summary.balance > 25 ? 'success' : 'danger'}
          iconType="wallet"
          subtitle="Fondo en efectivo actual"
        />
        <MetricCard
          label="Total Fondos Cargados"
          value={summary.totalIn}
          tone="primary"
          iconType="up"
          subtitle="Inyecciones de efectivo"
        />
        <MetricCard
          label="Total Gastos Realizados"
          value={summary.totalOut}
          tone="danger"
          iconType="down"
          subtitle="Egresos menores autorizados"
        />
        <MetricCard
          label="Movimientos Totales"
          value={`${summary.movements.length} ops`}
          tone="warning"
          iconType="check"
          subtitle="Historial de arqueo"
        />
      </div>

      <div className="workspace">
        {/* Formulario de Caja Chica */}
        <div className="card-box">
          <h3 className="text-sm font-bold text-[#2F4A38] border-b border-[#CBDCC5] pb-2 mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M7 15h0M2 9.5h20" />
              </svg>
              Registrar Movimiento en Caja Chica
            </span>
          </h3>

          <form onSubmit={handleSubmitMovement} className="space-y-3">
            <div className="form-group">
              <label className="text-xs font-semibold text-[#46524A] block mb-1">
                Tipo de Operación:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOpType('gasto')}
                  className={`p-2.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-2 ${
                    opType === 'gasto'
                      ? 'border-[#B2603F] bg-[#B2603F] text-white shadow-sm'
                      : 'border-[#D7DDCF] bg-[#F7F8F3] text-[#46524A] hover:bg-[#EEF1E8]'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="19 12 12 19 5 12" />
                  </svg>
                  Gasto / Egreso Menor
                </button>
                <button
                  type="button"
                  onClick={() => setOpType('ingreso')}
                  className={`p-2.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-2 ${
                    opType === 'ingreso'
                      ? 'border-[#4F6F52] bg-[#4F6F52] text-white shadow-sm'
                      : 'border-[#D7DDCF] bg-[#F7F8F3] text-[#46524A] hover:bg-[#EEF1E8]'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                  Inyección de Fondo
                </button>
              </div>
            </div>

            {opType === 'gasto' && (
              <div className="form-group">
                <label className="text-xs font-semibold text-[#46524A] block mb-1">
                  Categoría del Gasto:
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4F6F52] pointer-events-none">
                    <CategoryIcon category={category} size={15} />
                  </span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs p-2 pl-9 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                  >
                    <option value="Alimentación y Refrigerios">Alimentación y Refrigerios</option>
                    <option value="Papelería y Útiles de Oficina">Papelería y Útiles de Oficina</option>
                    <option value="Artículos de Limpieza y Aseo">Artículos de Limpieza y Aseo</option>
                    <option value="Mensajería y Envíos Locales">Mensajería y Envíos Locales</option>
                    <option value="Transporte y Combustible">Transporte y Combustible</option>
                    <option value="Otros Gastos Operativos Menores">Otros Gastos Operativos Menores</option>
                  </select>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="text-xs font-semibold text-[#46524A] block mb-1">
                Descripción / Justificación:
              </label>
              <input
                type="text"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Ej. Compra de bolsas plásticas y cinta..."
                required
                className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
              />
            </div>

            <div className="form-group">
              <label className="text-xs font-semibold text-[#46524A] block mb-1">
                Monto ($):
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] font-bold focus:border-[#4F6F52] outline-none"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full py-2 font-semibold text-xs"
            >
              Guardar en Caja Chica
            </button>
          </form>
        </div>

        {/* Tabla de Movimientos de Caja Chica */}
        <div className="card-box space-y-3">
          <div className="flex justify-between items-center border-b border-[#CBDCC5] pb-2">
            <h3 className="text-sm font-bold text-[#2F4A38] flex items-center gap-2 m-0 border-0 p-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              Libro de Movimientos de Caja Chica ({summary.movements.length})
            </h3>
            <span className="text-xs text-[#2F4A38] font-bold bg-[#E1EBDC] px-2.5 py-1 rounded-md border border-[#B8CDB2]">
              Saldo Neto: ${summary.balance.toFixed(2)}
            </span>
          </div>

          <div className="table-responsive-container">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#CBDCC5] bg-[#EDF3E8] text-[#2F4A38]">
                  <th className="p-2.5">Fecha / Hora</th>
                  <th className="p-2.5">Tipo</th>
                  <th className="p-2.5">Categoría</th>
                  <th className="p-2.5">Concepto</th>
                  <th className="p-2.5 text-right">Monto ($)</th>
                  <th className="p-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {summary.movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-[#6F7B72]">
                      No hay movimientos registrados en Caja Chica.
                    </td>
                  </tr>
                ) : (
                  summary.movements.map((m) => {
                    const isIn = m.type === 'ingreso';
                    return (
                      <tr key={m.id} className="border-b border-[#E6EBDF] hover:bg-[#E6EBDF]/60 transition-colors">
                        <td className="p-2.5 whitespace-nowrap text-[#6F7B72]">
                          {m.date}
                          <span className="block text-[10px] text-[#9AA59C]">{m.time}</span>
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span
                            className={`badge ${
                              isIn ? 'badge-ingreso' : 'badge-egreso'
                            }`}
                          >
                            {isIn ? 'INGRESO' : 'GASTO'}
                          </span>
                        </td>
                        <td className="p-2.5 whitespace-nowrap text-[#46524A]">
                          <span className="badge badge-cat text-[10px] inline-flex items-center gap-1.5">
                            <span className="text-[#4F6F52]"><CategoryIcon category={m.category} size={13} /></span>
                            {m.category}
                          </span>
                        </td>
                        <td className="p-2.5 text-[#2F3A33] font-medium">{m.desc}</td>
                        <td
                          className={`p-2.5 text-right font-bold whitespace-nowrap ${
                            isIn ? 'text-[#2F4A38]' : 'text-[#B2603F]'
                          }`}
                        >
                          {isIn ? '+' : '-'}${m.amount.toFixed(2)}
                        </td>
                        <td className="p-2 text-center whitespace-nowrap">
                          {isOwner ? (
                            <button
                              type="button"
                              className="btn btn-danger btn-table-action text-[11px] px-2 py-0.5"
                              onClick={() => handleDeleteMovement(m.id)}
                              title="Eliminar movimiento"
                            >
                              ✕
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-500 italic">Solo Dueño</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
