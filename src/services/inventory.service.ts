// ============================================================
// inventory.service.ts — Servicio de Inventario
//
// CRUD completo para prendas y sus variantes (talla/color/stock):
//   getAll()  — obtiene todas las prendas con sus variantes.
//   create()  — crea una nueva prenda con sus variantes iniciales.
//   update()  — actualiza nombre, categoría o variantes de una prenda.
//   delete()  — elimina una prenda y todas sus variantes (solo Dueño).
//
// Reglas de negocio:
//   RN-04: Las ventas descuentan stock vía MovementsService.create().
//   RN-05: Las variantes conservan su costo y vínculo con el código del modelo.
// ============================================================
import { apiRequest } from './api';
import { InventoryItem } from '../types';

export const InventoryService = {
  /**
   * Obtiene todas las prendas del catálogo con sus variantes completas.
   * Devuelve array vacío en caso de error (tolerancia a fallos en la UI).
   */
  async getAll(): Promise<InventoryItem[]> {
    try {
      return await apiRequest<InventoryItem[]>('/inventory');
    } catch (error) {
      console.error('Error al obtener inventario:', error);
      return [];
    }
  },

  /**
   * Registra una nueva prenda con sus variantes en el catálogo.
   * @returns código de la prenda creada.
   * @throws ApiError si el código ya existe o hay error de validación.
   */
  async create(item: InventoryItem): Promise<{ success: boolean; code: string }> {
    try {
      return await apiRequest<{ success: boolean; code: string }>('/inventory', {
        method: 'POST',
        body: JSON.stringify(item),
      });
    } catch (error) {
      console.error('Error al registrar prenda en inventario:', error);
      throw error;
    }
  },

  /**
   * Actualiza los datos de una prenda existente (nombre, categoría, variantes).
   * No elimina variantes que ya tienen movimientos asociados (RN-05).
   */
  async update(code: string, item: Partial<InventoryItem>): Promise<{ success: boolean; message: string }> {
    try {
      return await apiRequest<{ success: boolean; message: string }>(
        `/inventory/${encodeURIComponent(code)}`,
        { method: 'PUT', body: JSON.stringify(item) }
      );
    } catch (error) {
      console.error(`Error al actualizar prenda ${code}:`, error);
      throw error;
    }
  },

  /**
   * Elimina permanentemente una prenda y todas sus variantes.
   * Solo disponible para el rol 'dueno' (controlado en el backend).
   */
  async delete(code: string): Promise<{ success: boolean; message: string }> {
    try {
      return await apiRequest<{ success: boolean; message: string }>(
        `/inventory/${encodeURIComponent(code)}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      console.error(`Error al eliminar prenda ${code}:`, error);
      throw error;
    }
  },
};
