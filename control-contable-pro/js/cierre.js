// ==========================================================================
// Módulo F6: Cierre de inventario
//   1) getInventoryValuation(): valor monetario del inventario = SUM(stock x precio de COSTO) (y, como referencia, a precio de venta).
//   2) Historial de cierres en forma de "snapshots": copia estática del stock, costos y precios de cada variante en una fecha.
//      Los snapshots se congelan (Object.freeze) y se guardan como copias, de modo que cambios posteriores en el inventario
//      (precios, stock, borrado de modelos) NO alteran los cierres anteriores. No tienen edición: solo consulta y eliminación.
//   3) Cierre general (todo el inventario) o selectivo por categorías (tipo de prenda).
// ==========================================================================

    // Categorías incluidas en el cierre en preparación (vacío = todo el inventario).
    let closureScope = new Set();

    const fmtMoney = (n) => '$' + Number(n || 0).toFixed(2);

    // Calcula el valor del inventario actual.
    // Los importes se acumulan en centavos para evitar errores de coma flotante.
    // @param {string[]} categories  Categorías a incluir; vacío = todas.
    // @returns {{rows:Array, costValue:number, saleValue:number, units:number, models:number, variants:number, missingCost:number}}
    //   rows: una fila por variante (incluye las de stock 0 para que el snapshot refleje el catálogo completo).
    //   missingCost: variantes CON stock que no tienen costo registrado (valen $0 en el valor a costo).
    function getInventoryValuation(categories = []) {
        const wanted = new Set(categories);
        const rows = [];
        const models = new Set();
        let costCents = 0, saleCents = 0, units = 0, missingCost = 0;

        inventoryDb.forEach(item => {
            if (wanted.size > 0 && !wanted.has(item.category)) return;
            (item.variants || []).forEach(v => {
                const stock = Math.max(0, parseInt(v.stock) || 0);
                const hasCost = typeof v.cost === 'number' && isFinite(v.cost) && v.cost >= 0;
                const price = Number(v.price) || 0;
                const costCentsUnit = hasCost ? Math.round(v.cost * 100) : 0;
                costCents += costCentsUnit * stock;
                saleCents += Math.round(price * 100) * stock;
                units += stock;
                if (stock > 0 && !hasCost) missingCost++;
                models.add(item.code);
                rows.push({
                    code: item.code, name: item.name, audience: item.audience || '', category: item.category || '',
                    size: v.size, color: v.color, cost: hasCost ? v.cost : null, price, stock,
                    costValue: (costCentsUnit * stock) / 100
                });
            });
        });
        return { rows, costValue: costCents / 100, saleValue: saleCents / 100, units, models: models.size, variants: rows.length, missingCost };
    }

    // Categorías disponibles: se leen del <select id="invCategory"> del formulario de inventario (una sola fuente de verdad).
    const closureCategories = () => [...document.querySelectorAll('#invCategory option')].map(o => o.value);

    // Alterna una categoría del alcance ('' = todo el inventario).
    function toggleClosureCategory(val) {
        if (val === '') closureScope.clear();
        else if (closureScope.has(val)) closureScope.delete(val);
        else closureScope.add(val);
        renderClosureScope();
        renderClosurePreview();
    }

    // Dibuja las fichas de alcance con las unidades en stock de cada categoría.
    function renderClosureScope() {
        const box = document.getElementById('closureScope');
        const unitsBy = {};
        inventoryDb.forEach(i => { unitsBy[i.category] = (unitsBy[i.category] || 0) + (i.variants || []).reduce((a, v) => a + (parseInt(v.stock) || 0), 0); });
        const total = Object.values(unitsBy).reduce((a, b) => a + b, 0);
        const pill = (val, label, units) => `<button type="button" class="op-tile op-pill${(val === '' ? closureScope.size === 0 : closureScope.has(val)) ? ' active' : ''}" ` +
            `data-val="${escapeHtml(val)}" onclick="toggleClosureCategory(this.dataset.val)"><span><b>${escapeHtml(label)}</b></span><small class="cell-mono">${units}</small></button>`;
        box.innerHTML = pill('', 'Todo el inventario', total) + closureCategories().map(c => pill(c, c, unitsBy[c] || 0)).join('');
    }

    // Actualiza las tarjetas con la valoración del alcance elegido y el aviso de variantes sin costo.
    function renderClosurePreview() {
        const v = getInventoryValuation([...closureScope]);
        document.getElementById('clsCost').textContent = fmtMoney(v.costValue);
        document.getElementById('clsSale').textContent = fmtMoney(v.saleValue);
        document.getElementById('clsUnits').textContent = v.units;
        document.getElementById('clsModels').textContent = `${v.models} / ${v.variants}`;
        const warn = document.getElementById('closureWarning');
        if (v.missingCost > 0) {
            warn.innerHTML = `<b>${v.missingCost} variante(s) con stock no tienen precio de costo</b> y se valoran en $0.00. Edítalas en Inventario para completar el costo antes de cerrar.`;
            warn.style.display = 'block';
        } else {
            warn.style.display = 'none';
        }
    }

    // Dibuja el historial de cierres (más recientes primero).
    function renderClosureHistory() {
        const body = document.getElementById('closureHistoryBody');
        const list = cierresDb.slice().sort((a, b) => (b.date + b.id).toString().localeCompare((a.date + a.id).toString()));
        if (list.length === 0) {
            body.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:22px;">Aún no hay cierres. Realiza el primero desde el formulario.</td></tr>';
            return;
        }
        body.innerHTML = list.map(c => `<tr>
            <td><b class="cell-mono">${escapeHtml(c.date)}</b><span class="closure-scope-cats">${escapeHtml(c.time || '')}</span></td>
            <td><span class="badge ${c.scope === 'GENERAL' ? 'badge-venta' : 'badge-cajachica'}">${c.scope === 'GENERAL' ? 'GENERAL' : 'SELECTIVO'}</span>
                <span class="closure-scope-cats">${c.scope === 'GENERAL' ? 'Todo el inventario' : escapeHtml(c.categories.join(', '))}${c.note ? ' · ' + escapeHtml(c.note) : ''}</span></td>
            <td class="cell-mono">${c.totals.units}</td>
            <td class="cell-mono"><b>${fmtMoney(c.totals.costValue)}</b></td>
            <td><div class="closure-actions">
                <button type="button" class="btn btn-light" onclick="viewClosure(${Number(c.id)})">Ver</button>
                <button type="button" class="btn btn-danger" onclick="deleteClosure(${Number(c.id)})">✕</button>
            </div></td>
        </tr>`).join('');
    }

    // Punto de entrada al abrir el módulo.
    function renderCierre() {
        const dateInput = document.getElementById('closureDate');
        if (!dateInput.value) dateInput.value = todayStr;
        renderClosureScope();
        renderClosurePreview();
        renderClosureHistory();
    }

    // Crea el snapshot del cierre con los datos actuales del inventario.
    // Pide confirmación si hay variantes sin costo o si ya existe un cierre del mismo alcance en esa fecha.
    async function createInventoryClosure(e) {
        if (e) e.preventDefault();
        const date = document.getElementById('closureDate').value;
        if (!date) { showToast('⚠️ Selecciona la fecha del cierre.', true); return; }
        const categories = [...closureScope];
        const val = getInventoryValuation(categories);
        if (val.rows.length === 0) { showToast('⚠️ No hay productos en el alcance seleccionado.', true); return; }

        const scope = categories.length === 0 ? 'GENERAL' : 'SELECTIVO';
        const scopeKey = categories.slice().sort().join('|');
        if (cierresDb.some(c => c.date === date && c.categories.slice().sort().join('|') === scopeKey)) {
            const ok = await confirmDialog({
                title: 'Ya existe un cierre igual', tone: 'warning', confirmText: 'Crear otro cierre',
                message: `Ya hay un cierre ${scope === 'GENERAL' ? 'general' : 'de las mismas categorías'} con fecha ${date}.\nSe conservarán ambos como registros independientes.\n\n¿Deseas crear otro?`
            });
            if (!ok) return;
        }
        if (val.missingCost > 0) {
            const ok = await confirmDialog({
                title: 'Variantes sin precio de costo', tone: 'warning', confirmText: 'Cerrar de todos modos',
                message: `${val.missingCost} variante(s) con stock no tienen costo registrado y se valorarán en $0.00 en este cierre.\nEl cierre es una fotografía y no podrá corregirse después.\n\n¿Deseas continuar?`
            });
            if (!ok) return;
        }

        const now = new Date();
        const snapshot = deepFreeze({
            id: Date.now(),
            date,
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            scope,
            categories,
            note: document.getElementById('closureNote').value.trim().slice(0, 120),
            totals: { costValue: val.costValue, saleValue: val.saleValue, units: val.units, models: val.models, variants: val.variants, missingCost: val.missingCost },
            items: val.rows           // copia independiente: filas nuevas creadas por getInventoryValuation, no referencias al inventario
        });
        cierresDb.push(snapshot);
        try {
            localStorage.setItem('ropa_cierres_v11', JSON.stringify(cierresDb));
        } catch (err) {
            cierresDb.pop();
            showToast('No se pudo guardar el cierre (almacenamiento lleno).', true);
            return;
        }
        document.getElementById('closureNote').value = '';
        renderClosureHistory();
        showToast(`Cierre ${scope === 'GENERAL' ? 'general' : 'selectivo'} del ${date} guardado: ${fmtMoney(val.costValue)} a costo.`);
    }

    // Muestra el detalle completo de un cierre (solo lectura).
    function viewClosure(id) {
        const c = cierresDb.find(x => x.id === id);
        if (!c) return;
        const body = document.createElement('div');
        const rows = c.items.slice().sort((a, b) => String(a.code).localeCompare(String(b.code)) || String(a.size).localeCompare(String(b.size)));
        body.innerHTML = `
            <div class="dlg-stats">
                <div class="dlg-stat"><small>Valor a costo</small><b>${fmtMoney(c.totals.costValue)}</b></div>
                <div class="dlg-stat"><small>Valor a precio de venta</small><b>${fmtMoney(c.totals.saleValue)}</b></div>
                <div class="dlg-stat"><small>Unidades</small><b>${c.totals.units}</b></div>
                <div class="dlg-stat"><small>Modelos / variantes</small><b>${c.totals.models} / ${c.totals.variants}</b></div>
            </div>
            <p class="dlg-meta">Cierre ${c.scope === 'GENERAL' ? '<b>general</b> (todo el inventario)' : '<b>selectivo</b>: ' + escapeHtml(c.categories.join(', '))} · ${escapeHtml(c.date)} ${escapeHtml(c.time || '')}
                ${c.note ? '<br>Nota: ' + escapeHtml(c.note) : ''}
                ${c.totals.missingCost > 0 ? `<br><b>${c.totals.missingCost} variante(s) con stock se cerraron sin costo registrado.</b>` : ''}
                <br>Fotografía de solo lectura: no cambia aunque el inventario se modifique después.</p>
            <div class="table-container"><table>
                <thead><tr><th style="width:15%;">Código</th><th style="width:27%;">Modelo</th><th style="width:16%;">Talla / Color</th><th style="width:12%;">Costo</th><th style="width:12%;">Stock</th><th style="width:18%;">Valor</th></tr></thead>
                <tbody>${rows.map(r => `<tr>
                    <td class="cell-mono">${escapeHtml(r.code)}</td>
                    <td>${escapeHtml(r.name)}<br><small style="color:var(--text-muted);">${escapeHtml(r.category)}</small></td>
                    <td>${escapeHtml(r.size)} · ${escapeHtml(r.color)}</td>
                    <td class="cell-mono">${r.cost === null ? '<span style="color:var(--text-subtle);">sin costo</span>' : fmtMoney(r.cost)}</td>
                    <td class="cell-mono">${r.stock}</td>
                    <td class="cell-mono"><b>${fmtMoney(r.costValue)}</b></td>
                </tr>`).join('')}</tbody>
            </table></div>`;
        openDialog({ title: `Cierre de inventario · ${c.date}`, body, wide: true, tone: 'primary', dismissValue: true, actions: [{ label: 'Cerrar', variant: 'primary', value: true }] });
    }

    // Elimina un cierre del historial (no afecta al inventario actual).
    async function deleteClosure(id) {
        const c = cierresDb.find(x => x.id === id);
        if (!c) return;
        const ok = await confirmDialog({
            title: 'Eliminar cierre', tone: 'danger', confirmText: 'Eliminar',
            message: `Se eliminará el cierre ${c.scope === 'GENERAL' ? 'general' : 'selectivo'} del ${c.date} (${fmtMoney(c.totals.costValue)} a costo).\nEsta acción no se puede deshacer y no modifica el inventario actual.`
        });
        if (!ok) return;
        cierresDb = cierresDb.filter(x => x.id !== id);
        localStorage.setItem('ropa_cierres_v11', JSON.stringify(cierresDb));
        renderClosureHistory();
        showToast('Cierre eliminado del historial.');
    }
