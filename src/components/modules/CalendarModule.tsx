import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CalendarMap, CalendarStatus } from '../../types';
import { CalendarService } from '../../services/calendar.service';
import { useFeedback } from '../../context/FeedbackContext';
import { MetricCard } from '../MetricCard';

interface CalendarModuleProps {
  onRefreshData?: () => void;
}

export function CalendarModule({ onRefreshData }: CalendarModuleProps) {
  const { showToast } = useFeedback();

  const [calendarMap, setCalendarMap] = useState<CalendarMap>({});
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Day editor modal state
  const [editorState, setEditorState] = useState<{
    isOpen: boolean;
    date: string;
    status: CalendarStatus;
    note: string;
  }>({
    isOpen: false,
    date: '',
    status: 'laborado',
    note: '',
  });

  const loadCalendar = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await CalendarService.getAll();
      setCalendarMap(data || {});
    } catch (err) {
      console.error('Error cargando calendario:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  // Month navigation
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleTodayMonth = () => {
    setCurrentDate(new Date());
  };

  // Days matrix in month
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    // Adjust so 0 is Monday: 0..6 (Mon..Sun)
    const startingDay = (firstDayIndex + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{ dayNumber: number | null; dateStr: string }> = [];

    for (let i = 0; i < startingDay; i++) {
      days.push({ dayNumber: null, dateStr: '' });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      days.push({ dayNumber: d, dateStr });
    }

    return days;
  }, [year, month]);

  // Open day editor
  const handleOpenDay = (dateStr: string) => {
    if (!dateStr) return;
    const info = calendarMap[dateStr] || { status: 'laborado', note: '' };
    setEditorState({
      isOpen: true,
      date: dateStr,
      status: info.status,
      note: info.note || '',
    });
  };

  // Save day status
  const handleSaveDay = async (e: React.FormEvent) => {
    e.preventDefault();
    const { date, status, note } = editorState;
    if (!date) return;

    try {
      await CalendarService.updateDay(date, status, note);
      setCalendarMap((prev) => ({
        ...prev,
        [date]: { status, note },
      }));
      showToast(`Jornada del ${date} actualizada a "${status}".`);
      setEditorState({ isOpen: false, date: '', status: 'laborado', note: '' });
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar jornada.', true);
    }
  };

  // Month statistics
  const monthStats = useMemo(() => {
    let laborados = 0;
    let sinventas = 0;
    let asuetos = 0;

    calendarDays.forEach((d) => {
      if (!d.dateStr) return;
      const info = calendarMap[d.dateStr];
      if (info) {
        if (info.status === 'laborado') laborados++;
        else if (info.status === 'sinventas') sinventas++;
        else if (info.status === 'asueto') asuetos++;
      }
    });

    return {
      laborados,
      sinventas,
      asuetos,
      totalDays: new Date(year, month + 1, 0).getDate(),
    };
  }, [calendarDays, calendarMap, year, month]);

  return (
    <div className="section-view active space-y-4">
      {/* Tarjetas de Métricas de Calendario */}
      <div className="metrics-grid">
        <MetricCard
          label="Días Laborados"
          value={`${monthStats.laborados} días`}
          tone="success"
          iconType="check"
          subtitle={`Jornadas con actividad en ${monthNames[month]}`}
        />
        <MetricCard
          label="Días Sin Ventas"
          value={`${monthStats.sinventas} días`}
          tone="warning"
          iconType="pause"
          subtitle="Jornada abierta sin facturación"
        />
        <MetricCard
          label="Asuetos y Feriados"
          value={`${monthStats.asuetos} días`}
          tone="primary"
          iconType="cash"
          subtitle="Días no laborables o festivos"
        />
        <MetricCard
          label="Total Días del Mes"
          value={`${monthStats.totalDays} días`}
          tone="primary"
          iconType="box"
          subtitle={`${monthNames[month]} ${year}`}
        />
      </div>

      <div className="card-box space-y-4">
        {/* Cabecera y Navegación de Mes */}
        <div className="flex justify-between items-center flex-wrap gap-2 pb-2 border-b border-[#CBDCC5]">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#2F4A38] flex items-center gap-2 m-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {monthNames[month]} {year}
            </h2>
            <button
              type="button"
              onClick={handleTodayMonth}
              className="text-xs px-2.5 py-1 rounded-md bg-[#E1EBDC] text-[#2F4A38] border border-[#B8CDB2] hover:bg-[#D7DDCF] font-semibold"
            >
              Mes Actual
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="btn btn-light text-xs px-3 py-1"
            >
              ◀ Mes Anterior
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="btn btn-light text-xs px-3 py-1"
            >
              Mes Siguiente ▶
            </button>
          </div>
        </div>

        {/* Rejilla de Días de la Semana */}
        <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-[#2F4A38] mb-1">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((w) => (
            <div key={w} className="p-1 bg-[#EDF3E8] rounded text-[#2F4A38]">
              {w}
            </div>
          ))}
        </div>

        {/* Rejilla del Calendario */}
        <div className="grid grid-cols-7 gap-1.5">
          {calendarDays.map((d, idx) => {
            if (!d.dayNumber) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="p-2 min-h-[75px] rounded-lg bg-[#EEF1E8]/40 border border-transparent"
                ></div>
              );
            }

            const info = calendarMap[d.dateStr];
            const isToday = d.dateStr === new Date().toISOString().slice(0, 10);

            let bgClass = 'bg-[#F7F8F3] border-[#D7DDCF] hover:bg-[#F2F5EC] hover:border-[#4F6F52]';
            let badgeClass = 'badge badge-sindefinir';
            let label = 'Sin definir';

            if (info) {
              if (info.status === 'laborado') {
                bgClass = 'bg-[#E1EBDC]/60 border-[#B8CDB2] hover:border-[#4F6F52] hover:bg-[#E1EBDC]';
                badgeClass = 'badge badge-laborado';
                label = 'Laborado';
              } else if (info.status === 'asueto') {
                bgClass = 'bg-[#F8EBE4] border-[#EBCDBE] hover:border-[#B2603F]';
                badgeClass = 'badge badge-asueto';
                label = 'Asueto / Feriado';
              } else if (info.status === 'sinventas') {
                bgClass = 'bg-[#F6E6C8]/80 border-[#E8C58A] hover:border-[#B58A3C]';
                badgeClass = 'badge badge-sinventas';
                label = 'Sin Ventas';
              }
            }

            return (
              <div
                key={d.dateStr}
                onClick={() => handleOpenDay(d.dateStr)}
                className={`p-2 min-h-[75px] rounded-lg border transition-all cursor-pointer flex flex-col justify-between hover:shadow-sm ${bgClass} ${
                  isToday ? 'ring-2 ring-[#4F6F52]' : ''
                }`}
                title={`Click para editar jornada del ${d.dateStr}`}
              >
                <div className="flex justify-between items-start">
                  <span
                    className={`text-xs font-bold ${
                      isToday ? 'text-[#2F4A38] underline' : 'text-[#2F3A33]'
                    }`}
                  >
                    {d.dayNumber}
                  </span>
                  {isToday && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#4F6F52] text-white font-bold">
                      HOY
                    </span>
                  )}
                </div>

                <div className="mt-1">
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${badgeClass}`}>
                    {label}
                  </span>
                  {info?.note && (
                    <span className="block text-[10px] text-[#6F7B72] truncate mt-0.5" title={info.note}>
                      {info.note}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal para Editar Jornada del Día */}
      {editorState.isOpen && (
        <div className="feedback-modal-overlay active" role="dialog" aria-modal="true">
          <div className="feedback-modal-box tone-primary max-w-sm w-full mx-4">
            <div className="modal-header flex justify-between items-center pb-2 border-b border-[#D7DDCF]">
              <h3 className="modal-title text-sm font-bold text-[#2F4A38] flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Editar Jornada: {editorState.date}
              </h3>
              <button
                type="button"
                onClick={() =>
                  setEditorState({ isOpen: false, date: '', status: 'laborado', note: '' })
                }
                className="text-[#6F7B72] hover:text-[#2F3A33]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDay} className="modal-body py-3 space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#46524A] block mb-1">
                  Estado de la Jornada:
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { key: 'laborado', label: '🟢 Laborado (Día Comercial Activo)', desc: 'Tienda abierta y atendiendo clientes' },
                    { key: 'sinventas', label: '🟡 Sin Ventas (Abierto pero sin facturar)', desc: 'Jornada transcurrida sin movimiento' },
                    { key: 'asueto', label: '🔵 Asueto / Feriado / Descanso', desc: 'Día no laboral o festividad nacional' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() =>
                        setEditorState((prev) => ({
                          ...prev,
                          status: opt.key as CalendarStatus,
                        }))
                      }
                      className={`p-2.5 rounded-lg text-left text-xs border transition-all ${
                        editorState.status === opt.key
                          ? 'border-[#4F6F52] bg-[#E1EBDC] text-[#2F4A38] font-bold shadow-xs'
                          : 'border-[#D7DDCF] bg-[#F7F8F3] text-[#46524A] hover:bg-[#EEF1E8]'
                      }`}
                    >
                      <div>{opt.label}</div>
                      <div className="text-[10px] text-[#6F7B72] mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#46524A] block mb-1">
                  Nota u Observación (Opcional):
                </label>
                <input
                  type="text"
                  value={editorState.note}
                  onChange={(e) =>
                    setEditorState((prev) => ({ ...prev, note: e.target.value }))
                  }
                  placeholder="Ej. Feriado del 15 de Septiembre..."
                  className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                />
              </div>

              <div className="modal-footer pt-3 flex gap-2 justify-end border-t border-[#D7DDCF]">
                <button
                  type="button"
                  className="btn btn-light text-xs"
                  onClick={() =>
                    setEditorState({ isOpen: false, date: '', status: 'laborado', note: '' })
                  }
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary text-xs">
                  Guardar Jornada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
