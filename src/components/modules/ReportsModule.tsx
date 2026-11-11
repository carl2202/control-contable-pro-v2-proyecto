import React, { useState, useEffect, useCallback } from 'react';
import { ReportsSummary } from '../../types';
import { ReportsService } from '../../services/reports.service';
import { DatesService } from '../../services/dates.service';
import { useAuth } from '../../context/AuthContext';
import { MetricCard } from '../MetricCard';

interface ReportsModuleProps {
  onExportCSV: () => void;
}

export function ReportsModule({ onExportCSV }: ReportsModuleProps) {
  const { isOwner, user } = useAuth();
  const [activeDate, setActiveDate] = useState<string>('TODOS');
  const [dates, setDates] = useState<string[]>([]);
  const [summary, setSummary] = useState<ReportsSummary>({
    salesTotal: 0,
    expensesTotal: 0,
    salesTax: 0,
    expensesTax: 0,
    taxTotal: 0,
    netProfit: null,
    isOwnerView: false,
    clothingPurchases: 0,
    foodExpenses: 0,
    utilityExpenses: 0,
    otherExpenses: 0,
    totalSpent: 0,
    chartData: [],
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadDates = useCallback(async () => {
    try {
      const list = await DatesService.getAll();
      setDates(list || []);
    } catch (err) {
      console.error('Error cargando fechas en reportes:', err);
    }
  }, []);

  const loadSummary = useCallback(async (dateFilter: string) => {
    setIsLoading(true);
    try {
      const data = await ReportsService.getSummary(dateFilter);
      setSummary(data);
    } catch (err) {
      console.error('Error cargando resumen de reportes:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDates();
  }, [loadDates]);

  useEffect(() => {
    loadSummary(activeDate);
  }, [activeDate, loadSummary]);

  return (
    <div className="section-view active space-y-4">
      {/* Barra de Filtro de Reporte */}
      <div className="date-control-bar flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#2F4A38] flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            Período del Reporte:
          </label>
          <select
            value={activeDate}
            onChange={(e) => setActiveDate(e.target.value)}
            className="text-xs p-1.5 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
          >
            <option value="TODOS">Todo el Historial Acumulado</option>
            {dates.map((d) => (
              <option key={d} value={d}>
                Fecha: {d}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={onExportCSV}
          className="btn btn-success text-xs flex items-center gap-1.5"
        >
          <span>📥 Descargar Respaldo Integral CSV</span>
        </button>
      </div>

      {/* Métricas Principales */}
      <div className="metrics-grid">
        <MetricCard
          label="Ventas Totales"
          value={summary.salesTotal}
          tone="success"
          iconType="up"
          subtitle="Ingresos brutos facturados"
        />
        <MetricCard
          label="Total Gastado"
          value={summary.totalSpent || summary.expensesTotal}
          tone="danger"
          iconType="down"
          subtitle="Ropa + comida + serv. + caja chica"
        />
        <MetricCard
          label="IVA Neto (13%)"
          value={summary.taxTotal}
          tone="warning"
          iconType="pct"
          subtitle={`Débito: $${summary.salesTax.toFixed(2)} | Crédito: $${summary.expensesTax.toFixed(2)}`}
        />
        <MetricCard
          label="Ganancia Neta"
          value={
            isOwner || user?.role === 'dueno'
              ? summary.netProfit !== null
                ? summary.netProfit
                : summary.salesTotal - summary.expensesTotal
              : 'Protegido (Dueño)'
          }
          tone="primary"
          iconType="cash"
          isProfitCard={true}
          subtitle="Ventas menos total gastado"
        />
      </div>

      {/* Desglose Detallado de Gastos & Gráfico de Balance */}
      <div className="workspace">
        {/* Desglose de Egresos según CAMBIOS.md */}
        <div className="card-box space-y-3">
          <h3 className="text-sm font-bold text-[#2F4A38] border-b border-[#CBDCC5] pb-2 mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              Desglose Consolidado de Gastos
            </span>
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#F2F6EE] border border-[#CBDCC5]">
              <span className="text-[#46524A] font-medium">🛍️ Compra de Ropa / Mercadería:</span>
              <span className="font-bold text-[#B2603F]">
                ${summary.clothingPurchases.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#F2F6EE] border border-[#CBDCC5]">
              <span className="text-[#46524A] font-medium">🍔 Alimentación y Refrigerios (Caja Chica):</span>
              <span className="font-bold text-[#B2603F]">
                ${summary.foodExpenses.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#F2F6EE] border border-[#CBDCC5]">
              <span className="text-[#46524A] font-medium">💡 Servicios Básicos (Luz, Agua, Internet):</span>
              <span className="font-bold text-[#B2603F]">
                ${summary.utilityExpenses.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#F2F6EE] border border-[#CBDCC5]">
              <span className="text-[#46524A] font-medium">📦 Otros Gastos Operativos:</span>
              <span className="font-bold text-[#B2603F]">
                ${summary.otherExpenses.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 rounded-lg bg-[#F8EBE4] border border-[#EBCDBE] text-sm font-bold mt-2">
              <span className="text-[#7E3F27]">TOTAL GASTADO CONSOLIDADO:</span>
              <span className="text-[#B2603F]">
                ${(summary.totalSpent || summary.expensesTotal).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Información Fiscal de El Salvador */}
          <div className="p-3 rounded-lg bg-[#EEF1E8] border border-[#D7DDCF] text-xs text-[#46524A] space-y-1">
            <span className="font-semibold text-[#2F4A38] block flex items-center gap-1.5">
              <span>🇸🇻</span> Régimen Fiscal de El Salvador (IVA 13%):
            </span>
            <p className="leading-relaxed">
              El impuesto se calcula sobre el total incluido en las ventas ($
              {summary.salesTax.toFixed(2)}) deduciendo el crédito fiscal de compras y comprobantes ($
              {summary.expensesTax.toFixed(2)}).
            </p>
          </div>
        </div>

        {/* Gráfico / Balance Comparativo de los Últimos 7 Días */}
        <div className="card-box space-y-3">
          <h3 className="text-sm font-bold text-[#2F4A38] border-b border-[#CBDCC5] pb-2 mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              Balance Diario de Operaciones (Últimos 7 Días)
            </span>
          </h3>

          <div className="space-y-3">
            {summary.chartData.length === 0 ? (
              <div className="p-4 text-center text-[#6F7B72] text-xs">
                Aún no hay suficientes operaciones registradas para graficar el balance.
              </div>
            ) : (
              summary.chartData.map((d) => {
                const maxVal = Math.max(d.sales, d.expenses, 1);
                const salesPct = Math.min(100, Math.round((d.sales / maxVal) * 100));
                const expPct = Math.min(100, Math.round((d.expenses / maxVal) * 100));

                return (
                  <div key={d.date} className="p-2.5 rounded-lg bg-[#F2F6EE] border border-[#CBDCC5] space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-[#2F3A33]">{d.date}</span>
                      <div className="flex gap-3 text-[11px]">
                        <span className="text-[#2F4A38] font-bold">Ventas: ${d.sales.toFixed(2)}</span>
                        <span className="text-[#B2603F] font-bold">Gastos: ${d.expenses.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="w-full bg-[#E6EBDF] rounded h-2 overflow-hidden flex">
                        <div
                          className="bg-[#4F6F52] h-full rounded transition-all duration-300"
                          style={{ width: `${salesPct}%` }}
                          title={`Ventas: $${d.sales.toFixed(2)}`}
                        ></div>
                      </div>
                      <div className="w-full bg-[#E6EBDF] rounded h-2 overflow-hidden flex">
                        <div
                          className="bg-[#B2603F] h-full rounded transition-all duration-300"
                          style={{ width: `${expPct}%` }}
                          title={`Gastos: $${d.expenses.toFixed(2)}`}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
