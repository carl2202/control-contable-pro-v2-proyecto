// ==========================================================================
// Módulo Contable (F1)
// Registro de ventas, compras, caja chica y servicios por fecha; pestañas, historial,
// métricas y gráfico de balance de 7 días.
// ==========================================================================

    // Activa (y crea si no existe) la pestaña de la fecha elegida en el selector de fecha.
    function addNewDateFromPicker() {
        const selected = document.getElementById('newDatePicker').value;
        if (!selected) { showToast('⚠️ Selecciona una fecha.', true); return; }
        activeTab = selected;
        if (!storeDb[activeTab]) storeDb[activeTab] = [];
        saveAndRefresh();
        showToast(`📅 Fecha activa: ${activeTab}`);
    }

    // Adapta el formulario de movimientos al tipo elegido.
    // - venta: muestra selector de modelo y tallas; el monto es de solo lectura (se calcula).
    // - cajachica: muestra el concepto autorizado de caja chica.
    // - compra / luz / agua / internet: muestra descripción y monto manual.
    // @param {string} val  Tipo de operación.
    function handleTypeChange(val) {
        syncOpTiles(val);
        // Banderas según el tipo de operación elegido.
        const isVenta = (val === 'venta');
        const isCajaChica = (val === 'cajachica');
        const isServicio = ['luz', 'agua', 'internet'].includes(val);

        // Muestra u oculta cada grupo del formulario según el tipo.
        document.getElementById('groupModelSale').style.display = isVenta ? 'block' : 'none';
        document.getElementById('saleVariantPickerContainer').style.display = isVenta ? 'block' : 'none';
        document.getElementById('groupCajaChicaSale').style.display = isCajaChica ? 'block' : 'none';
        document.getElementById('groupNormalInputs').style.display = isVenta ? 'none' : 'block';
        
        // La descripción solo es obligatoria si no es venta ni caja chica; el monto de una venta no se edita a mano.
        document.getElementById('desc').required = (!isVenta && !isCajaChica);
        document.getElementById('amount').readOnly = isVenta;
        if (!isVenta) document.getElementById('amount').value = '';

        // Comprobante por defecto: caja chica 'Sin Comprobante'; venta y servicios 'Factura'.
        const docSelect = document.getElementById('doc');
        if (isCajaChica) {
            docSelect.value = 'Sin Comprobante';
        } else if (isServicio) {
            docSelect.value = 'Factura';
        } else if (isVenta) {
            docSelect.value = 'Factura';
        }
    }

    // Rellena el selector de modelos de venta aplicando los filtros de público y de tipo de prenda.
    function filterModels() {
        const select = document.getElementById('modelCodeSelect');
        select.innerHTML = '<option value="">-- Elige un modelo --</option>';
        const audFilter = document.getElementById('filterSaleAudience').value;
        const catFilter = document.getElementById('filterSaleCategory').value;

        inventoryDb.filter(i => {
            const matchesAudience = !audFilter || i.audience === audFilter;
            const matchesCategory = !catFilter || i.category === catFilter;
            return matchesAudience && matchesCategory;
        }).forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.code;
            opt.textContent = `[${item.code}] ${item.name} (${item.audience || 'Gral'} ${item.category || 'Ropa'})`; // textContent: ya es seguro
            select.appendChild(opt);
        });
    }

    // Atajo que refresca el selector de modelos de venta (llama a filterModels).
    function updateModelSaleDropdown() {
        filterModels();
    }

    // Dibuja una tarjeta por talla/color del modelo elegido, con precio, aviso de stock (agotado / poco) y campo de cantidad.
    // @param {string} code  Código del modelo (vacío = limpiar).
    function renderSaleVariantPicker(code) {
        const container = document.getElementById('saleVariantsList');
        container.innerHTML = '';
        document.getElementById('amount').value = '';

        if (!code) return;

        const item = inventoryDb.find(i => i.code === code);
        if (!item || !item.variants || item.variants.length === 0) {
            container.innerHTML = '<div style="font-size:0.8rem; color:var(--danger);">Sin tallas registradas.</div>';
            return;
        }

        item.variants.forEach((v, idx) => {
            const isOut = v.stock <= 0;
            // Regla de 'poco stock': entre 1 y 3 unidades. Con 0 se considera agotado y el campo se deshabilita.
            const isLow = v.stock > 0 && v.stock <= 3;
            const card = document.createElement('div');
            card.className = `variant-card-sale ${isOut ? 'out-stock' : ''}`;
            card.innerHTML = `
                <div>
                    <b>Talla: ${escapeHtml(v.size)}</b> (${escapeHtml(v.color)})<br>
                    <small style="color:${isOut ? 'red' : (isLow ? '#9A7330' : 'gray')}">
                        ${isOut ? '🔴 Agotado' : (isLow ? `⚠️ ¡Poco stock (${v.stock})!` : 'Stock: ' + v.stock)}
                    </small>
                </div>
                <div style="font-weight:700; color:var(--primary); font-size:0.9rem;">
                    $${v.price.toFixed(2)} c/u
                </div>
                <div>
                    <input type="number" class="sale-qty-input" data-idx="${idx}" data-price="${v.price}" data-stock="${v.stock}" min="0" max="${v.stock}" value="0" style="padding:4px; font-weight:700; text-align:center;" ${isOut ? 'disabled' : ''} oninput="calculateSaleTotal()">
                </div>
            `;
            container.appendChild(card);
        });
    }

    // Suma cantidad x precio de todas las tallas, normaliza cada cantidad (entre 0 y el stock disponible) y escribe el total en #amount.
    // Antes una cantidad negativa RESTABA del total; ahora se fuerza a 0. El total se calcula en centavos para evitar errores de coma flotante.
    function calculateSaleTotal() {
        let totalCents = 0;
        document.querySelectorAll('.sale-qty-input').forEach(input => {
            const price = parseFloat(input.getAttribute('data-price')) || 0;
            const max = Math.max(0, parseInt(input.getAttribute('data-stock')) || 0);
            let qty = parseInt(input.value);
            if (isNaN(qty) || qty < 0) qty = 0;
            if (qty > max) { qty = max; showToast('Stock máximo alcanzado', true); }
            if (input.value !== '' && String(qty) !== input.value) input.value = qty;
            totalCents += Math.round(price * 100) * qty;
        });
        document.getElementById('amount').value = totalCents > 0 ? (totalCents / 100).toFixed(2) : '';
    }

    // Envío del formulario principal (venta / compra / caja chica / servicios):
    // valida TODO antes de modificar datos, descuenta stock si es venta, calcula el IVA y guarda el movimiento en la fecha activa.
    document.getElementById('recordForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const form = this;
        const type = document.getElementById('type').value;
        let amount = parseFloat(document.getElementById('amount').value);
        const doc = document.getElementById('doc').value;
        // Si se está viendo "Todo Acumulado" no existe una fecha real: el movimiento se guarda en HOY.
        // (Antes se creaba una fecha falsa 'TODOS' en storeDb: pestaña duplicada y movimientos fuera de reportes/CSV.)
        const targetDate = (activeTab === 'TODOS') ? todayStr : activeTab;
        const recordId = Date.now();
        let desc = '';
        let items = null;   // detalle estructurado de la venta (permite devolver el stock al eliminarla)
        let ccId = null;    // id del movimiento espejo en caja chica (permite eliminarlo junto con el registro)

        // Compras, servicios y caja chica necesitan un monto válido (el campo de ventas es de solo lectura y no se valida en el navegador).
        if (type !== 'venta' && !(amount > 0)) { showToast('⚠️ Ingresa un monto mayor a 0.', true); return; }

        if (type === 'venta') {
            const code = document.getElementById('modelCodeSelect').value;
            if (!code) { showToast('⚠️ Selecciona modelo', true); return; }
            const item = inventoryDb.find(i => i.code === code);
            if (!item) { showToast('⚠️ El modelo ya no existe en el inventario.', true); return; }

            // Paso 1: validar y calcular SIN tocar el inventario.
            const picked = [];
            let totalCents = 0, overStock = false;
            document.querySelectorAll('.sale-qty-input').forEach(input => {
                const qty = parseInt(input.value) || 0;
                if (qty <= 0) return;
                const v = item.variants[parseInt(input.getAttribute('data-idx'))];
                if (!v || qty > v.stock) { overStock = true; return; }
                picked.push({ v, qty });
                totalCents += Math.round(v.price * 100) * qty;
            });
            if (overStock) { showToast('⚠️ Hay cantidades mayores al stock disponible.', true); return; }
            if (picked.length === 0) { showToast('⚠️ Ingresa al menos 1 unidad', true); return; }

            // Integración con el calendario: vender en un día marcado como asueto/feriado requiere confirmación
            // (el día pasará a "laborado"). Se pregunta ANTES de tocar el inventario.
            const dayInfo = getDayInfo(targetDate);
            if (dayInfo.status === 'asueto') {
                const ok = await confirmDialog({
                    title: 'Venta en día de asueto', tone: 'warning', confirmText: 'Registrar venta',
                    message: `El ${targetDate} está marcado como Asueto / Feriado${dayInfo.note ? ' (' + dayInfo.note + ')' : ''}.\nSi registras la venta, la jornada pasará a "Laborado".\n\n¿Deseas continuar?`
                });
                if (!ok) return;
            }

            // Paso 2: aplicar el descuento de inventario y armar descripción/detalle.
            const soldInfo = [];
            items = [];
            picked.forEach(({ v, qty }) => {
                v.stock -= qty;
                soldInfo.push(`${qty}x Talla ${v.size} ($${v.price.toFixed(2)} c/u)`);
                items.push({ code: item.code, size: v.size, color: v.color, qty });
            });
            // El monto se recalcula aquí (no se confía en el valor del campo de solo lectura).
            amount = totalCents / 100;
            localStorage.setItem('ropa_inv_v11', JSON.stringify(inventoryDb));
            desc = `[${item.code}] ${item.name} (${item.audience || ''}) -> ${soldInfo.join(', ')}`;
        } else if (type === 'cajachica') {
            // PAGO DESDE CAJA CHICA: verifica saldo suficiente y registra también el gasto en cajaChicaDb.
            const cat = document.getElementById('saleCcCategory').value;
            const customDesc = document.getElementById('desc').value.trim();
            desc = `[Caja Chica - ${cat}] ${customDesc || 'Gasto menor'}`;

            const currentBalance = getCajaChicaBalance();
            // Tolerancia de medio centavo para evitar falsos rechazos por coma flotante.
            if (amount - currentBalance > 0.005) {
                showToast(`⚠️ Saldo insuficiente en Caja Chica ($${currentBalance.toFixed(2)} disponible).`, true);
                return;
            }

            ccId = recordId;
            cajaChicaDb.push({
                id: ccId,
                type: 'gasto',
                category: cat,
                desc: customDesc || 'Gasto registrado desde POS',
                amount,
                date: targetDate,
                time: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
            });
            localStorage.setItem('ropa_cajachica_v11', JSON.stringify(cajaChicaDb));
        } else {
            // COMPRA / LUZ / AGUA / INTERNET: usa la descripción escrita por el usuario con un prefijo según el tipo.
            const userDesc = document.getElementById('desc').value.trim();
            if (type === 'luz') desc = `💡 [Pago de Luz] ${userDesc}`;
            else if (type === 'agua') desc = `🚰 [Pago de Agua] ${userDesc}`;
            else if (type === 'internet') desc = `📶 [Pago de Internet/Tel] ${userDesc}`;
            else desc = userDesc;
        }

        // IVA incluido en el precio (13 %): impuesto = monto / 1.13 * 0.13, redondeado a centavos.
        // Se calcula para TODOS los movimientos, también los gastos "Sin Comprobante" (generan crédito de IVA, como siempre).
        amount = Math.round(amount * 100) / 100;
        const tax = Math.round(amount / 1.13 * 0.13 * 100) / 100;
        if (!storeDb[targetDate]) storeDb[targetDate] = [];
        const record = { id: recordId, type, desc, amount, tax, doc, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) };
        if (items) record.items = items;
        if (ccId) record.ccId = ccId;
        storeDb[targetDate].push(record);

        // Si la fecha estaba marcada "sin ventas" o "asueto" y ahora tiene una venta, pasa a "laborado".
        const dayChanged = (type === 'venta') ? markDayWorkedOnSale(targetDate) : false;

        saveAndRefresh();
        form.reset();
        // Tras reset() hay que re-sincronizar lo que el navegador no restablece solo:
        // fichas de filtro, lista de modelos (según filtros ya limpios) y las tarjetas de tallas (mostraban stock viejo).
        handleTypeChange('venta');
        syncCatTiles();
        filterModels();
        renderSaleVariantPicker('');
        showToast('✅ Operación guardada con éxito.');
        if (dayChanged) { refreshCalendarViews(); showToast(`La jornada del ${targetDate} pasó a "Laborado" por registrar una venta.`, false, 'info'); }
    });

    // Elimina un registro de la fecha activa tras confirmar.
    // - Venta: devuelve las unidades al stock (solo si el registro guarda su detalle; los antiguos no lo tienen).
    // - Caja chica: elimina también el gasto espejo del fondo, para que el saldo vuelva a cuadrar.
    // @param {number} id  Identificador del registro.
    async function deleteRecord(id) {
        if (activeTab === 'TODOS') return;
        const tab = activeTab;
        const rec = (storeDb[tab] || []).find(x => x.id === id);
        if (!rec) return;

        let aviso = '¿Eliminar este registro?';
        if (rec.type === 'venta') aviso += Array.isArray(rec.items) ? ' Las unidades volverán al inventario.' : ' (Es un registro antiguo: el stock NO se restaurará.)';
        if (rec.type === 'cajachica' && rec.ccId) aviso += ' El gasto también se quitará de Caja Chica.';
        const ok = await confirmDialog({ title: 'Eliminar registro', message: aviso, confirmText: 'Eliminar', tone: 'danger' });
        if (!ok) return;
        const list = storeDb[tab] || [];

        if (rec.type === 'venta' && Array.isArray(rec.items)) {
            rec.items.forEach(it => {
                const model = inventoryDb.find(m => m.code === it.code);
                const variant = model && model.variants.find(v => v.size === it.size && v.color === it.color);
                if (variant) variant.stock += it.qty;
            });
            localStorage.setItem('ropa_inv_v11', JSON.stringify(inventoryDb));
            updateModelSaleDropdown();
        }
        if (rec.type === 'cajachica' && rec.ccId) {
            cajaChicaDb = cajaChicaDb.filter(c => c.id !== rec.ccId);
            localStorage.setItem('ropa_cajachica_v11', JSON.stringify(cajaChicaDb));
        }
        storeDb[tab] = list.filter(x => x.id !== id);
        saveAndRefresh();
        showToast('Registro eliminado.');
    }

    // Guarda storeDb en localStorage y vuelve a dibujar las pestañas y el panel principal del módulo Contable.
    function saveAndRefresh() {
        localStorage.setItem('ropa_store_v11', JSON.stringify(storeDb));
        renderTabs();
        renderMain();
    }

    // Dibuja la barra de pestañas: 'Todo Acumulado' + una pestaña por fecha (la más reciente primero). Muestra u oculta el botón de borrar fecha.
    function renderTabs() {
        const bar = document.getElementById('tabsBar');
        bar.innerHTML = '';
        
        const allBtn = document.createElement('div');
        allBtn.className = `tab ${activeTab === 'TODOS' ? 'active' : ''}`;
        allBtn.textContent = 'Todo Acumulado';
        allBtn.onclick = () => switchTab('TODOS');
        bar.appendChild(allBtn);

        Object.keys(storeDb).sort().reverse().forEach(dateKey => {
            const tab = document.createElement('div');
            tab.className = `tab ${activeTab === dateKey ? 'active' : ''}`;
            tab.textContent = dateKey === todayStr ? `Hoy (${dateKey})` : dateKey;
            tab.onclick = () => switchTab(dateKey);
            bar.appendChild(tab);
        });

        document.getElementById('delTabBtn').style.display = (activeTab === 'TODOS') ? 'none' : 'inline-block';
    }

    // Cambia la pestaña activa (fecha o 'TODOS') y actualiza el selector de fecha.
    // @param {string} key  Fecha 'AAAA-MM-DD' o 'TODOS'.
    function switchTab(key) {
        activeTab = key;
        document.getElementById('newDatePicker').value = activeTab === 'TODOS' ? todayStr : activeTab;
        saveAndRefresh();
    }

    // Elimina la fecha activa con todos sus movimientos (el inventario no se modifica) tras confirmar con el usuario.
    async function deleteCurrentTab() {
        if (activeTab === 'TODOS') return;
        const tab = activeTab;
        const ok = await confirmDialog({
            title: 'Eliminar fecha', tone: 'danger', confirmText: 'Eliminar fecha',
            message: `Se eliminarán todos los movimientos del ${tab}.\nEl inventario, la caja chica y el estado del calendario no se modifican.`
        });
        if (!ok) return;
        delete storeDb[tab];
        const keys = Object.keys(storeDb).sort().reverse();
        activeTab = keys.length > 0 ? keys[0] : todayStr;
        if (!storeDb[activeTab]) storeDb[activeTab] = [];
        saveAndRefresh();
        showToast('Fecha eliminada.');
    }

    // Dibuja la tabla de movimientos de la pestaña activa (con búsqueda) y actualiza las 4 métricas, el gráfico y la jornada del día.
    // Las métricas (ventas, gastos, IVA y ganancia) se calculan sobre los movimientos FILTRADOS por el buscador.
    function renderMain() {
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';

        // Más recientes primero. En "Todo Acumulado" se ordena por fecha real (antes salía en orden de inserción).
        let records = [];
        if (activeTab === 'TODOS') {
            Object.keys(storeDb).sort().reverse().forEach(k => {
                (storeDb[k] || []).slice().reverse().forEach(r => records.push({ ...r, _date: k }));
            });
        } else {
            records = (storeDb[activeTab] || []).slice().reverse().map(r => ({ ...r, _date: activeTab }));
        }

        // Filtro de búsqueda por descripción, tipo o comprobante.
        const searchQuery = document.getElementById('searchHistoryInput').value.toLowerCase().trim();
        const visible = !searchQuery ? records : records.filter(r =>
            String(r.desc || '').toLowerCase().includes(searchQuery) ||
            String(r.type || '').toLowerCase().includes(searchQuery) ||
            String(r.doc || '').toLowerCase().includes(searchQuery));

        // Métricas sobre los registros visibles (con el buscador vacío son las del periodo completo).
        let sales = 0, expenses = 0, sTax = 0, eTax = 0;
        visible.forEach(r => {
            // Ventas suman a ingresos; cualquier otro tipo suma a gastos. El IVA se acumula por separado.
            if (r.type === 'venta') { sales += r.amount; sTax += (r.tax || 0); }
            else { expenses += r.amount; eTax += (r.tax || 0); }
        });

        visible.forEach(r => {
            let badgeClass = 'badge-' + r.type;
            if (['luz', 'agua', 'internet'].includes(r.type)) badgeClass = 'badge-servicio';
            if (r.type === 'cajachica') badgeClass = 'badge-cajachica';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${activeTab === 'TODOS' ? escapeHtml(r._date) + ' ' : ''}${escapeHtml(r.time || '')}</td>
                <td><span class="badge ${badgeClass}">${escapeHtml(String(r.type).toUpperCase())}</span></td>
                <td>${escapeHtml(r.desc)} <br><small style="color:var(--text-muted);">Doc: ${escapeHtml(r.doc)}</small></td>
                <td><b>$${r.amount.toFixed(2)}</b></td>
                <td><span style="color:var(--warning); font-weight:600;">$${(r.tax || 0).toFixed(2)}</span></td>
                <td>${activeTab !== 'TODOS' ? `<button class="btn btn-danger" style="padding:2px 5px; font-size:0.7rem;" onclick="deleteRecord(${Number(r.id)})">✕</button>` : ''}</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('lblSales').textContent = `$${sales.toFixed(2)}`;
        document.getElementById('lblExpenses').textContent = `$${expenses.toFixed(2)}`;
        // IVA neto = IVA de ventas (débito) - IVA de gastos (crédito). Ahora conserva el signo:
        // antes se usaba Math.abs() y un crédito mayor al débito se mostraba como si fuera IVA por pagar.
        const netTax = Math.round((sTax - eTax) * 100) / 100;
        const lblTax = document.getElementById('lblTax');
        lblTax.textContent = `${netTax < 0 ? '−' : ''}$${Math.abs(netTax).toFixed(2)}`;
        lblTax.title = netTax < 0 ? 'IVA a favor (el crédito fiscal supera al débito)' : 'IVA por pagar';
        document.getElementById('lblProfit').textContent = `$${(sales - expenses).toFixed(2)}`;
        renderChart();
        renderDayStatusBadge();
    }

    // Dibuja con SVG el balance de los últimos 7 días con movimientos: barras de ventas y gastos y el neto por día.
    // Si no hay movimientos muestra un estado vacío.
    function renderChart() {
        const box = document.getElementById('chartVG'); if (!box) return;
        // Toma las últimas 7 fechas y calcula ventas (v), gastos (g) y neto (n) de cada una.
        const keys = Object.keys(storeDb).filter(k => (storeDb[k] || []).length > 0).sort().slice(-7);
        const data = keys.map(k => { let v=0,g=0; (storeDb[k]||[]).forEach(r => r.type==='venta' ? v+=r.amount : g+=r.amount); return {k,v,g,n:v-g}; });
        const max = Math.max(0, ...data.map(d => Math.max(d.v,d.g)));
        if (!keys.length || max === 0) { box.innerHTML = '<div class="chart-empty"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="6" width="28" height="36" rx="3"/><path d="M16 15h16M16 22h16M16 29h9"/><path d="M30 34l3 3 5-6" stroke="#4F6F52" stroke-width="1.6"/></svg><b>Sin movimientos todavía</b><span>Registra una venta o un gasto y aquí verás el balance de los últimos 7 días.</span></div>'; return; }
        const m = n => '$' + (Math.abs(n) >= 100 ? Math.round(Math.abs(n)).toLocaleString('en-US') : Math.abs(n).toFixed(2));
        // Dimensiones del lienzo SVG y escala de las barras (s) en función del valor máximo.
        const W=720, X0=84, BW=400, T=30, RH=38, H=T+data.length*RH+6, s=BW/max;
        let o='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Balance diario" font-family="IBM Plex Sans, sans-serif">';
        o+='<text x="0" y="14" font-size="9.5" letter-spacing="1.2" fill="#6F7B72">FECHA</text><text x="'+X0+'" y="14" font-size="9.5" letter-spacing="1.2" fill="#6F7B72">VENTAS / GASTOS</text><text x="'+(W-2)+'" y="14" text-anchor="end" font-size="9.5" letter-spacing="1.2" fill="#6F7B72">NETO</text><line x1="0" x2="'+W+'" y1="22" y2="22" stroke="#2F3A33" stroke-width="1.2"/>';
        data.forEach((d,i) => { const y=T+i*RH, vw=Math.max(d.v*s,d.v>0?2:0), gw=Math.max(d.g*s,d.g>0?2:0);
            o+='<line x1="0" x2="'+W+'" y1="'+(y+RH)+'" y2="'+(y+RH)+'" stroke="#D7DDCF"/>';
            o+='<text x="0" y="'+(y+23)+'" font-size="11.5" fill="#46524A">'+d.k.slice(5).replace('-','/')+'</text>';
            o+='<rect x="'+X0+'" y="'+(y+6)+'" width="'+vw+'" height="10" fill="#4F6F52"><title>Ventas '+d.k+': $'+d.v.toFixed(2)+'</title></rect><text x="'+(X0+vw+7)+'" y="'+(y+15)+'" font-size="10" fill="#4F6F52">'+m(d.v)+'</text>';
            o+='<rect x="'+X0+'" y="'+(y+21)+'" width="'+gw+'" height="10" fill="#B2603F"><title>Gastos '+d.k+': $'+d.g.toFixed(2)+'</title></rect><text x="'+(X0+gw+7)+'" y="'+(y+30)+'" font-size="10" fill="#B2603F">'+m(d.g)+'</text>';
            o+='<text x="'+(W-2)+'" y="'+(y+23)+'" text-anchor="end" font-size="12.5" font-weight="600" fill="'+(d.n>=0?'#4F6F52':'#B2603F')+'">'+(d.n>=0?'+':'−')+m(d.n)+'</text>'; });
        o+='<line x1="'+X0+'" x2="'+X0+'" y1="22" y2="'+(H-6)+'" stroke="#2F3A33" stroke-width="1.2"/>';
        box.innerHTML=o+'</svg>';
    }
