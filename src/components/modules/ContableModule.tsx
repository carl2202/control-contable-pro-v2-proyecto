import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Movement, InventoryItem, DocType, MovementType, CalendarMap } from '../../types';
import { MovementsService } from '../../services/movements.service';
import { DatesService } from '../../services/dates.service';
import { InventoryService } from '../../services/inventory.service';
import { CajaChicaService } from '../../services/cajaChica.service';
import { CalendarService } from '../../services/calendar.service';
import { useAuth } from '../../context/AuthContext';
import { useFeedback } from '../../context/FeedbackContext';
import { MetricCard } from '../MetricCard';

interface ContableModuleProps {
  onRefreshData?: () => void;
}

export function ContableModule({ onRefreshData }: ContableModuleProps) {
  const { isOwner, user } = useAuth();
  const { showToast, confirm } = useFeedback();

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // State
  const [activeTab, setActiveTab] = useState<string>(todayStr);
  const [activeDates, setActiveDates] = useState<string[]>([todayStr]);
  const [newDateInput, setNewDateInput] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [movements, setMovements] = useState<Movement[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [calendarMap, setCalendarMap] = useState<CalendarMap>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form State
  const [opType, setOpType] = useState<MovementType>('venta');
  const [docType, setDocType] = useState<DocType>('Factura');
  const [customDesc, setCustomDesc] = useState<string>('');
  const [manualAmount, setManualAmount] = useState<string>('');
  const [ccCategory, setCcCategory] = useState<string>('Alimentación y Refrigerios');
  const [voucherRecipient, setVoucherRecipient] = useState<string>('');

  // Sale Model & Variant Picker
  const [selectedModelCode, setSelectedModelCode] = useState<string>('');
  const [filterAudience, setFilterAudience] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [saleVariantQuantities, setSaleVariantQuantities] = useState<Record<number, number>>({});

  // Load Data
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [datesData, invData, calData] = await Promise.all([
        DatesService.getAll(),
        InventoryService.getAll(),
        CalendarService.getAll(),
      ]);

      const dates = datesData && datesData.length > 0 ? datesData : [todayStr];
      if (!dates.includes(todayStr)) dates.unshift(todayStr);
      setActiveDates(dates);

      setInventory(invData || []);
      setCalendarMap(calData || {});
    } catch (err) {
      console.error('Error cargando datos contables:', err);
    } finally {
      setIsLoading(false);
    }
  }, [todayStr]);

  const loadMovements = useCallback(async () => {
    try {
      const list = await MovementsService.getByDate(activeTab, searchQuery);
      setMovements(list || []);
    } catch (err) {
      console.error('Error cargando movimientos:', err);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  // Handle Tab Switch
  const handleSwitchTab = (tab: string) => {
    setActiveTab(tab);
    setNewDateInput(tab === 'TODOS' ? todayStr : tab);
  };

  // Add / Switch Date
  const handleAddDate = async () => {
    if (!newDateInput) {
      showToast('⚠️ Selecciona una fecha válida.', true);
      return;
    }
    try {
      await DatesService.add(newDateInput);
      if (!activeDates.includes(newDateInput)) {
        setActiveDates((prev) => [newDateInput, ...prev.filter((d) => d !== newDateInput)]);
      }
      setActiveTab(newDateInput);
      showToast(`📅 Fecha activa: ${newDateInput}`, false, 'info');
    } catch (err: any) {
      showToast(err.message || 'Error al agregar fecha.', true);
    }
  };

  // Delete Tab / Date
  const handleDeleteCurrentTab = async () => {
    if (activeTab === 'TODOS') return;
    if (!isOwner) {
      showToast('⚠️ Solo el Dueño puede eliminar fechas completas con sus registros.', true);
      return;
    }

    const ok = await confirm({
      title: 'Eliminar fecha activa',
      message: `¿Estás seguro de eliminar la fecha ${activeTab} y todos sus registros contables?\nEl inventario no se modificará.`,
      tone: 'danger',
      confirmText: 'Eliminar Fecha',
    });

    if (!ok) return;

    try {
      await DatesService.remove(activeTab);
      const remaining = activeDates.filter((d) => d !== activeTab);
      setActiveDates(remaining.length > 0 ? remaining : [todayStr]);
      setActiveTab(remaining.length > 0 ? remaining[0] : todayStr);
      showToast(`Fecha ${activeTab} eliminada con éxito.`);
      loadMovements();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar fecha.', true);
    }
  };

  // Selected Model Item
  const selectedModel = useMemo(() => {
    return inventory.find((i) => i.code === selectedModelCode) || null;
  }, [inventory, selectedModelCode]);

  // Calculate Sale Total
  const calculatedSaleTotal = useMemo(() => {
    if (opType !== 'venta' || !selectedModel) return 0;
    let totalCents = 0;
    selectedModel.variants.forEach((v, idx) => {
      const qty = saleVariantQuantities[idx] || 0;
      if (qty > 0) {
        totalCents += Math.round(v.price * 100) * qty;
      }
    });
    return totalCents / 100;
  }, [opType, selectedModel, saleVariantQuantities]);

  // Form Op Type Change Handler
  const handleOpChange = (type: MovementType) => {
    setOpType(type);
    setSelectedModelCode('');
    setSaleVariantQuantities({});
    setManualAmount('');

    if (type === 'cajachica') {
      setDocType('Sin Comprobante');
    } else {
      setDocType('Factura');
    }
  };

  // Filter Models for Sale Selector
  const filteredModels = useMemo(() => {
    return inventory.filter((item) => {
      const matchAud = !filterAudience || item.audience === filterAudience;
      const matchCat = !filterCategory || item.category === filterCategory;
      return matchAud && matchCat;
    });
  }, [inventory, filterAudience, filterCategory]);

  // Submit Record Form
  const handleSubmitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetDate = activeTab === 'TODOS' ? todayStr : activeTab;

    let finalAmount = 0;
    let itemsPayload: any[] | null = null;
    let descFinal = '';

    if (opType === 'venta') {
      if (!selectedModel) {
        showToast('⚠️ Selecciona un modelo de ropa.', true);
        return;
      }

      const pickedItems: any[] = [];
      let totalCents = 0;
      let hasOverStock = false;

      selectedModel.variants.forEach((v, idx) => {
        const qty = saleVariantQuantities[idx] || 0;
        if (qty > 0) {
          if (qty > v.stock) {
            hasOverStock = true;
          }
          pickedItems.push({
            code: selectedModel.code,
            size: v.size,
            color: v.color,
            qty,
            price: v.price,
          });
          totalCents += Math.round(v.price * 100) * qty;
        }
      });

      if (hasOverStock) {
        showToast('⚠️ Hay cantidades que superan el stock disponible.', true);
        return;
      }

      if (pickedItems.length === 0) {
        showToast('⚠️ Ingresa al menos 1 unidad para la venta.', true);
        return;
      }

      // Check Holiday / Asueto on calendar
      const dayInfo = calendarMap[targetDate];
      if (dayInfo && dayInfo.status === 'asueto') {
        const ok = await confirm({
          title: 'Venta en día de asueto',
          message: `El día ${targetDate} está marcado como Asueto / Feriado${dayInfo.note ? ` (${dayInfo.note})` : ''}.\nSi continúas, la jornada cambiará a "Laborado".\n¿Deseas registrar la venta?`,
          tone: 'warning',
          confirmText: 'Registrar Venta',
        });
        if (!ok) return;
      }

      finalAmount = totalCents / 100;
      itemsPayload = pickedItems;
      const soldDetails = pickedItems.map((p) => `${p.qty}x Talla ${p.size} ($${p.price.toFixed(2)})`).join(', ');
      descFinal = `[${selectedModel.code}] ${selectedModel.name} (${selectedModel.audience || 'Gral'}) -> ${soldDetails}`;
    } else if (opType === 'cajachica') {
      const amt = parseFloat(manualAmount);
      if (!(amt > 0)) {
        showToast('⚠️ Ingresa un monto mayor a $0.00.', true);
        return;
      }

      // Verify Petty Cash Balance
      try {
        const ccSummary = await CajaChicaService.getSummary();
        if (amt - ccSummary.balance > 0.005) {
          showToast(`⚠️ Fondos insuficientes en Caja Chica. Saldo disponible: $${ccSummary.balance.toFixed(2)}`, true);
          return;
        }
      } catch (err) {
        console.error('Error verificando saldo de caja chica:', err);
      }

      finalAmount = amt;
      descFinal = `[Caja Chica - ${ccCategory}] ${customDesc.trim() || 'Gasto menor'}`;
    } else {
      const amt = parseFloat(manualAmount);
      if (!(amt > 0)) {
        showToast('⚠️ Ingresa un monto válido mayor a 0.', true);
        return;
      }
      finalAmount = amt;

      const trimmedDesc = customDesc.trim();
      if (opType === 'luz') descFinal = `💡 [Pago de Luz] ${trimmedDesc || 'Servicio de Energía'}`;
      else if (opType === 'agua') descFinal = `🚰 [Pago de Agua] ${trimmedDesc || 'Servicio de Agua Potable'}`;
      else if (opType === 'internet') descFinal = `📶 [Pago de Internet/Tel] ${trimmedDesc || 'Servicio de Telecomunicaciones'}`;
      else if (opType === 'compra') descFinal = `🛍️ [Compra Mercadería] ${trimmedDesc || 'Adquisición de prendas'}`;
      else descFinal = trimmedDesc || 'Movimiento contable';
    }

    // Exact IVA (13% for El Salvador): tax = amount / 1.13 * 0.13
    const calculatedTax = Math.round((finalAmount / 1.13 * 0.13) * 100) / 100;

    try {
      const res = await MovementsService.create({
        date: targetDate,
        type: opType,
        desc: descFinal,
        amount: finalAmount,
        tax: calculatedTax,
        doc: docType,
        items: itemsPayload,
        isCajaChica: opType === 'cajachica',
        ccCategory: opType === 'cajachica' ? ccCategory : undefined,
        voucherRecipient: docType === 'Sin Comprobante' ? voucherRecipient : undefined,
      });

      showToast(
        res.voucherCode
          ? `✅ Operación guardada con Vale Interno #${res.voucherCode}`
          : '✅ Operación guardada con éxito.',
        false,
        'success'
      );

      // Auto update calendar to laborado if sale
      if (opType === 'venta') {
        const currentDay = calendarMap[targetDate];
        if (currentDay && (currentDay.status === 'asueto' || currentDay.status === 'sinventas')) {
          await CalendarService.updateDay(targetDate, 'laborado', currentDay.note);
          setCalendarMap((prev) => ({
            ...prev,
            [targetDate]: { status: 'laborado', note: currentDay.note },
          }));
        }
      }

      // Reset Form
      setSelectedModelCode('');
      setSaleVariantQuantities({});
      setCustomDesc('');
      setManualAmount('');
      setVoucherRecipient('');

      // Refresh inventory and movements
      loadMovements();
      const updatedInv = await InventoryService.getAll();
      setInventory(updatedInv || []);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar la operación.', true);
    }
  };

  // Delete Movement
  const handleDeleteMovement = async (mov: Movement) => {
    if (!isOwner) {
      showToast('⚠️ Solo el Dueño / Administrador puede eliminar movimientos registrados.', true);
      return;
    }

    let warningText = `¿Estás seguro de eliminar el registro #${mov.id} ($${mov.amount.toFixed(2)})?`;
    if (mov.type === 'venta' && mov.items && mov.items.length > 0) {
      warningText += '\nLas unidades vendidas regresarán al inventario de bodega.';
    }
    if (mov.type === 'cajachica' && mov.ccId) {
      warningText += '\nEl gasto también se eliminará de la Caja Chica para cuadrar el fondo.';
    }

    const ok = await confirm({
      title: 'Eliminar Movimiento Contable',
      message: warningText,
      tone: 'danger',
      confirmText: 'Eliminar y Restaurar',
    });

    if (!ok) return;

    try {
      await MovementsService.delete(mov.id);
      showToast('Registro eliminado y stock restaurado en bodega.', false, 'success');
      loadMovements();
      const updatedInv = await InventoryService.getAll();
      setInventory(updatedInv || []);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar movimiento.', true);
    }
  };

  // Filtered Movements for Table & Dynamic Metrics Recalculation
  const filteredMovements = useMemo(() => {
    if (!searchQuery.trim()) return movements;
    const q = searchQuery.toLowerCase().trim();
    return movements.filter(
      (m) =>
        m.desc.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q) ||
        m.doc.toLowerCase().includes(q) ||
        (m.voucherCode && m.voucherCode.toLowerCase().includes(q))
    );
  }, [movements, searchQuery]);

  // Recalculate Metrics based on Filtered Movements
  const metrics = useMemo(() => {
    let sales = 0;
    let expenses = 0;
    let salesTax = 0;
    let expensesTax = 0;

    filteredMovements.forEach((m) => {
      if (m.type === 'venta') {
        sales += m.amount;
        salesTax += m.tax || 0;
      } else {
        expenses += m.amount;
        expensesTax += m.tax || 0;
      }
    });

    const netTax = Math.round((salesTax - expensesTax) * 100) / 100;
    const profit = Math.round((sales - expenses) * 100) / 100;

    return {
      sales: Math.round(sales * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      netTax,
      profit,
    };
  }, [filteredMovements]);

  // Day Status Badge Info
  const currentDayInfo = activeTab !== 'TODOS' ? calendarMap[activeTab] : null;

  return (
    <div className="section-view active space-y-4">
      {/* Barra de Control de Fecha */}
      <div className="date-control-bar">
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs font-semibold text-[#2F4A38] flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Fecha Activa:
          </label>
          <input
            type="date"
            value={newDateInput}
            onChange={(e) => setNewDateInput(e.target.value)}
            className="text-xs p-1.5 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
          />
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            onClick={handleAddDate}
          >
            + Cambiar / Crear Fecha
          </button>
        </div>

        {/* Badge de Estado del Día en el Calendario */}
        {currentDayInfo && (
          <div
            className={`day-status-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold ${
              currentDayInfo.status === 'laborado'
                ? 'bg-[#E1EBDC] text-[#2F4A38] border border-[#B8CDB2]'
                : currentDayInfo.status === 'asueto'
                ? 'bg-[#F8EBE4] text-[#7E3F27] border border-[#EBCDBE]'
                : 'bg-[#F6E6C8] text-[#7A5A1F] border border-[#E8C58A]'
            }`}
          >
            <span>
              {currentDayInfo.status === 'laborado' && '🟢 Jornada Laborada'}
              {currentDayInfo.status === 'asueto' && '🔵 Asueto / Feriado'}
              {currentDayInfo.status === 'sinventas' && '🟡 Sin Ventas'}
            </span>
            {currentDayInfo.note && <span className="opacity-75">({currentDayInfo.note})</span>}
          </div>
        )}

        {/* Buscador Dinámico de Historial */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="🔍 Buscar en historial..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '220px' }}
            className="text-xs p-1.5 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
          />
        </div>
      </div>

      {/* Pestañas de Fecha */}
      <div className="tabs-container flex items-center justify-between">
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          <div
            className={`tab ${activeTab === 'TODOS' ? 'active' : ''}`}
            onClick={() => handleSwitchTab('TODOS')}
          >
            Todo Acumulado
          </div>
          {activeDates.map((dateKey) => (
            <div
              key={dateKey}
              className={`tab ${activeTab === dateKey ? 'active' : ''}`}
              onClick={() => handleSwitchTab(dateKey)}
            >
              {dateKey === todayStr ? `Hoy (${dateKey})` : dateKey}
            </div>
          ))}
        </div>

        {activeTab !== 'TODOS' && isOwner && (
          <button
            type="button"
            className="btn btn-danger text-xs whitespace-nowrap ml-2"
            onClick={handleDeleteCurrentTab}
            title="Eliminar toda la fecha y sus registros"
          >
            ✕ Eliminar Fecha
          </button>
        )}
      </div>

      {/* Tarjetas de Métricas Recalculadas */}
      <div className="metrics-grid">
        <MetricCard
          label="Ventas Totales"
          value={metrics.sales}
          tone="success"
          iconType="up"
          subtitle={searchQuery ? 'Filtradas por búsqueda' : 'Total acumulado'}
        />
        <MetricCard
          label="Gastos Totales"
          value={metrics.expenses}
          tone="danger"
          iconType="down"
          subtitle={searchQuery ? 'Filtrados por búsqueda' : 'Compras y servicios'}
        />
        <MetricCard
          label="IVA Neto (13%)"
          value={metrics.netTax}
          tone="warning"
          iconType="pct"
          subtitle="Débito menos crédito fiscal"
        />
        <MetricCard
          label="Ganancia Neta"
          value={isOwner || user?.role === 'dueno' ? metrics.profit : 'Protegido (Dueño)'}
          tone="primary"
          iconType="cash"
          isProfitCard={true}
          subtitle="Ventas menos gastos totales"
        />
      </div>

      {/* Área de Trabajo: Formulario a la Izquierda, Historial a la Derecha */}
      <div className="workspace">
        {/* Formulario de Registro */}
        <div className="card-box">
          <h3 id="formTitle" className="text-sm font-bold text-[#2F4A38] border-b border-[#CBDCC5] pb-2 mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              Nuevo Registro de Venta / Gasto ({activeTab === 'TODOS' ? todayStr : activeTab})
            </span>
          </h3>

          <form onSubmit={handleSubmitRecord} className="space-y-3">
            {/* Selector de Tipo de Operación con Iconos */}
            <div className="form-group">
              <label className="text-xs font-semibold text-[#46524A] block mb-1">
                Tipo de Operación
              </label>
              <div className="op-grid">
                <button
                  type="button"
                  className={`op-tile ${opType === 'venta' ? 'active' : ''}`}
                  onClick={() => handleOpChange('venta')}
                >
                  <span className="oi">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 7h12l1 13H5z" />
                      <path d="M9 7a3 3 0 0 1 6 0" />
                    </svg>
                  </span>
                  <span><b>Venta</b><small>Ficha de tallas</small></span>
                </button>

                <button
                  type="button"
                  className={`op-tile ${opType === 'compra' ? 'active' : ''}`}
                  onClick={() => handleOpChange('compra')}
                >
                  <span className="oi">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
                      <path d="M3 8l9 5 9-5M12 13v8" />
                    </svg>
                  </span>
                  <span><b>Compra</b><small>Mercadería</small></span>
                </button>

                <button
                  type="button"
                  className={`op-tile ${opType === 'cajachica' ? 'active' : ''}`}
                  onClick={() => handleOpChange('cajachica')}
                >
                  <span className="oi">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  </span>
                  <span><b>Caja chica</b><small>Gasto menor</small></span>
                </button>

                <button
                  type="button"
                  className={`op-tile ${opType === 'luz' ? 'active' : ''}`}
                  onClick={() => handleOpChange('luz')}
                >
                  <span className="oi">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
                    </svg>
                  </span>
                  <span><b>Energía</b><small>Pago de luz</small></span>
                </button>

                <button
                  type="button"
                  className={`op-tile ${opType === 'agua' ? 'active' : ''}`}
                  onClick={() => handleOpChange('agua')}
                >
                  <span className="oi">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
                    </svg>
                  </span>
                  <span><b>Agua</b><small>Serv. básicos</small></span>
                </button>

                <button
                  type="button"
                  className={`op-tile ${opType === 'internet' ? 'active' : ''}`}
                  onClick={() => handleOpChange('internet')}
                >
                  <span className="oi">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
                      <path d="M12 19.5h.01" />
                    </svg>
                  </span>
                  <span><b>Internet</b><small>Teléfono</small></span>
                </button>
              </div>
            </div>

            {/* SECCIÓN VENTA: Modelo y Variantes */}
            {opType === 'venta' && (
              <div className="space-y-3 bg-[#F2F6EE] p-3.5 rounded-lg border border-[#CBDCC5]">
                <div className="flex gap-2 flex-wrap text-xs">
                  <select
                    value={filterAudience}
                    onChange={(e) => setFilterAudience(e.target.value)}
                    className="p-1.5 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                  >
                    <option value="">-- Todos los públicos --</option>
                    <option value="Hombre">Hombre</option>
                    <option value="Mujer">Mujer</option>
                    <option value="Niño">Niño</option>
                    <option value="Niña">Niña</option>
                    <option value="Unisex">Unisex</option>
                  </select>

                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="p-1.5 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                  >
                    <option value="">-- Todas las categorías --</option>
                    <option value="Camisa">Camisa</option>
                    <option value="Pantalón">Pantalón</option>
                    <option value="Vestido">Vestido</option>
                    <option value="Falda">Falda</option>
                    <option value="Short">Short</option>
                    <option value="Calzado">Calzado</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#46524A] block mb-1">
                    Seleccionar Prenda de Inventario:
                  </label>
                  <select
                    value={selectedModelCode}
                    onChange={(e) => {
                      setSelectedModelCode(e.target.value);
                      setSaleVariantQuantities({});
                    }}
                    className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                    required
                  >
                    <option value="">-- Elige un modelo --</option>
                    {filteredModels.map((item) => (
                      <option key={item.code} value={item.code}>
                        [{item.code}] {item.name} ({item.audience || 'Gral'} {item.category || 'Ropa'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tarjetas de Variantes (Tallas / Colores / Stock) */}
                {selectedModel && (
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-semibold text-[#46524A] block">
                      Tallas y Cantidades Disponibles:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedModel.variants.map((v, idx) => {
                        const isOut = v.stock <= 0;
                        const isLow = v.stock > 0 && v.stock <= 3;
                        return (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-lg border shadow-xs transition-colors ${
                              isOut
                                ? 'border-[#EBCDBE] bg-[#F8EBE4] opacity-75'
                                : 'border-[#D7DDCF] bg-[#FFFFFF]'
                            }`}
                          >
                            <div className="text-xs">
                              <span className="font-bold text-[#2F3A33]">Talla {v.size}</span>{' '}
                              <span className="text-[#6F7B72]">({v.color})</span>
                              <div className="text-[11px] mt-0.5">
                                {isOut ? (
                                  <span className="text-[#B2603F] font-bold">🔴 Agotado</span>
                                ) : isLow ? (
                                  <span className="text-[#B58A3C] font-semibold">⚠️ ¡Poco stock ({v.stock})!</span>
                                ) : (
                                  <span className="text-[#4F6F52] font-medium">Stock: {v.stock} un.</span>
                                )}
                              </div>
                            </div>

                            <div className="text-xs font-bold text-[#2F4A38] mt-1">
                              ${v.price.toFixed(2)} c/u
                            </div>

                            <div className="mt-1">
                              <input
                                type="number"
                                min={0}
                                max={v.stock}
                                disabled={isOut}
                                value={saleVariantQuantities[idx] || 0}
                                onChange={(e) => {
                                  let val = parseInt(e.target.value) || 0;
                                  if (val < 0) val = 0;
                                  if (val > v.stock) {
                                    val = v.stock;
                                    showToast('Stock máximo alcanzado', true);
                                  }
                                  setSaleVariantQuantities((prev) => ({
                                    ...prev,
                                    [idx]: val,
                                  }));
                                }}
                                className="w-16 p-1 text-center font-bold text-xs bg-[#FFFFFF] border border-[#D7DDCF] rounded text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECCIÓN CAJA CHICA */}
            {opType === 'cajachica' && (
              <div className="form-group bg-[#F2F6EE] p-3 rounded-lg border border-[#CBDCC5]">
                <label className="text-xs font-semibold text-[#2F4A38] block mb-1">
                  Concepto Autorizado de Caja Chica:
                </label>
                <select
                  value={ccCategory}
                  onChange={(e) => setCcCategory(e.target.value)}
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

            {/* SECCIÓN DE ENTRADAS GENERALES (Compras, Servicios, Caja Chica) */}
            {opType !== 'venta' && (
              <div className="space-y-3">
                <div className="form-group">
                  <label className="text-xs font-semibold text-[#46524A] block mb-1">
                    Descripción / Concepto del Registro:
                  </label>
                  <input
                    type="text"
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                    placeholder="Ej. Pago mensual de energía eléctrica..."
                    required={opType !== 'cajachica'}
                    className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                  />
                </div>

                <div className="form-group">
                  <label className="text-xs font-semibold text-[#46524A] block mb-1">
                    Monto Total ($):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] font-bold focus:border-[#4F6F52] outline-none"
                  />
                </div>
              </div>
            )}

            {/* MONTO CALCULADO EN VENTAS */}
            {opType === 'venta' && (
              <div className="form-group">
                <label className="text-xs font-semibold text-[#46524A] block mb-1">
                  Total de Venta Calculado ($):
                </label>
                <input
                  type="text"
                  readOnly
                  value={`$${calculatedSaleTotal.toFixed(2)}`}
                  className="w-full text-sm font-bold text-[#2F4A38] p-2 rounded-md bg-[#E1EBDC] border border-[#B8CDB2]"
                />
              </div>
            )}

            {/* COMPROBANTE FISCAL / VALE INTERNO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div className="form-group">
                <label className="text-xs font-semibold text-[#46524A] block mb-1">
                  Tipo de Comprobante:
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DocType)}
                  className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                >
                  <option value="Factura">Factura Consumidor Final</option>
                  <option value="CCF">Comprobante de Crédito Fiscal (CCF)</option>
                  <option value="Sin Comprobante">Sin Comprobante (Vale de Caja Interno)</option>
                </select>
              </div>

              {docType === 'Sin Comprobante' && (
                <div className="form-group">
                  <label className="text-xs font-semibold text-[#46524A] block mb-1">
                    Receptor del Vale / Observación:
                  </label>
                  <input
                    type="text"
                    value={voucherRecipient}
                    onChange={(e) => setVoucherRecipient(e.target.value)}
                    placeholder="Nombre de quien recibe el dinero..."
                    className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                  />
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary w-full py-2 font-semibold text-sm">
              Guardar Operación
            </button>
          </form>
        </div>

        {/* Historial de Movimientos */}
        <div className="card-box space-y-3">
          <div className="flex justify-between items-center flex-wrap gap-2 border-b border-[#CBDCC5] pb-2">
            <h3 className="text-sm font-bold text-[#2F4A38] flex items-center gap-2 m-0 border-0 p-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Historial de Movimientos ({filteredMovements.length})
            </h3>
            <span className="text-xs text-[#6F7B72] font-medium">
              {activeTab === 'TODOS' ? 'Todo Acumulado' : `Fecha: ${activeTab}`}
            </span>
          </div>

          <div className="table-responsive-container">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#CBDCC5] bg-[#EDF3E8] text-[#2F4A38]">
                  <th className="p-2.5">Hora / Fecha</th>
                  <th className="p-2.5">Tipo</th>
                  <th className="p-2.5">Comprobante / Vale</th>
                  <th className="p-2.5">Descripción</th>
                  <th className="p-2.5 text-right">Monto ($)</th>
                  <th className="p-2.5 text-right">IVA 13%</th>
                  <th className="p-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-[#6F7B72]">
                      No se encontraron movimientos para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m) => {
                    const isVenta = m.type === 'venta';
                    return (
                      <tr key={m.id} className="border-b border-[#E6EBDF] hover:bg-[#E6EBDF]/60 transition-colors">
                        <td className="p-2.5 whitespace-nowrap text-[#6F7B72]">
                          {m.time || '--:--'}
                          {activeTab === 'TODOS' && m.date && (
                            <span className="block text-[10px] text-[#9AA59C]">{m.date}</span>
                          )}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span
                            className={`badge ${
                              isVenta ? 'badge-venta' : 'badge-egreso'
                            }`}
                          >
                            {m.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className="badge badge-cat">{m.doc}</span>
                          {m.voucherCode && (
                            <span className="badge badge-stock ml-1 bg-[#FBF3E1] text-[#7A5A1F] border border-[#EBD6A4]">
                              {m.voucherCode}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 max-w-xs break-words">
                          <span className="text-[#2F3A33] font-medium">{m.desc}</span>
                        </td>
                        <td
                          className={`p-2.5 text-right font-bold whitespace-nowrap ${
                            isVenta ? 'text-[#2F4A38]' : 'text-[#B2603F]'
                          }`}
                        >
                          {isVenta ? '+' : '-'}${m.amount.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right text-[#6F7B72] whitespace-nowrap">
                          ${(m.tax || 0).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          {isOwner ? (
                            <button
                              type="button"
                              className="btn btn-danger btn-table-action text-[11px] px-2 py-0.5"
                              onClick={() => handleDeleteMovement(m)}
                              title="Eliminar movimiento y devolver stock"
                            >
                              ✕ Eliminar
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#9AA59C] italic">Solo Dueño</span>
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
