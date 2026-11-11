import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { InventoryItem, InventoryVariant } from '../../types';
import { InventoryService } from '../../services/inventory.service';
import { useAuth } from '../../context/AuthContext';
import { useFeedback } from '../../context/FeedbackContext';

interface InventoryModuleProps {
  onRefreshData?: () => void;
}

export function InventoryModule({ onRefreshData }: InventoryModuleProps) {
  const { isOwner } = useAuth();
  const { showToast, confirm } = useFeedback();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeAudienceFilter, setActiveAudienceFilter] = useState<string>('ALL');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [audience, setAudience] = useState<string>('Hombre');
  const [category, setCategory] = useState<string>('Camisa');
  const [variants, setVariants] = useState<InventoryVariant[]>([
    { size: 'M', color: 'Azul', cost: 10.0, price: 20.0, stock: 5 },
  ]);

  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await InventoryService.getAll();
      setItems(data || []);
    } catch (err) {
      console.error('Error al cargar inventario:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Variant row helpers
  const handleAddVariantRow = () => {
    setVariants((prev) => [
      ...prev,
      { size: '', color: '', cost: 10.0, price: 20.0, stock: 5 },
    ]);
  };

  const handleRemoveVariantRow = (index: number) => {
    if (variants.length <= 1) {
      showToast('⚠️ El modelo debe tener al menos una talla registrada.', true);
      return;
    }
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVariantChange = (
    index: number,
    field: keyof InventoryVariant,
    value: string | number
  ) => {
    setVariants((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: value,
      };
      return copy;
    });
  };

  // Start editing a model
  const handleEditItem = (item: InventoryItem) => {
    setIsEditing(true);
    setCode(item.code);
    setName(item.name);
    setAudience(item.audience || 'Hombre');
    setCategory(item.category || 'Camisa');
    setVariants(
      item.variants && item.variants.length > 0
        ? item.variants.map((v) => ({ ...v }))
        : [{ size: 'M', color: 'Negro', cost: 10, price: 20, stock: 5 }]
    );
    showToast(`Modo edición activado para el modelo ${item.code}.`, false, 'info');
  };

  // Reset form
  const handleResetForm = () => {
    setIsEditing(false);
    setCode('');
    setName('');
    setAudience('Hombre');
    setCategory('Camisa');
    setVariants([{ size: 'M', color: 'Azul', cost: 10.0, price: 20.0, stock: 5 }]);
  };

  // Submit Inventory Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode || !cleanName) {
      showToast('⚠️ Ingrese código y nombre para el modelo.', true);
      return;
    }

    if (variants.length === 0) {
      showToast('⚠️ Agregue al menos una variante con talla y precio.', true);
      return;
    }

    // Validate variants
    for (const v of variants) {
      if (!v.size.trim() || !v.color.trim()) {
        showToast('⚠️ Todas las variantes deben tener talla y color especificados.', true);
        return;
      }
      if (isNaN(v.cost) || v.cost < 0 || isNaN(v.price) || v.price < 0 || isNaN(v.stock) || v.stock < 0) {
        showToast('⚠️ El costo, precio y stock no pueden ser negativos.', true);
        return;
      }
    }

    // Check duplicate sizes/colors in the same item
    const keys = variants.map((v) => `${v.size.trim().toLowerCase()}|${v.color.trim().toLowerCase()}`);
    if (new Set(keys).size !== keys.length) {
      showToast('⚠️ Hay tallas y colores repetidos en el mismo modelo.', true);
      return;
    }

    try {
      if (isEditing) {
        await InventoryService.update(cleanCode, {
          name: cleanName,
          audience,
          category,
          variants,
        });
        showToast(`✅ Modelo ${cleanCode} actualizado con éxito en la base de datos.`);
      } else {
        await InventoryService.create({
          code: cleanCode,
          name: cleanName,
          audience,
          category,
          variants,
        });
        showToast(`✅ Modelo ${cleanCode} registrado con éxito en inventario.`);
      }

      handleResetForm();
      loadInventory();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar prenda en inventario.', true);
    }
  };

  // Delete item
  const handleDeleteItem = async (itemCode: string) => {
    if (!isOwner) {
      showToast('⚠️ Solo el Dueño / Administrador puede eliminar modelos del inventario.', true);
      return;
    }

    const ok = await confirm({
      title: 'Eliminar modelo de inventario',
      message: `¿Estás seguro de eliminar el modelo ${itemCode} con todas sus tallas y stock?\nEsta acción no se puede deshacer.`,
      tone: 'danger',
      confirmText: 'Eliminar Modelo',
    });

    if (!ok) return;

    try {
      await InventoryService.delete(itemCode);
      showToast(`Modelo ${itemCode} eliminado de inventario.`, false, 'info');
      loadInventory();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar modelo.', true);
    }
  };

  // Counts by audience
  const audienceCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: items.length,
      Hombre: 0,
      Mujer: 0,
      Niño: 0,
      Niña: 0,
      Unisex: 0,
    };
    items.forEach((item) => {
      if (counts[item.audience] !== undefined) {
        counts[item.audience]++;
      }
    });
    return counts;
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchAud = activeAudienceFilter === 'ALL' || item.audience === activeAudienceFilter;
      const matchCat = !activeCategoryFilter || item.category === activeCategoryFilter;
      return matchAud && matchCat;
    });
  }, [items, activeAudienceFilter, activeCategoryFilter]);

  return (
    <div className="section-view active space-y-4">
      {/* Selector de Chips de Público */}
      <div className="cat-filter-chips flex items-center gap-1.5 flex-wrap">
        {[
          { key: 'ALL', label: 'Todos' },
          { key: 'Hombre', label: 'Hombre' },
          { key: 'Mujer', label: 'Mujer' },
          { key: 'Niño', label: 'Niño' },
          { key: 'Niña', label: 'Niña' },
          { key: 'Unisex', label: 'Unisex' },
        ].map((chip) => (
          <button
            key={chip.key}
            type="button"
            className={`cat-chip ${activeAudienceFilter === chip.key ? 'active' : ''}`}
            onClick={() => setActiveAudienceFilter(chip.key)}
          >
            <span>{chip.label}</span>
            <span className="cnt ml-1.5 text-xs opacity-75">
              ({audienceCounts[chip.key] || 0})
            </span>
          </button>
        ))}

        <div className="ml-auto">
          <select
            value={activeCategoryFilter}
            onChange={(e) => setActiveCategoryFilter(e.target.value)}
            className="text-xs p-1.5 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
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
      </div>

      <div className="workspace">
        {/* Formulario de Alta y Edición de Prendas */}
        <div className="card-box">
          <div className="flex justify-between items-center border-b border-[#CBDCC5] pb-2 mb-3">
            <h3 className="text-sm font-bold text-[#2F4A38] flex items-center gap-2 m-0 border-0 p-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
              {isEditing ? `Editando Modelo: ${code}` : 'Registrar Prenda en Bodega'}
            </h3>
            {isEditing && (
              <button
                type="button"
                onClick={handleResetForm}
                className="text-xs text-[#4F6F52] font-semibold hover:underline"
              >
                + Nuevo Modelo
              </button>
            )}
          </div>

          <form onSubmit={handleSubmitForm} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="form-group">
                <label className="text-xs font-semibold text-[#46524A] block mb-1">
                  Código de Modelo:
                </label>
                <input
                  type="text"
                  value={code}
                  readOnly={isEditing}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ej. CAM-01"
                  required
                  className={`w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] font-mono uppercase focus:border-[#4F6F52] outline-none ${
                    isEditing ? 'opacity-60 cursor-not-allowed bg-[#EEF1E8]' : ''
                  }`}
                />
              </div>

              <div className="form-group">
                <label className="text-xs font-semibold text-[#46524A] block mb-1">
                  Nombre de la Prenda:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Camisa Oxford Formal"
                  required
                  className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="form-group">
                <label className="text-xs font-semibold text-[#46524A] block mb-1">
                  Público Objetivo:
                </label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                >
                  <option value="Hombre">Hombre</option>
                  <option value="Mujer">Mujer</option>
                  <option value="Niño">Niño</option>
                  <option value="Niña">Niña</option>
                  <option value="Unisex">Unisex</option>
                </select>
              </div>

              <div className="form-group">
                <label className="text-xs font-semibold text-[#46524A] block mb-1">
                  Tipo / Categoría:
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs p-2 rounded-md bg-[#F7F8F3] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                >
                  <option value="Camisa">Camisa</option>
                  <option value="Pantalón">Pantalón</option>
                  <option value="Vestido">Vestido</option>
                  <option value="Falda">Falda</option>
                  <option value="Short">Short</option>
                  <option value="Calzado">Calzado</option>
                </select>
              </div>
            </div>

            {/* Variantes: Tallas, Colores, Costos, Precios y Stock */}
            <div className="pt-2 border-t border-[#CBDCC5]">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-[#2F4A38]">
                  Variantes de Talla, Costo y Precio de Venta:
                </label>
                <button
                  type="button"
                  onClick={handleAddVariantRow}
                  className="btn btn-light text-[11px] py-1 px-2.5 font-medium"
                >
                  + Agregar Talla
                </button>
              </div>

              <div className="space-y-2">
                {variants.map((v, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-6 gap-1.5 items-center bg-[#F2F6EE] p-2 rounded-lg border border-[#CBDCC5]"
                  >
                    <div>
                      <input
                        type="text"
                        placeholder="Talla"
                        value={v.size}
                        onChange={(e) => handleVariantChange(idx, 'size', e.target.value)}
                        required
                        className="w-full p-1 text-xs text-center rounded bg-[#FFFFFF] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Color"
                        value={v.color}
                        onChange={(e) => handleVariantChange(idx, 'color', e.target.value)}
                        required
                        className="w-full p-1 text-xs text-center rounded bg-[#FFFFFF] border border-[#D7DDCF] text-[#2F3A33] focus:border-[#4F6F52] outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Costo $"
                        title="Precio de costo de adquisición"
                        value={v.cost}
                        onChange={(e) => handleVariantChange(idx, 'cost', parseFloat(e.target.value) || 0)}
                        required
                        className="w-full p-1 text-xs text-center rounded bg-[#FFFFFF] border border-[#D7DDCF] text-[#B58A3C] font-semibold focus:border-[#4F6F52] outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Venta $"
                        title="Precio de venta al público"
                        value={v.price}
                        onChange={(e) => handleVariantChange(idx, 'price', parseFloat(e.target.value) || 0)}
                        required
                        className="w-full p-1 text-xs text-center rounded bg-[#FFFFFF] border border-[#D7DDCF] text-[#2F4A38] font-bold focus:border-[#4F6F52] outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        min="0"
                        placeholder="Stock"
                        title="Unidades disponibles"
                        value={v.stock}
                        onChange={(e) => handleVariantChange(idx, 'stock', parseInt(e.target.value) || 0)}
                        required
                        className="w-full p-1 text-xs text-center rounded bg-[#FFFFFF] border border-[#D7DDCF] text-[#2F3A33] font-medium focus:border-[#4F6F52] outline-none"
                      />
                    </div>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveVariantRow(idx)}
                        className="btn btn-danger text-xs px-2 py-1"
                        title="Quitar variante"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="btn btn-primary w-full py-2 font-semibold text-xs"
              >
                {isEditing ? 'Actualizar Modelo y Variantes' : 'Guardar Modelo en Inventario'}
              </button>
            </div>
          </form>
        </div>

        {/* Tabla de Inventario de Bodega */}
        <div className="card-box space-y-3">
          <div className="flex justify-between items-center border-b border-[#CBDCC5] pb-2">
            <h3 className="text-sm font-bold text-[#2F4A38] flex items-center gap-2 m-0 border-0 p-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#4F6F52]">
                <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
                <path d="M3 8l9 5 9-5M12 13v8" />
              </svg>
              Catálogo de Bodega ({filteredItems.length} Modelos)
            </h3>
            <span className="text-xs text-[#6F7B72] font-medium">
              Filtro: {activeAudienceFilter} / {activeCategoryFilter || 'Todas'}
            </span>
          </div>

          <div className="table-responsive-container">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#CBDCC5] bg-[#EDF3E8] text-[#2F4A38]">
                  <th className="p-2.5 w-24">Código</th>
                  <th className="p-2.5 w-44">Prenda / Categoría</th>
                  <th className="p-2.5">Tallas, Precios y Stock</th>
                  <th className="p-2.5 text-center w-36 whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-[#6F7B72]">
                      Sin modelos registrados en esta categoría.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.code} className="border-b border-[#E6EBDF] hover:bg-[#E6EBDF]/60 transition-colors">
                      <td className="p-2.5 align-top">
                        <span className="badge badge-stock font-mono font-bold">
                          {item.code}
                        </span>
                      </td>
                      <td className="p-2.5 align-top">
                        <b className="text-[#2F3A33] block text-xs">{item.name}</b>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <span className="badge badge-cat text-[10px]">{item.audience || 'General'}</span>
                          <span className="badge badge-cat text-[10px]">{item.category || 'Ropa'}</span>
                        </div>
                      </td>
                      <td className="p-2 align-top">
                        <ul className="space-y-1 pl-1">
                          {item.variants.map((v, vIdx) => {
                            const isOut = v.stock <= 0;
                            const isLow = v.stock > 0 && v.stock <= 3;
                            return (
                              <li key={vIdx} className="text-[11px] flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-[#46524A]">
                                  Talla <b className="text-[#2F3A33]">{v.size}</b> ({v.color})
                                </span>
                                <span>—</span>
                                <b className="text-[#2F4A38] font-bold">${v.price.toFixed(2)}</b>
                                <span className="text-[10px] text-[#6F7B72]">
                                  (costo ${v.cost !== undefined ? v.cost.toFixed(2) : '0.00'})
                                </span>
                                <span>—</span>
                                <span
                                  className={`badge ${
                                    isOut
                                      ? 'badge-danger font-bold'
                                      : isLow
                                      ? 'badge-warning font-semibold'
                                      : 'badge-stock'
                                  }`}
                                >
                                  {isOut ? 'Agotado' : isLow ? `Bajo stock (${v.stock})!` : `${v.stock} un.`}
                                </span>
                                <span className={`stk ${isOut ? 'z' : isLow ? 'l' : ''}`}>
                                  <i style={{ width: `${Math.min(100, v.stock * 10)}%` }}></i>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                      {/* Columna de Acciones sin truncamiento */}
                      <td className="p-2 align-top text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-center">
                          <button
                            type="button"
                            className="btn btn-light btn-table-action text-[11px] px-2.5 py-1 whitespace-nowrap"
                            onClick={() => handleEditItem(item)}
                            title="Editar prenda y variantes"
                          >
                            <span>✏️</span>
                            <span>Editar</span>
                          </button>

                          {isOwner && (
                            <button
                              type="button"
                              className="btn btn-danger btn-table-action text-[11px] px-2 py-1 whitespace-nowrap"
                              onClick={() => handleDeleteItem(item.code)}
                              title="Eliminar prenda completa"
                            >
                              <span>✕</span>
                            </button>
                          )}
                        </div>
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
  );
}
