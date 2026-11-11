import React, { useState, useEffect, useCallback } from 'react';
import { CajaChicaSummary, CajaChicaType } from '../../types';
import { CajaChicaService } from '../../services/cajaChica.service';
import { useAuth } from '../../context/AuthContext';
import { useFeedback } from '../../context/FeedbackContext';
import { MetricCard } from '../MetricCard';

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
      showToast('⚠️ Ingresa un monto válido mayor a 0.', true);
      return;
    }

    if (opType === 'gasto' && amt - summary.balance > 0.005) {
      showToast(`⚠️ Saldo insuficiente en Caja Chica. Saldo disponible: $${summary.balance.toFixed(2)}`, true);
      return;
    }

    try {
      await CajaChicaService.addMovement({
        type: opType,
        category: opType === 'ingreso' ? 'Inyección de Fondo' : category,
        desc: desc.trim() || (opType === 'ingreso' ? 'Carga de fondo' : 'Gasto operativo'),
        amount: amt,
      });

      showToast(`✅ Movimiento de Caja Chica registrado con éxito.`);
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
      showToast('⚠️ Solo el Dueño / Administrador puede eliminar registros de caja chica.', true);
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
                  className={`p-2.5 rounded-lg text-xs font-semibold border transition-all ${
                    opType === 'gasto'
                      ? 'border-[#B2603F] bg-[#F8EBE4] text-[#7E3F27] shadow-xs'
                      : 'border-[#D7DDCF] bg-[#F7F8F3] text-[#6F7B72] hover:bg-[#EEF1E8]'
                  }`}
                >
                  🔴 Gasto / Egreso Menor
                </button>
                <button
                  type="button"
                  onClick={() => setOpType('ingreso')}
                  className={`p-2.5 rounded-lg text-xs font-semibold border transition-all ${
                    opType === 'ingreso'
                      ? 'border-[#4F6F52] bg-[#E1EBDC] text-[#2F4A38] shadow-xs'
                      : 'border-[#D7DDCF] bg-[#F7F8F3] text-[#6F7B72] hover:bg-[#EEF1E8]'
                  }`}
                >
                  🟢 Inyección / Carga de Fondo
                </button>
              </div>
            </div>

            {opType === 'gasto' && (
              <div className="form-group">
                <label className="text-xs font-semibold text-[#46524A] block mb-1">
                  Categoría del Gasto:
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                >
                  <option value="Alimentación y Refrigerios">🍔 Alimentación y Refrigerios</option>
                  <option value="Papelería y Útiles de Oficina">📁 Papelería y Útiles de Oficina</option>
                  <option value="Artículos de Limpieza y Aseo">🧹 Artículos de Limpieza y Aseo</option>
                  <option value="Mensajería y Envíos Locales">🛵 Mensajería y Envíos Locales</option>
                  <option value="Transporte y Combustible">⛽ Transporte y Combustible</option>
                  <option value="Otros Gastos Operativos Menores">📦 Otros Gastos Operativos Menores</option>
                </select>
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
                          <span className="badge badge-cat text-[10px]">{m.category}</span>
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
