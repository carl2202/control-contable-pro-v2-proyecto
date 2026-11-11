// ==========================================================================
// Módulo Reportes (F5) y exportación
// Reporte por rango de fechas (con resumen de jornadas del calendario) y respaldo CSV completo.
// ==========================================================================

    // Fecha ISO de un movimiento de caja chica. Los nuevos guardan 'date'; los antiguos solo tienen 'id' (= Date.now()
    // al crearlos), de donde se recupera la fecha real.
    function cajaChicaDateOf(item) {
        if (item.date) return item.date;
        const d = new Date(item.id);
        return isNaN(d.getTime()) ? '' : formatISODate(d);
    }

    // Atajo de rango: fija el periodo de los últimos N días (hoy incluido) y genera el reporte.
    // @param {number} days  Número de días.
    function setReportShortcut(days) {
        const endD = new Date();
        const startD = new Date();
        startD.setDate(endD.getDate() - (days - 1));

        document.getElementById('reportStartDate').value = formatISODate(startD);
        document.getElementById('reportEndDate').value = formatISODate(endD);
        generateDateRangeReport();
    }

    // Genera el reporte para el rango [inicio, fin]: lista los movimientos y calcula ventas, gastos de ropa, gastos de comida y utilidad.
    function generateDateRangeReport() {
        const start = document.getElementById('reportStartDate').value;
        const end = document.getElementById('reportEndDate').value;

        if (!start || !end) { showToast('⚠️ Selecciona ambas fechas.', true); return; }
        if (start > end) { showToast('⚠️ La fecha de inicio no puede ser mayor a la fecha fin.', true); return; }

        // Reúne todos los movimientos cuya fecha cae dentro del rango.
        let rangeRecords = [];
        Object.keys(storeDb).forEach(dateKey => {
            if (dateKey >= start && dateKey <= end) {
                storeDb[dateKey].forEach(r => {
                    rangeRecords.push({ ...r, dateKey });
                });
            }
        });

        let rSales = 0;
        let rExpenseClothing = 0;
        let rExpenseFood = 0;
        let rExpenseServices = 0;   // luz, agua, internet/teléfono registrados en Contable
        let rExpenseOtherCC = 0;    // gastos de caja chica que no son comida (papelería, limpieza, etc.)

        // Gastos de caja chica DENTRO del rango. Se leen siempre de cajaChicaDb (y no de los registros 'cajachica' de storeDb,
        // que son su espejo) para no contarlos dos veces: 'Alimentación y Refrigerios' = comida; el resto = otros gastos de caja chica.
        cajaChicaDb.forEach(item => {
            const ccDate = cajaChicaDateOf(item);
            if (item.type !== 'gasto' || ccDate < start || ccDate > end) return;
            if (item.category === 'Alimentación y Refrigerios') rExpenseFood += item.amount;
            else rExpenseOtherCC += item.amount;
        });

        const tbody = document.getElementById('reportTableBody');
        tbody.innerHTML = '';

        if (rangeRecords.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No hay registros en este rango de fechas.</td></tr>`;
        } else {
            rangeRecords.sort((a,b) => a.dateKey.localeCompare(b.dateKey)).forEach(r => {
                // Ventas suman a ingresos; las compras de mercadería suman al gasto de ropa.
                if (r.type === 'venta') {
                    rSales += r.amount;
                } else if (r.type === 'compra') {
                    rExpenseClothing += r.amount;
                } else if (['luz', 'agua', 'internet'].includes(r.type)) {
                    rExpenseServices += r.amount;
                }

                let badgeClass = 'badge-' + r.type;
                if (['luz', 'agua', 'internet'].includes(r.type)) badgeClass = 'badge-servicio';
                if (r.type === 'cajachica') badgeClass = 'badge-cajachica';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${escapeHtml(r.dateKey)} ${escapeHtml(r.time || '')}</td>
                    <td><span class="badge ${badgeClass}">${escapeHtml(String(r.type).toUpperCase())}</span></td>
                    <td>${escapeHtml(r.desc)} <br><small style="color:var(--text-muted);">Doc: ${escapeHtml(r.doc)}</small></td>
                    <td><b>$${r.amount.toFixed(2)}</b></td>
                    <td><span style="color:var(--warning);">$${(r.tax || 0).toFixed(2)}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Total gastado = mercadería + comida + servicios básicos + otros gastos de caja chica.
        const totalExpenses = rExpenseClothing + rExpenseFood + rExpenseServices + rExpenseOtherCC;
        // Utilidad de la ropa = ventas - compras de mercadería.
        const netProfitClothing = rSales - rExpenseClothing;

        document.getElementById('repSales').textContent = `$${rSales.toFixed(2)}`;
        document.getElementById('repExpenseClothing').textContent = `$${rExpenseClothing.toFixed(2)}`;
        document.getElementById('repExpenseFood').textContent = `$${rExpenseFood.toFixed(2)}`;
        document.getElementById('repExpenseServices').textContent = `$${rExpenseServices.toFixed(2)}`;
        document.getElementById('repExpenseOtherCC').textContent = `$${rExpenseOtherCC.toFixed(2)}`;
        document.getElementById('repExpenseTotal').textContent = `$${totalExpenses.toFixed(2)}`;
        document.getElementById('repExpenseSubdetail').textContent = `(Ropa: $${rExpenseClothing.toFixed(2)} | Comida: $${rExpenseFood.toFixed(2)} | Servicios: $${rExpenseServices.toFixed(2)} | Caja chica: $${rExpenseOtherCC.toFixed(2)})`;
        document.getElementById('repProfitClothing').textContent = `$${netProfitClothing.toFixed(2)}`;

        // Jornadas del calendario en el mismo rango (laborados, sin ventas, asueto, promedio por día laborado).
        renderJornadasReport(start, end, rSales);

        document.getElementById('reportMetricsGrid').style.display = 'grid';
        document.getElementById('reportTableContainer').style.display = 'block';
        showToast('📊 Reporte generado con éxito.');
    }

    // Convierte un valor en una celda CSV segura: duplica las comillas internas (antes una descripción con " rompía las columnas)
    // y neutraliza fórmulas (=, +, -, @) para que Excel no las ejecute al abrir el archivo.
    const csvCell = (v) => {
        let t = String(v ?? '');
        if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
        return '"' + t.replace(/"/g, '""') + '"';
    };

    // Descarga un respaldo CSV (separador ';', con BOM para Excel) en UN solo archivo con una sección por cada base de datos:
    // movimientos contables, inventario (con costos), apartados, caja chica, cierres de inventario (resumen y detalle) y calendario.
    // Cada sección empieza con una fila "# TÍTULO" seguida de su encabezado, y se separa de la siguiente con una fila vacía.
    function exportDataCSV() {
        const lines = [];
        const row = (cells) => lines.push(cells.map(csvCell).join(';'));
        const section = (title, header) => { if (lines.length) lines.push(''); row(['# ' + title]); row(header); };
        const money = (n) => Number(n || 0).toFixed(2);

        section('MOVIMIENTOS CONTABLES', ['TIPO', 'FECHA', 'DETALLE', 'MONTO', 'IVA', 'COMPROBANTE']);
        Object.keys(storeDb).sort().forEach(k => {
            storeDb[k].forEach(r => row([r.type, k, r.desc, money(r.amount), money(r.tax), r.doc]));
        });

        section('INVENTARIO', ['CODIGO', 'MODELO', 'PUBLICO', 'CATEGORIA', 'TALLA', 'COLOR', 'COSTO', 'PRECIO VENTA', 'STOCK']);
        inventoryDb.forEach(i => (i.variants || []).forEach(v => row([i.code, i.name, i.audience, i.category, v.size, v.color, typeof v.cost === 'number' ? money(v.cost) : '', money(v.price), v.stock])));

        section('APARTADOS', ['ID', 'CLIENTE', 'PRENDA', 'TOTAL', 'ABONO', 'SALDO', 'ESTADO']);
        apartadosDb.forEach(a => row([a.id, a.clientName, a.prendaDesc, money(a.total), money(a.abono), money(Math.max(0, a.total - a.abono)), a.status]));

        section('CAJA CHICA', ['FECHA', 'TIPO', 'CATEGORIA', 'DETALLE', 'MONTO']);
        cajaChicaDb.forEach(c => row([cajaChicaDateOf(c), c.type, c.category, c.desc, money(c.amount)]));

        section('CIERRES DE INVENTARIO', ['FECHA', 'HORA', 'ALCANCE', 'CATEGORIAS', 'MODELOS', 'UNIDADES', 'VALOR A COSTO', 'VALOR A PRECIO DE VENTA', 'NOTA']);
        cierresDb.forEach(c => row([c.date, c.time, c.scope, c.categories.join(', '), c.totals.models, c.totals.units, money(c.totals.costValue), money(c.totals.saleValue), c.note]));

        section('DETALLE DE CIERRES DE INVENTARIO', ['FECHA CIERRE', 'CODIGO', 'MODELO', 'CATEGORIA', 'TALLA', 'COLOR', 'COSTO', 'PRECIO VENTA', 'STOCK', 'VALOR A COSTO']);
        cierresDb.forEach(c => c.items.forEach(i => row([c.date, i.code, i.name, i.category, i.size, i.color, i.cost === null ? '' : money(i.cost), money(i.price), i.stock, money(i.costValue)])));

        section('CALENDARIO DE OPERACIONES', ['FECHA', 'ESTADO', 'NOTA']);
        Object.keys(calendarDb).sort().forEach(k => row([k, CAL_STATUS[calendarDb[k].status] ? CAL_STATUS[calendarDb[k].status].long : calendarDb[k].status, calendarDb[k].note]));

        const blob = new Blob(["\uFEFF" + lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Respaldo_${todayStr}.csv`;
        // Se añade al DOM para que funcione en todos los navegadores y se libera la URL temporal.
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Respaldo CSV descargado con todas las secciones.');
    }
