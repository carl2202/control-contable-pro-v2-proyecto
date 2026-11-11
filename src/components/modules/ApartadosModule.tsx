import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Apartado, InventoryItem } from '../../types';
import { ApartadosService } from '../../services/apartados.service';
import { InventoryService } from '../../services/inventory.service';
import { useAuth } from '../../context/AuthContext';
import { useFeedback } from '../../context/FeedbackContext';
import { MetricCard } from '../MetricCard';

interface ApartadosModuleProps {
  onRefreshData?: () => void;
}

export function ApartadosModule({ onRefreshData }: ApartadosModuleProps) {
  const { isOwner } = useAuth();
  const { showToast, confirm } = useFeedback();

  const [apartados, setApartados] = useState<Apartado[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [clientName, setClientName] = useState<string>('');
  const [prendaDesc, setPrendaDesc] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [initialAbono, setInitialAbono] = useState<string>('');
  const [selectedInvCode, setSelectedInvCode] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Abono Modal State
  const [abonoModalState, setAbonoModalState] = useState<{
    isOpen: boolean;
    apartado: Apartado | null;
    extraAbono: string;
    markDelivered: boolean;
  }>({
    isOpen: false,
    apartado: null,
    extraAbono: '',
    markDelivered: false,
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [apData, invData] = await Promise.all([
        ApartadosService.getAll(),
        InventoryService.getAll(),
      ]);
      setApartados(apData || []);
      setInventory(invData || []);
    } catch (err) {
      console.error('Error cargando apartados:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When selecting an inventory item for apartado
  const handleSelectInventoryItem = (code: string) => {
    setSelectedInvCode(code);
    if (!code) return;
    const item = inventory.find((i) => i.code === code);
    if (item) {
      setPrendaDesc(`[${item.code}] ${item.name} (${item.audience || 'Gral'})`);
      if (item.variants && item.variants.length > 0) {
        setTotalAmount(item.variants[0].price.toString());
      }
    }
  };

  // Submit New Apartado
  const handleSubmitNewApartado = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanClient = clientName.trim();
    const cleanDesc = prendaDesc.trim();
    const tot = parseFloat(totalAmount);
    const ab = parseFloat(initialAbono);

    if (!cleanClient || !cleanDesc) {
      showToast('⚠️ Ingresa el nombre del cliente y la prenda.', true);
      return;
    }

    if (isNaN(tot) || tot <= 0) {
      showToast('⚠️ El monto total debe ser mayor a 0.', true);
      return;
    }

    if (isNaN(ab) || ab < 0) {
      showToast('⚠️ El abono inicial no puede ser negativo.', true);
      return;
    }

    try {
      await ApartadosService.create({
        clientName: cleanClient,
        prendaDesc: cleanDesc,
        total: tot,
        abono: ab,
      });

      showToast(`✅ Apartado de ${cleanClient} registrado con éxito.`);
      setClientName('');
      setPrendaDesc('');
      setTotalAmount('');
      setInitialAbono('');
      setSelectedInvCode('');
      loadData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar apartado.', true);
    }
  };

  // Open Abono Modal
  const handleOpenAbono = (ap: Apartado) => {
    setAbonoModalState({
      isOpen: true,
      apartado: ap,
      extraAbono: '',
      markDelivered: ap.status === 'entregado',
    });
  };

  // Submit Extra Abono
  const handleSubmitAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    const { apartado, extraAbono, markDelivered } = abonoModalState;
    if (!apartado) return;

    const extra = parseFloat(extraAbono) || 0;
    if (extra <= 0 && !markDelivered) {
      showToast('⚠️ Ingrese un monto de abono mayor a 0 o marque como entregado.', true);
      return;
    }

    try {
      await ApartadosService.addAbono(apartado.id, extra, markDelivered);
      showToast(`✅ Abono registrado para ${apartado.clientName}.`);
      setAbonoModalState({ isOpen: false, apartado: null, extraAbono: '', markDelivered: false });
      loadData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al procesar el abono.', true);
    }
  };

  // Delete Apartado
  const handleDeleteApartado = async (ap: Apartado) => {
    if (!isOwner) {
      showToast('⚠️ Solo el Dueño / Administrador puede eliminar apartados.', true);
      return;
    }

    const ok = await confirm({
      title: 'Eliminar apartado',
      message: `¿Estás seguro de eliminar el apartado de ${ap.clientName} (${ap.prendaDesc})?`,
      tone: 'danger',
      confirmText: 'Eliminar Apartado',
    });

    if (!ok) return;

    try {
      await ApartadosService.delete(ap.id);
      showToast('Apartado eliminado con éxito.', false, 'info');
      loadData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar apartado.', true);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    let totalValor = 0;
    let totalAbonado = 0;
    let activosCount = 0;

    apartados.forEach((ap) => {
      totalValor += ap.total;
      totalAbonado += ap.abono;
      if (ap.status === 'apartado') {
        activosCount++;
      }
    });

    const saldoPendiente = Math.max(0, totalValor - totalAbonado);

    return {
      totalValor: Math.round(totalValor * 100) / 100,
      totalAbonado: Math.round(totalAbonado * 100) / 100,
      saldoPendiente: Math.round(saldoPendiente * 100) / 100,
      activosCount,
    };
  }, [apartados]);

  // Filtered apartados by search
  const filteredApartados = useMemo(() => {
    if (!searchQuery.trim()) return apartados;
    const q = searchQuery.toLowerCase().trim();
    return apartados.filter(
      (ap) =>
        ap.clientName.toLowerCase().includes(q) ||
        ap.prendaDesc.toLowerCase().includes(q) ||
        ap.status.toLowerCase().includes(q)
    );
  }, [apartados, searchQuery]);

  return (
    <div className="section-view active space-y-4">
      {/* Tarjetas de Métricas de Apartados */}
      <div className="metrics-grid">
        <MetricCard
          label="Total Apartados"
          value={metrics.totalValor}
          tone="primary"
          iconType="box"
          subtitle={`${apartados.length} reservas registradas`}
        />
        <MetricCard
          label="Total Cobrado / Abonos"
          value={metrics.totalAbonado}
          tone="success"
          iconType="up"
          subtitle="Dinero ingresado a caja"
        />
        <MetricCard
          label="Saldo por Cobrar"
          value={metrics.saldoPendiente}
          tone="warning"
          iconType="pct"
          subtitle="Pendiente de liquidación"
        />
        <MetricCard
          label="Prendas Activas"
          value={`${metrics.activosCount} en espera`}
          tone="danger"
          iconType="pause"
          subtitle="Apartados no entregados"
        />
      </div>

      <div className="workspace">
        {/* Formulario de Nuevo Apartado */}
        <div className="card-box">
          <h3 className="text-sm font-bold text-[#2F4A38] border-b border-[#CBDCC5] pb-2 mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                <circle cx="12" cy="12" r="9"/>
                <path d="M10 9v6M14 9v6"/>
              </svg>
              Registrar Nuevo Apartado de Prenda
            </span>
          </h3>

          <form onSubmit={handleSubmitNewApartado} className="space-y-3">
            <div className="form-group">
              <label className="text-xs font-semibold text-[#46524A] block mb-1">
                Nombre del Cliente:
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej. Carmen Mendoza"
                required
                className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
              />
            </div>

            <div className="form-group">
              <label className="text-xs font-semibold text-[#46524A] block mb-1">
                Elegir Prenda de Inventario (Opcional):
              </label>
              <select
                value={selectedInvCode}
                onChange={(e) => handleSelectInventoryItem(e.target.value)}
                className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
              >
                <option value="">-- Seleccionar prenda o escribir manual --</option>
                {inventory.map((i) => (
                  <option key={i.code} value={i.code}>
                    [{i.code}] {i.name} ({i.audience || 'Gral'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="text-xs font-semibold text-[#46524A] block mb-1">
                Descripción de la Prenda y Talla:
              </label>
              <input
                type="text"
                value={prendaDesc}
                onChange={(e) => setPrendaDesc(e.target.value)}
                placeholder="Ej. Vestido Floral Rosa Talla M"
                required
                className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="form-group">
                <label className="text-xs font-semibold text-[#46524A] block mb-1">
                  Precio Total ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] font-bold focus:border-[#4F6F52] outline-none"
                />
              </div>

              <div className="form-group">
                <label className="text-xs font-semibold text-[#46524A] block mb-1">
                  Abono Inicial ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={initialAbono}
                  onChange={(e) => setInitialAbono(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full text-xs p-2 rounded-md bg-[#E1EBDC] border border-[#B8CDB2] text-[#2F4A38] font-bold focus:border-[#4F6F52] outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full py-2 font-semibold text-xs"
            >
              Guardar Apartado
            </button>
          </form>
        </div>

        {/* Tabla de Apartados */}
        <div className="card-box space-y-3">
          <div className="flex justify-between items-center flex-wrap gap-2 border-b border-[#CBDCC5] pb-2">
            <h3 className="text-sm font-bold text-[#2F4A38] flex items-center gap-2 m-0 border-0 p-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="9" x2="15" y2="9"/>
                <line x1="9" y1="13" x2="15" y2="13"/>
                <line x1="9" y1="17" x2="11" y2="17"/>
              </svg>
              Lista de Apartados ({filteredApartados.length})
            </h3>
            <input
              type="text"
              placeholder="🔍 Buscar cliente / prenda..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs p-1.5 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none w-48"
            />
          </div>

          <div className="table-responsive-container">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#CBDCC5] bg-[#EDF3E8] text-[#2F4A38]">
                  <th className="p-2.5">Fecha</th>
                  <th className="p-2.5">Cliente</th>
                  <th className="p-2.5">Prenda</th>
                  <th className="p-2.5 text-right">Total ($)</th>
                  <th className="p-2.5 text-right">Abonado ($)</th>
                  <th className="p-2.5 text-right">Saldo ($)</th>
                  <th className="p-2.5 text-center">Estado</th>
                  <th className="p-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredApartados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-[#6F7B72]">
                      No hay apartados registrados con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredApartados.map((ap) => {
                    const saldo = Math.max(0, ap.total - ap.abono);
                    const isDelivered = ap.status === 'entregado';
                    return (
                      <tr key={ap.id} className="border-b border-[#E6EBDF] hover:bg-[#E6EBDF]/60 transition-colors">
                        <td className="p-2.5 whitespace-nowrap text-[#6F7B72]">
                          {ap.date}
                          <span className="block text-[10px] text-[#9AA59C]">{ap.time}</span>
                        </td>
                        <td className="p-2.5 font-semibold text-[#2F3A33]">{ap.clientName}</td>
                        <td className="p-2.5 text-[#46524A]">{ap.prendaDesc}</td>
                        <td className="p-2.5 text-right font-bold text-[#2F3A33]">
                          ${ap.total.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-bold text-[#2F4A38]">
                          ${ap.abono.toFixed(2)}
                        </td>
                        <td
                          className={`p-2.5 text-right font-bold ${
                            saldo > 0 ? 'text-[#B58A3C]' : 'text-[#6F7B72]'
                          }`}
                        >
                          ${saldo.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <span
                            className={`badge ${
                              isDelivered ? 'badge-pagado' : 'badge-cajachica'
                            }`}
                          >
                            {isDelivered ? 'ENTREGADO' : 'APARTADO'}
                          </span>
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {!isDelivered && (
                              <button
                                type="button"
                                className="btn btn-light btn-table-action text-[11px] px-2 py-0.5"
                                onClick={() => handleOpenAbono(ap)}
                                title="Registrar nuevo abono"
                              >
                                + Abonar
                              </button>
                            )}
                            {isOwner && (
                              <button
                                type="button"
                                className="btn btn-danger btn-table-action text-[11px] px-2 py-0.5"
                                onClick={() => handleDeleteApartado(ap)}
                                title="Eliminar apartado"
                              >
                                ✕
                              </button>
                            )}
                          </div>
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

      {/* Modal para Abonar o Entregar */}
      {abonoModalState.isOpen && abonoModalState.apartado && (
        <div className="feedback-modal-overlay active" role="dialog" aria-modal="true">
          <div className="feedback-modal-box tone-primary max-w-sm w-full mx-4">
            <div className="modal-header flex justify-between items-center pb-2 border-b border-[#D7DDCF]">
              <h3 className="modal-title text-sm font-bold text-[#2F4A38] flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M7 15h0M2 9.5h20" />
                </svg>
                Abonar al Apartado #{abonoModalState.apartado.id}
              </h3>
              <button
                type="button"
                onClick={() =>
                  setAbonoModalState({
                    isOpen: false,
                    apartado: null,
                    extraAbono: '',
                    markDelivered: false,
                  })
                }
                className="text-[#6F7B72] hover:text-[#2F3A33]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitAbono} className="modal-body py-3 space-y-3">
              <div className="text-xs text-[#46524A] bg-[#F2F6EE] p-3 rounded-lg border border-[#CBDCC5]">
                <p>
                  <b className="text-[#2F3A33]">Cliente:</b> {abonoModalState.apartado.clientName}
                </p>
                <p>
                  <b className="text-[#2F3A33]">Prenda:</b> {abonoModalState.apartado.prendaDesc}
                </p>
                <p>
                  <b className="text-[#2F3A33]">Total:</b> ${abonoModalState.apartado.total.toFixed(2)} |{' '}
                  <b className="text-[#2F3A33]">Abonado:</b> ${abonoModalState.apartado.abono.toFixed(2)}
                </p>
                <p className="text-[#B58A3C] font-bold mt-1">
                  Saldo Restante: $
                  {Math.max(
                    0,
                    abonoModalState.apartado.total - abonoModalState.apartado.abono
                  ).toFixed(2)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#46524A] mb-1">
                  Monto a Abonar ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={abonoModalState.extraAbono}
                  onChange={(e) =>
                    setAbonoModalState((prev) => ({ ...prev, extraAbono: e.target.value }))
                  }
                  placeholder="0.00"
                  className="w-full text-xs p-2 rounded-md bg-[#E1EBDC] border border-[#B8CDB2] text-[#2F4A38] font-bold focus:border-[#4F6F52] outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkDelivered"
                  checked={abonoModalState.markDelivered}
                  onChange={(e) =>
                    setAbonoModalState((prev) => ({
                      ...prev,
                      markDelivered: e.target.checked,
                    }))
                  }
                  className="rounded text-[#4F6F52] focus:ring-[#4F6F52] border-[#D7DDCF]"
                />
                <label htmlFor="chkDelivered" className="text-xs text-[#46524A] cursor-pointer">
                  Marcar prenda como entregada al cliente
                </label>
              </div>

              <div className="modal-footer pt-3 flex gap-2 justify-end border-t border-[#D7DDCF]">
                <button
                  type="button"
                  className="btn btn-light text-xs"
                  onClick={() =>
                    setAbonoModalState({
                      isOpen: false,
                      apartado: null,
                      extraAbono: '',
                      markDelivered: false,
                    })
                  }
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary text-xs">
                  Guardar Abono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
