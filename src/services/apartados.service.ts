// ============================================================
// apartados.service.ts — Servicio de Apartados
//
// Gestiona las reservas de prendas con abono parcial del cliente:
//   getAll()   — lista todos los apartados (activos y entregados).
//   create()   — registra un nuevo apartado con su abono inicial.
//   addAbono() — suma un abono adicional; opcionalmente marca entregado.
//   delete()   — elimina un apartado (solo Dueño).
//
// Estado del apartado:
//   'apartado'  → reserva activa (pendiente de pago completo)
//   'entregado' → prenda entregada al cliente (saldo liquidado)
// ============================================================
import { apiRequest } from './api';
import { Apartado } from '../types';

/** Payload para crear un nuevo apartado */
export interface CreateApartadoPayload {
  clientName: string;  // Nombre del cliente que aparta la prenda
  prendaDesc: string;  // Descripción de la prenda apartada
  total: number;       // Precio total acordado (USD)
  abono: number;       // Abono inicial entregado (USD); debe ser ≤ total
  date?: string;       // Fecha ISO; si se omite usa la fecha actual del servidor
  time?: string;       // Hora (HH:MM AM/PM)
}

export const ApartadosService = {
  /**
   * Obtiene todos los apartados registrados.
   * Devuelve array vacío en caso de error (tolerancia a fallos en la UI).
   */
  async getAll(): Promise<Apartado[]> {
    try {
      return await apiRequest<Apartado[]>('/apartados');
    } catch (error) {
      console.error('Error al obtener lista de apartados:', error);
      return [];
    }
  },

  /**
   * Registra un nuevo apartado con su abono inicial.
   * @returns id del apartado creado.
   */
  async create(payload: CreateApartadoPayload): Promise<{ success: boolean; id: number }> {
    try {
      return await apiRequest<{ success: boolean; id: number }>('/apartados', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Error al registrar apartado:', error);
      throw error;
    }
  },

  /**
   * Suma un abono adicional a un apartado existente.
   * Si markDelivered = true, cambia el estado a 'entregado'.
   * @returns abono acumulado actualizado y nuevo estado.
   */
  async addAbono(
    id: number,
    extraAbono: number,
    markDelivered = false
  ): Promise<{ success: boolean; abono: number; status: string }> {
    try {
      return await apiRequest<{ success: boolean; abono: number; status: string }>(
        `/apartados/${id}/abono`,
        { method: 'PUT', body: JSON.stringify({ extraAbono, markDelivered }) }
      );
    } catch (error) {
      console.error(`Error al abonar al apartado #${id}:`, error);
      throw error;
    }
  },

  /**
   * Elimina permanentemente un apartado (solo rol 'dueno').
   */
  async delete(id: number): Promise<{ success: boolean; message: string }> {
    try {
      return await apiRequest<{ success: boolean; message: string }>(`/apartados/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Error al eliminar apartado #${id}:`, error);
      throw error;
    }
  },
};
