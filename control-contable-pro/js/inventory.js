// ==========================================================================
// Módulo Inventario (F2)
// Alta, edición y eliminación de modelos con variantes (talla/color/precio/stock),
// catálogo con filtros y alertas de bajo stock.
// ==========================================================================

    // Agrega al formulario de inventario una fila de variante (talla, color, precio, stock) con botón para quitarla.
    function addVariantRow(size = '', color = '', price = 15.00, stock = 5, cost = '') {
        const container = document.getElementById('variantsContainer');
        const div = document.createElement('div');
        div.className = 'variant-input-grid';
        div.innerHTML = `
            <input type="text" placeholder="Talla" aria-label="Talla" class="var-size" value="${escapeHtml(size)}" required>
            <input type="text" placeholder="Color" aria-label="Color" class="var-color" value="${escapeHtml(color)}" required>
            <input type="number" step="0.01" placeholder="Costo $" aria-label="Precio de costo" class="var-cost" min="0" value="${cost === null || cost === undefined ? '' : cost}" title="Precio de costo (lo que pagas por la prenda)" required>
            <input type="number" step="0.01" placeholder="Venta $" aria-label="Precio de venta" class="var-price" min="0" value="${Number(price)}" title="Precio de venta" required>
            <input type="number" placeholder="Stock" aria-label="Stock" class="var-stock" min="0" value="${stock}" required>
            <button type="button" class="btn btn-danger" style="padding:4px;" onclick="this.parentElement.remove()">✕</button>
        `;
        container.appendChild(div);
    }

    // Carga un modelo existente en el formulario para editarlo (el código se bloquea porque es la llave).
    // @param {string} code  Código del modelo.
    function editInventoryItem(code) {
        const item = inventoryDb.find(i => i.code === code);
        if(!item) return;

        switchModule('inventario');
        document.getElementById('invCode').value = item.code;
        document.getElementById('invCode').readOnly = true;
        document.getElementById('invName').value = item.name;
        document.getElementById('invAudience').value = item.audience || 'Hombre';
        document.getElementById('invCategory').value = item.category || 'Camisa';
        document.getElementById('invFormTitle').lastChild.textContent = `Editando modelo: ${item.code}`;

        const container = document.getElementById('variantsContainer');
        container.innerHTML = '';
        item.variants.forEach(v => {
            addVariantRow(v.size, v.color, v.price, v.stock, v.cost);   // v.cost puede faltar en modelos antiguos: el campo queda vacío y es obligatorio completarlo
        });
        showToast(`Modo edición activado para ${code}.`);
    }

    // Envío del formulario de inventario: crea el modelo o, si el código ya existe, lo reemplaza (edición).
    document.getElementById('inventoryForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const code = document.getElementById('invCode').value.trim().toUpperCase();
        const name = document.getElementById('invName').value.trim();
        const audience = document.getElementById('invAudience').value;
        const category = document.getElementById('invCategory').value;

        let variants = [];
        const sizes = document.querySelectorAll('.var-size');
        const colors = document.querySelectorAll('.var-color');
        const costs = document.querySelectorAll('.var-cost');
        const prices = document.querySelectorAll('.var-price');
        const stocks = document.querySelectorAll('.var-stock');

        // Lee cada fila de variante del formulario (los inputs comparten orden).
        for (let i = 0; i < sizes.length; i++) {
            variants.push({
                size: sizes[i].value.trim(),
                color: colors[i].value.trim(),
                cost: parseFloat(costs[i].value),   // precio de costo: base del valor del inventario en el cierre
                price: parseFloat(prices[i].value) || 0,
                stock: parseInt(stocks[i].value) || 0
            });
        }

        // Validaciones: al menos una variante, sin precios/stock negativos y sin talla+color repetidos
        // (la venta y la devolución de stock identifican cada variante por talla+color).
        if (variants.length === 0) { showToast('⚠️ Agrega al menos una talla.', true); return; }
        if (variants.some(v => !isFinite(v.cost))) { showToast('⚠️ Indica el precio de costo de cada talla.', true); return; }
        if (variants.some(v => v.cost < 0 || v.price < 0 || v.stock < 0)) { showToast('⚠️ Costo, precio y stock no pueden ser negativos.', true); return; }
        const variantKeys = variants.map(v => (v.size + '|' + v.color).toLowerCase());
        if (new Set(variantKeys).size !== variantKeys.length) { showToast('⚠️ Hay tallas/colores repetidos en el modelo.', true); return; }

        // Si estamos editando (código bloqueado) se reemplaza el modelo; si es uno nuevo, el código NO puede existir ya.
        // Antes, escribir un código existente sobrescribía en silencio todo el modelo (tallas, precios y stock).
        const isEditing = document.getElementById('invCode').readOnly;
        const idx = inventoryDb.findIndex(i => i.code === code);
        if (idx >= 0 && !isEditing) {
            showToast(`⚠️ El código ${code} ya existe. Usa el botón "Editar" del catálogo para modificarlo.`, true);
            return;
        }
        if (idx >= 0) {
            inventoryDb[idx] = { code, name, audience, category, variants };
        } else {
            inventoryDb.push({ code, name, audience, category, variants });
        }

        localStorage.setItem('ropa_inv_v11', JSON.stringify(inventoryDb));
        renderInventoryTable();
        updateModelSaleDropdown();
        this.reset();
        document.getElementById('invCatTypeFilter').value = '';
        filterInvTabs(audience);
        document.getElementById('invCode').readOnly = false;
        document.getElementById('invFormTitle').lastChild.textContent = 'Registrar o Editar en Inventario';
        document.getElementById('variantsContainer').innerHTML = '';
        addVariantRow();
        showToast('Inventario actualizado · ' + audience + ' / ' + category);
    });

    // Aplica el filtro de público (Hombre/Mujer/Niño/Niña/Unisex/Todos) al catálogo y marca el chip activo.
    // @param {string} aud  Público o 'ALL'.
    function filterInvTabs(aud) {
        activeInvAudienceFilter = aud;
        document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
        document.getElementById(`chip-${aud}`).classList.add('active');
        renderInventoryTable();
    }

    // Dibuja el catálogo de bodega con contadores por público, filtros de público y tipo, tallas y alertas de stock.
    function renderInventoryTable() {
        const tbody = document.getElementById('inventoryTableBody');
        tbody.innerHTML = '';
        document.querySelectorAll('.cat-chip .cnt').forEach(e => { const a = e.dataset.aud; e.textContent = inventoryDb.filter(i => a === 'ALL' || i.audience === a).length; });
        const catFilter = document.getElementById('invCatTypeFilter').value;

        // Aplica ambos filtros: público (chips) y tipo de prenda (selector).
        let filteredItems = inventoryDb.filter(i => {
            const matchesAudience = (activeInvAudienceFilter === 'ALL' || i.audience === activeInvAudienceFilter);
            const matchesCategory = (!catFilter || i.category === catFilter);
            return matchesAudience && matchesCategory;
        });

        if (filteredItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Sin modelos registrados en esta categoría.</td></tr>`;
            return;
        }

        filteredItems.forEach(item => {
            let vHtml = '<ul style="margin:0; padding-left:12px; font-size:0.78rem;">';
            item.variants.forEach(v => {
                // Alerta: agotado (0), bajo stock (1 a 3) o normal; la barra .stk representa el nivel (10 % por unidad).
                const isLow = v.stock > 0 && v.stock <= 3;
                const stockBadge = v.stock <= 0 ? '<span style="color:red; font-weight:bold;">Agotado</span>' : (isLow ? `<span class="badge badge-bajo-stock">Bajo stock (${v.stock})!</span>` : `<span style="color:green">${v.stock} un.</span>`);
                vHtml += `<li>Talla <b>${escapeHtml(v.size)}</b> (${escapeHtml(v.color)}) — <b>$${v.price.toFixed(2)}</b> <small style=\"color:var(--text-muted);\">(costo ${typeof v.cost === 'number' ? '$' + v.cost.toFixed(2) : 'sin definir'})</small> — Stock: ${stockBadge} <span class="stk ${v.stock<=0?'z':(isLow?'l':'')}"><i style="width:${Math.min(100,v.stock*10)}%"></i></span></li>`;
            });
            vHtml += '</ul>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge badge-stock">${escapeHtml(item.code)}</span></td>
                <td>
                    <b>${escapeHtml(item.name)}</b><br>
                    <span class="badge badge-cat">${escapeHtml(item.audience || 'General')}</span>
                    <span class="badge badge-cat">${escapeHtml(item.category || 'Ropa')}</span>
                </td>
                <td>${vHtml}</td>
                <td>
                    <button class="btn btn-light" style="padding:2px 6px; font-size:0.75rem;" data-code="${escapeHtml(item.code)}" onclick="editInventoryItem(this.dataset.code)">Editar</button>
                    <button class="btn btn-danger" style="padding:2px 6px; font-size:0.75rem;" data-code="${escapeHtml(item.code)}" onclick="deleteInventoryItem(this.dataset.code)">✕</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Elimina un modelo del inventario tras confirmar.
    // @param {string} code  Código del modelo.
    async function deleteInventoryItem(code) {
        const ok = await confirmDialog({
            title: 'Eliminar modelo', tone: 'danger', confirmText: 'Eliminar',
            message: `Se eliminará completamente el modelo ${code} con todas sus tallas y su stock.\nLos cierres de inventario ya guardados no se ven afectados.`
        });
        if (!ok) return;
        inventoryDb = inventoryDb.filter(i => i.code !== code);
        localStorage.setItem('ropa_inv_v11', JSON.stringify(inventoryDb));
        renderInventoryTable();
        updateModelSaleDropdown();
        showToast('Modelo eliminado del inventario.');
    }
