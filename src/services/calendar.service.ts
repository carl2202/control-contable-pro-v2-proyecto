// ============================================================
// calendar.service.ts — Servicio de Calendario de Jornadas
//
// Gestiona el estado de cada día laborable (módulo F7):
//   getAll()     — obtiene el mapa completo de días con su estado.
//   updateDay()  — asigna o actualiza el estado de un día específico.
//
// Estados posibles por día (CalendarStatus):
//   'laborado'  → día trabajado con ventas normales.
//   'sinventas' → día trabajado pero sin ventas registradas.
//   'asueto'    → feriado o día no laborado.
//
// El CalendarMap es un Record<string, CalendarDayInfo> donde la
// clave es la fecha ISO 'YYYY-MM-DD'.
// ============================================================
import { apiRequest } from './api';
import { CalendarMap, CalendarStatus } from '../types';

export const CalendarService = {
  /**
   * Obtiene el mapa completo de jornadas comerciales.
   * Devuelve objeto vacío si no hay registros o hay error de red.
   */
  async getAll(): Promise<CalendarMap> {
    try {
      return await apiRequest<CalendarMap>('/calendar');
    } catch (error) {
      console.error('Error al obtener datos de calendario:', error);
      return {};
    }
  },

  /**
   * Actualiza o crea el estado de un día en el calendario.
   * @param date    Fecha ISO 'YYYY-MM-DD'.
   * @param status  Estado del día: 'laborado' | 'sinventas' | 'asueto'.
   * @param note    Nota opcional descriptiva de la jornada.
   */
  async updateDay(
    date: string,
    status: CalendarStatus,
    note = ''
  ): Promise<{ success: boolean; date: string; status: CalendarStatus; note: string }> {
    try {
      return await apiRequest<{ success: boolean; date: string; status: CalendarStatus; note: string }>(
        `/calendar/${encodeURIComponent(date)}`,
        { method: 'PUT', body: JSON.stringify({ status, note }) }
      );
    } catch (error) {
      console.error(`Error al actualizar jornada del día ${date}:`, error);
      throw error;
    }
  },
};
