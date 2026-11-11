import { MovementsService } from '../services/movements.service';
import { InventoryService } from '../services/inventory.service';
import { ApartadosService } from '../services/apartados.service';
import { CajaChicaService } from '../services/cajaChica.service';
import { CierresService } from '../services/cierres.service';
import { CalendarService } from '../services/calendar.service';

export async function exportComprehensiveBackupCSV() {
  const [movements, inventory, apartados, cajaChica, cajaClosures, invClosures, calendar] =
    await Promise.all([
      MovementsService.getByDate('TODOS'),
      InventoryService.getAll(),
      ApartadosService.getAll(),
      CajaChicaService.getSummary(),
      CierresService.getCajaClosures(),
      CierresService.getInventoryClosures(),
      CalendarService.getAll(),
    ]);

  const rows: string[] = [];

  // UTF-8 BOM for Excel
  rows.push('sep=,');
  rows.push('================================================================');
  rows.push('CONTROL CONTABLE PRO - RESPALDO COMPLETO DEL SISTEMA');
  rows.push(`Fecha de Generación: ${new Date().toLocaleString()}`);
  rows.push('Régimen Fiscal: El Salvador (IVA 13% Incluido)');
  rows.push('================================================================\n');

  // 1. MOVIMIENTOS CONTABLES
  rows.push('--- SECCIÓN 1: MOVIMIENTOS CONTABLES (VENTAS, COMPRAS, SERVICIOS) ---');
  rows.push('ID,Fecha,Hora,Tipo,Comprobante,Vale_Interno,Descripción,Monto_USD,IVA_13_USD,Detalle_Items');
  (movements || []).forEach((m) => {
    const itemsStr = m.items ? JSON.stringify(m.items).replace(/"/g, '""') : '';
    const descClean = (m.desc || '').replace(/"/g, '""');
    rows.push(
      `${m.id},"${m.date}","${m.time || ''}","${m.type}","${m.doc}","${m.voucherCode || ''}","${descClean}",${m.amount.toFixed(2)},${m.tax.toFixed(2)},"${itemsStr}"`
    );
  });
  rows.push('\n');

  // 2. INVENTARIO Y VARIANTES CON COSTOS
  rows.push('--- SECCIÓN 2: INVENTARIO DE BODEGA Y VARIANTES ---');
  rows.push('Código_Modelo,Nombre_Prenda,Público,Categoría,Talla,Color,Costo_USD,Precio_Venta_USD,Stock_Unidades,Valor_Costo_Total,Valor_Venta_Total');
  (inventory || []).forEach((item) => {
    (item.variants || []).forEach((v) => {
      const cost = v.cost || 0;
      const totalCost = cost * v.stock;
      const totalSale = v.price * v.stock;
      rows.push(
        `"${item.code}","${item.name.replace(/"/g, '""')}","${item.audience}","${item.category}","${v.size}","${v.color}",${cost.toFixed(2)},${v.price.toFixed(2)},${v.stock},${totalCost.toFixed(2)},${totalSale.toFixed(2)}`
      );
    });
  });
  rows.push('\n');

  // 3. APARTADOS DE CLIENTES
  rows.push('--- SECCIÓN 3: APARTADOS Y ABONOS DE CLIENTES ---');
  rows.push('ID,Fecha,Hora,Cliente,Prenda,Total_USD,Abonado_USD,Saldo_Pendiente_USD,Estado');
  (apartados || []).forEach((ap) => {
    const saldo = Math.max(0, ap.total - ap.abono);
    rows.push(
      `${ap.id},"${ap.date}","${ap.time || ''}","${ap.clientName.replace(/"/g, '""')}","${ap.prendaDesc.replace(/"/g, '""')}",${ap.total.toFixed(2)},${ap.abono.toFixed(2)},${saldo.toFixed(2)},"${ap.status}"`
    );
  });
  rows.push('\n');

  // 4. CAJA CHICA
  rows.push('--- SECCIÓN 4: MOVIMIENTOS DE CAJA CHICA ---');
  rows.push(`Saldo Actual: $${cajaChica.balance.toFixed(2)} | Total Ingresos: $${cajaChica.totalIn.toFixed(2)} | Total Gastos: $${cajaChica.totalOut.toFixed(2)}`);
  rows.push('ID,Fecha,Hora,Tipo,Categoría,Concepto,Monto_USD');
  (cajaChica.movements || []).forEach((cm) => {
    rows.push(
      `${cm.id},"${cm.date}","${cm.time || ''}","${cm.type}","${cm.category}","${(cm.desc || '').replace(/"/g, '""')}",${cm.amount.toFixed(2)}`
    );
  });
  rows.push('\n');

  // 5. CIERRES DE CAJA Y ARQUEOS
  rows.push('--- SECCIÓN 5: ARQUEOS DIARIOS DE CAJA ---');
  rows.push('ID,Fecha,Hora,Cajero,Fondo_Apertura,Ventas,Gastos,Esperado_USD,Recontado_USD,Diferencia_USD,Observación');
  (cajaClosures || []).forEach((cc) => {
    rows.push(
      `${cc.id},"${cc.date}","${cc.time}","${cc.cashierName}",${cc.openingFund.toFixed(2)},${cc.salesTotal.toFixed(2)},${cc.expensesTotal.toFixed(2)},${cc.expectedTotal.toFixed(2)},${cc.countedTotal.toFixed(2)},${cc.difference.toFixed(2)},"${(cc.note || '').replace(/"/g, '""')}"`
    );
  });
  rows.push('\n');

  // 6. SNAPSHOTS DE INVENTARIO
  rows.push('--- SECCIÓN 6: SNAPSHOTS DE CIERRE DE INVENTARIO ---');
  rows.push('ID,Fecha,Hora,Alcance,Prendas_Totales,Valor_Costo_Total,Valor_Venta_Total,Margen_Proyectado,Nota');
  (invClosures || []).forEach((ic) => {
    rows.push(
      `${ic.id},"${ic.date}","${ic.time}","${ic.scope}",${ic.totals.totalUnits},${ic.totals.totalCostValue.toFixed(2)},${ic.totals.totalSaleValue.toFixed(2)},${ic.totals.potentialMargin.toFixed(2)},"${(ic.note || '').replace(/"/g, '""')}"`
    );
  });
  rows.push('\n');

  // 7. CALENDARIO DE OPERACIONES
  rows.push('--- SECCIÓN 7: CALENDARIO DE OPERACIONES Y JORNADAS ---');
  rows.push('Fecha,Estado_Jornada,Nota');
  Object.keys(calendar || {}).sort().forEach((dateKey) => {
    const cal = calendar[dateKey];
    rows.push(`"${dateKey}","${cal.status}","${(cal.note || '').replace(/"/g, '""')}"`);
  });

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const nowStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `Control_Contable_Respaldo_${nowStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
