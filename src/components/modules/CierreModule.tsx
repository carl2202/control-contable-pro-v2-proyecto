import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CierreCaja, CierreInventario, InventoryItem } from '../../types';
import { CierresService } from '../../services/cierres.service';
import { InventoryService } from '../../services/inventory.service';
import { MovementsService } from '../../services/movements.service';
import { useAuth } from '../../context/AuthContext';
import { useFeedback } from '../../context/FeedbackContext';
import { MetricCard } from '../MetricCard';

interface CierreModuleProps {
  onRefreshData?: () => void;
}

export function CierreModule({ onRefreshData }: CierreModuleProps) {
  const { isOwner, user } = useAuth();
  const { showToast, confirm } = useFeedback();

  const [activeSubTab, setActiveSubTab] = useState<'caja' | 'inventario'>('caja');
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // History state
  const [cajaClosures, setCajaClosures] = useState<CierreCaja[]>([]);
  const [inventoryClosures, setInventoryClosures] = useState<CierreInventario[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Arqueo de Caja Form State
  const [openingFund, setOpeningFund] = useState<string>('50.00');
  const [cajaDate, setCajaDate] = useState<string>(todayStr);
  const [todaySales, setTodaySales] = useState<number>(0);
  const [todayExpenses, setTodayExpenses] = useState<number>(0);
  const [cajaNote, setCajaNote] = useState<string>('');

  // Cash breakdown quantities (denominations)
  const [breakdown, setBreakdown] = useState<Record<string, number>>({
    b100: 0,
    b50: 0,
    b20: 0,
    b10: 0,
    b5: 0,
    b1: 0,
    c25: 0,
    c10: 0,
    c5: 0,
    c1: 0,
  });

  // Cierre de Inventario Form State
  const [invScope, setInvScope] = useState<string>('GENERAL');
  const [invNote, setInvNote] = useState<string>('');

  // Load Initial Closures Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cajaList, invList, invItems, dayMovs] = await Promise.all([
        CierresService.getCajaClosures(),
        CierresService.getInventoryClosures(),
        InventoryService.getAll(),
        MovementsService.getByDate(todayStr),
      ]);

      setCajaClosures(cajaList || []);
      setInventoryClosures(invList || []);
      setInventoryItems(invItems || []);

      let sales = 0;
      let expenses = 0;
      (dayMovs || []).forEach((m) => {
        if (m.type === 'venta') sales += m.amount;
        else expenses += m.amount;
      });
      setTodaySales(Math.round(sales * 100) / 100);
      setTodayExpenses(Math.round(expenses * 100) / 100);
    } catch (err) {
      console.error('Error cargando datos de cierre:', err);
    } finally {
      setIsLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Denominations list
  const DENOMINATIONS = [
    { key: 'b100', label: 'Billetes $100', val: 100.0 },
    { key: 'b50', label: 'Billetes $50', val: 50.0 },
    { key: 'b20', label: 'Billetes $20', val: 20.0 },
    { key: 'b10', label: 'Billetes $10', val: 10.0 },
    { key: 'b5', label: 'Billetes $5', val: 5.0 },
    { key: 'b1', label: 'Billetes $1', val: 1.0 },
    { key: 'c25', label: 'Monedas $0.25 (Coras)', val: 0.25 },
    { key: 'c10', label: 'Monedas $0.10', val: 0.1 },
    { key: 'c5', label: 'Monedas $0.05', val: 0.05 },
    { key: 'c1', label: 'Monedas $0.01', val: 0.01 },
  ];

  // Counted total from cash drawer
  const countedTotal = useMemo(() => {
    let totalCents = 0;
    DENOMINATIONS.forEach((d) => {
      const qty = breakdown[d.key] || 0;
      totalCents += Math.round(d.val * 100) * qty;
    });
    return totalCents / 100;
  }, [breakdown]);

  // Expected Total
  const expectedTotal = useMemo(() => {
    const fund = parseFloat(openingFund) || 0;
    return Math.round((fund + todaySales - todayExpenses) * 100) / 100;
  }, [openingFund, todaySales, todayExpenses]);

  // Difference
  const cashDifference = useMemo(() => {
    return Math.round((countedTotal - expectedTotal) * 100) / 100;
  }, [countedTotal, expectedTotal]);

  // Inventory valuation calculations
  const inventoryValuation = useMemo(() => {
    let totalUnits = 0;
    let totalCostValue = 0;
    let totalSaleValue = 0;

    const filtered =
      invScope === 'GENERAL'
        ? inventoryItems
        : inventoryItems.filter((i) => i.category === invScope);

    filtered.forEach((item) => {
      item.variants.forEach((v) => {
        totalUnits += v.stock;
        totalCostValue += (v.cost || 0) * v.stock;
        totalSaleValue += v.price * v.stock;
      });
    });

    const margin = totalSaleValue - totalCostValue;
    const marginPct = totalSaleValue > 0 ? (margin / totalSaleValue) * 100 : 0;

    return {
      totalUnits,
      totalCostValue: Math.round(totalCostValue * 100) / 100,
      totalSaleValue: Math.round(totalSaleValue * 100) / 100,
      margin: Math.round(margin * 100) / 100,
      marginPct: Math.round(marginPct * 10) / 10,
    };
  }, [inventoryItems, invScope]);

  // Submit Arqueo de Caja
  const handleSubmitCajaClosure = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await CierresService.createCajaClosure({
        date: cajaDate,
        cashierName: user?.displayName || 'Cajero de Turno',
        cashierRole: user?.role || 'empleado',
        openingFund: parseFloat(openingFund) || 0,
        salesTotal: todaySales,
        expensesTotal: todayExpenses,
        expectedTotal,
        countedTotal,
        difference: cashDifference,
        breakdown,
        note: cajaNote,
      });

      showToast('✅ Arqueo de caja guardado con éxito en el historial.');
      setCajaNote('');
      loadData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar arqueo de caja.', true);
    }
  };

  // Submit Snapshot de Inventario
  const handleSubmitInventoryClosure = async (e: React.FormEvent) => {
    e.preventDefault();

    const ok = await confirm({
      title: 'Congelar Cierre de Inventario',
      message: `Se creará un snapshot permanente del inventario (${invScope}) valorado a costo.\n¿Deseas registrarlo ahora?`,
      confirmText: 'Crear Snapshot',
    });

    if (!ok) return;

    try {
      await CierresService.createInventoryClosure({
        date: todayStr,
        scope: invScope,
        categories: invScope === 'GENERAL' ? ['TODAS'] : [invScope],
        note: invNote,
        totals: {
          totalUnits: inventoryValuation.totalUnits,
          totalCostValue: inventoryValuation.totalCostValue,
          totalSaleValue: inventoryValuation.totalSaleValue,
          potentialMargin: inventoryValuation.margin,
        },
        items: inventoryItems,
      });

      showToast('✅ Snapshot de inventario congelado con éxito.');
      setInvNote('');
      loadData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar cierre de inventario.', true);
    }
  };

  // Delete Caja Closure (Dueño only)
  const handleDeleteCajaClosure = async (id: number) => {
    if (!isOwner) {
      showToast('⚠️ Solo el Dueño / Administrador puede eliminar arqueos del historial.', true);
      return;
    }
    const ok = await confirm({
      title: 'Eliminar arqueo de caja',
      message: '¿Estás seguro de eliminar este registro de arqueo?',
      tone: 'danger',
      confirmText: 'Eliminar',
    });
    if (!ok) return;

    try {
      await CierresService.deleteCajaClosure(id);
      showToast('Arqueo eliminado con éxito.', false, 'info');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar arqueo.', true);
    }
  };

  // Delete Inventory Closure (Dueño only)
  const handleDeleteInventoryClosure = async (id: number) => {
    if (!isOwner) {
      showToast('⚠️ Solo el Dueño / Administrador puede eliminar snapshots de inventario.', true);
      return;
    }
    const ok = await confirm({
      title: 'Eliminar snapshot de inventario',
      message: '¿Estás seguro de eliminar este snapshot congelado?',
      tone: 'danger',
      confirmText: 'Eliminar',
    });
    if (!ok) return;

    try {
      await CierresService.deleteInventoryClosure(id);
      showToast('Snapshot eliminado con éxito.', false, 'info');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar snapshot.', true);
    }
  };

  return (
    <div className="section-view active space-y-4">
      {/* Selector de Sub-Pestaña: Arqueo de Caja vs Cierre de Inventario */}
      <div className="flex items-center gap-2 border-b border-[#CBDCC5] pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('caja')}
          className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all ${
            activeSubTab === 'caja'
              ? 'bg-[#E1EBDC] text-[#2F4A38] border-b-2 border-[#4F6F52] shadow-xs'
              : 'text-[#6F7B72] hover:text-[#2F3A33] hover:bg-[#EEF1E8]'
          }`}
        >
          💵 F6.1 Arqueo Diario de Caja
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('inventario')}
          className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-all ${
            activeSubTab === 'inventario'
              ? 'bg-[#E1EBDC] text-[#2F4A38] border-b-2 border-[#4F6F52] shadow-xs'
              : 'text-[#6F7B72] hover:text-[#2F3A33] hover:bg-[#EEF1E8]'
          }`}
        >
          📦 F6.2 Cierre de Inventario (Snapshots)
        </button>
      </div>

      {/* ---------------- PESTAÑA 1: ARQUEO DE CAJA ---------------- */}
      {activeSubTab === 'caja' && (
        <div className="space-y-4">
          <div className="metrics-grid">
            <MetricCard
              label="Fondo Inicial"
              value={parseFloat(openingFund) || 0}
              tone="primary"
              iconType="wallet"
              subtitle="Caja base de apertura"
            />
            <MetricCard
              label="Efectivo Esperado"
              value={expectedTotal}
              tone="warning"
              iconType="cash"
              subtitle={`Apertura + $${todaySales.toFixed(2)} - $${todayExpenses.toFixed(2)}`}
            />
            <MetricCard
              label="Total Recontado"
              value={countedTotal}
              tone={countedTotal >= expectedTotal ? 'success' : 'danger'}
              iconType="check"
              subtitle="Suma física en gaveta"
            />
            <MetricCard
              label="Diferencia de Cuadre"
              value={`${cashDifference >= 0 ? '+' : ''}$${cashDifference.toFixed(2)}`}
              tone={cashDifference === 0 ? 'success' : cashDifference > 0 ? 'warning' : 'danger'}
              iconType="pct"
              subtitle={
                cashDifference === 0
                  ? 'Cuadre perfecto'
                  : cashDifference > 0
                  ? 'Sobrante en caja'
                  : 'Faltante en caja'
              }
            />
          </div>

          <div className="workspace">
            {/* Formulario de Conteo de Denominaciones */}
            <div className="card-box">
              <h3 className="text-sm font-bold text-[#2F4A38] border-b border-[#CBDCC5] pb-2 mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
                    <path d="M12 18V6"/>
                  </svg>
                  Conteo Físico de Efectivo por Denominación
                </span>
              </h3>

              <form onSubmit={handleSubmitCajaClosure} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-[#46524A] block mb-1">
                      Fecha de Arqueo:
                    </label>
                    <input
                      type="date"
                      value={cajaDate}
                      onChange={(e) => setCajaDate(e.target.value)}
                      className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#46524A] block mb-1">
                      Fondo Inicial de Apertura ($):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={openingFund}
                      onChange={(e) => setOpeningFund(e.target.value)}
                      className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] font-bold focus:border-[#4F6F52] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#CBDCC5]">
                  {DENOMINATIONS.map((d) => (
                    <div
                      key={d.key}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#F2F6EE] border border-[#CBDCC5] text-xs"
                    >
                      <span className="text-[#46524A] font-medium">{d.label}:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={breakdown[d.key] || 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setBreakdown((prev) => ({ ...prev, [d.key]: Math.max(0, val) }));
                          }}
                          className="w-14 p-1 text-center font-bold text-xs bg-[#FFFFFF] border border-[#D7DDCF] rounded text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                        />
                        <span className="text-[10px] text-[#6F7B72] w-12 text-right font-medium">
                          ${((breakdown[d.key] || 0) * d.val).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-lg bg-[#E1EBDC] border border-[#B8CDB2] flex justify-between items-center text-xs">
                  <span className="font-bold text-[#2F4A38]">TOTAL EFECTIVO RECONTADO:</span>
                  <span className="text-sm font-bold text-[#2F4A38]">
                    ${countedTotal.toFixed(2)}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#46524A] block mb-1">
                    Observaciones / Notas del Turno:
                  </label>
                  <input
                    type="text"
                    value={cajaNote}
                    onChange={(e) => setCajaNote(e.target.value)}
                    placeholder="Ej. Cierre conforme sin discrepancias..."
                    className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                  />
                </div>

                <button type="submit" className="btn btn-primary w-full py-2 font-semibold text-xs">
                  Guardar Arqueo y Cierre de Caja
                </button>
              </form>
            </div>

            {/* Historial de Cierres de Caja */}
            <div className="card-box space-y-3">
              <div className="flex justify-between items-center border-b border-[#CBDCC5] pb-2">
                <h3 className="text-sm font-bold text-[#2F4A38] flex items-center gap-2 m-0 border-0 p-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                    <rect x="2" y="7" width="20" height="14" rx="2" />
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  </svg>
                  Historial de Arqueos de Caja ({cajaClosures.length})
                </h3>
              </div>

              <div className="table-responsive-container">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#CBDCC5] bg-[#EDF3E8] text-[#2F4A38]">
                      <th className="p-2.5">Fecha / Hora</th>
                      <th className="p-2.5">Cajero</th>
                      <th className="p-2.5 text-right">Esperado</th>
                      <th className="p-2.5 text-right">Recontado</th>
                      <th className="p-2.5 text-center">Diferencia</th>
                      <th className="p-2.5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cajaClosures.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-[#6F7B72]">
                          Aún no hay arqueos registrados en el sistema.
                        </td>
                      </tr>
                    ) : (
                      cajaClosures.map((c) => (
                        <tr key={c.id} className="border-b border-[#E6EBDF] hover:bg-[#E6EBDF]/60 transition-colors">
                          <td className="p-2.5 whitespace-nowrap text-[#6F7B72]">
                            {c.date} <span className="text-[10px] text-[#9AA59C] block">{c.time}</span>
                          </td>
                          <td className="p-2.5 text-[#2F3A33] font-medium">{c.cashierName}</td>
                          <td className="p-2.5 text-right font-medium text-[#46524A]">
                            ${c.expectedTotal.toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-bold text-[#2F4A38]">
                            ${c.countedTotal.toFixed(2)}
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            <span
                              className={`badge ${
                                c.difference === 0
                                  ? 'badge-pagado'
                                  : c.difference > 0
                                  ? 'badge-cajachica'
                                  : 'badge-egreso'
                              }`}
                            >
                              {c.difference === 0
                                ? 'EXACTO'
                                : `${c.difference > 0 ? '+' : ''}$${c.difference.toFixed(2)}`}
                            </span>
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            {isOwner && (
                              <button
                                type="button"
                                className="btn btn-danger btn-table-action text-[11px] px-2 py-0.5"
                                onClick={() => handleDeleteCajaClosure(c.id)}
                                title="Eliminar arqueo"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- PESTAÑA 2: CIERRE DE INVENTARIO ---------------- */}
      {activeSubTab === 'inventario' && (
        <div className="space-y-4">
          <div className="metrics-grid">
            <MetricCard
              label="Prendas en Bodega"
              value={`${inventoryValuation.totalUnits} un.`}
              tone="primary"
              iconType="box"
              subtitle="Stock total contabilizado"
            />
            <MetricCard
              label="Valor a Costo"
              value={inventoryValuation.totalCostValue}
              tone="warning"
              iconType="cash"
              subtitle="Capital invertido en prendas"
            />
            <MetricCard
              label="Valor a Precio Venta"
              value={inventoryValuation.totalSaleValue}
              tone="success"
              iconType="up"
              subtitle="Venta proyectada total"
            />
            <MetricCard
              label="Margen Bruto Proyectado"
              value={`$${inventoryValuation.margin.toFixed(2)} (${inventoryValuation.marginPct}%)`}
              tone="primary"
              iconType="pct"
              isProfitCard={true}
              subtitle="Utilidad potencial al vender todo"
            />
          </div>

          <div className="workspace">
            {/* Snapshot Trigger Form */}
            <div className="card-box space-y-3">
              <h3 className="text-sm font-bold text-[#2F4A38] border-b border-[#CBDCC5] pb-2 mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  Congelar Snapshot de Inventario
                </span>
              </h3>

              <form onSubmit={handleSubmitInventoryClosure} className="space-y-3">
                <div className="form-group">
                  <label className="text-xs font-semibold text-[#46524A] block mb-1">
                    Alcance del Cierre:
                  </label>
                  <select
                    value={invScope}
                    onChange={(e) => setInvScope(e.target.value)}
                    className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                  >
                    <option value="GENERAL">Inventario Completo (Todas las Categorías)</option>
                    <option value="Camisa">Solo Camisas</option>
                    <option value="Pantalón">Solo Pantalones</option>
                    <option value="Vestido">Solo Vestidos</option>
                    <option value="Falda">Solo Faldas</option>
                    <option value="Short">Solo Shorts</option>
                    <option value="Calzado">Solo Calzado</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-xs font-semibold text-[#46524A] block mb-1">
                    Nota / Motivo del Cierre:
                  </label>
                  <input
                    type="text"
                    value={invNote}
                    onChange={(e) => setInvNote(e.target.value)}
                    placeholder="Ej. Cierre de fin de mes / balance trimestral..."
                    className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                  />
                </div>

                <div className="p-3 rounded-lg bg-[#F2F6EE] border border-[#CBDCC5] text-xs text-[#46524A] space-y-1.5">
                  <div className="flex justify-between">
                    <span>Unidades a congelar:</span>
                    <b className="text-[#2F3A33]">{inventoryValuation.totalUnits} prendas</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Valoración a Costo:</span>
                    <b className="text-[#B58A3C]">${inventoryValuation.totalCostValue.toFixed(2)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Valoración a Venta:</span>
                    <b className="text-[#2F4A38]">${inventoryValuation.totalSaleValue.toFixed(2)}</b>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary w-full py-2 font-semibold text-xs">
                  📸 Congelar Snapshot de Inventario
                </button>
              </form>
            </div>

            {/* Historial de Snapshots Congelados */}
            <div className="card-box space-y-3">
              <div className="flex justify-between items-center border-b border-[#CBDCC5] pb-2">
                <h3 className="text-sm font-bold text-[#2F4A38] flex items-center gap-2 m-0 border-0 p-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  Snapshots Congelados de Inventario ({inventoryClosures.length})
                </h3>
              </div>

              <div className="table-responsive-container">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#CBDCC5] bg-[#EDF3E8] text-[#2F4A38]">
                      <th className="p-2.5">Fecha / Hora</th>
                      <th className="p-2.5">Alcance</th>
                      <th className="p-2.5 text-right">Unidades</th>
                      <th className="p-2.5 text-right">Valor Costo</th>
                      <th className="p-2.5 text-right">Valor Venta</th>
                      <th className="p-2.5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryClosures.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-[#6F7B72]">
                          Aún no se han guardado snapshots de inventario.
                        </td>
                      </tr>
                    ) : (
                      inventoryClosures.map((snap) => (
                        <tr key={snap.id} className="border-b border-[#E6EBDF] hover:bg-[#E6EBDF]/60 transition-colors">
                          <td className="p-2.5 whitespace-nowrap text-[#6F7B72]">
                            {snap.date} <span className="text-[10px] text-[#9AA59C] block">{snap.time}</span>
                          </td>
                          <td className="p-2.5">
                            <span className="badge badge-cat text-[10px]">{snap.scope}</span>
                            {snap.note && <span className="block text-[10px] text-[#6F7B72] mt-0.5">{snap.note}</span>}
                          </td>
                          <td className="p-2.5 text-right font-medium text-[#2F3A33]">
                            {snap.totals.totalUnits} un.
                          </td>
                          <td className="p-2.5 text-right font-bold text-[#B58A3C]">
                            ${snap.totals.totalCostValue.toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-bold text-[#2F4A38]">
                            ${snap.totals.totalSaleValue.toFixed(2)}
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            {isOwner && (
                              <button
                                type="button"
                                className="btn btn-danger btn-table-action text-[11px] px-2 py-0.5"
                                onClick={() => handleDeleteInventoryClosure(snap.id)}
                                title="Eliminar snapshot"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
