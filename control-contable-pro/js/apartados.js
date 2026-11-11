// ==========================================================================
// Módulo Apartados (F3)
// Apartados de clientes con abono inicial, saldo pendiente y estado.
// ==========================================================================

    // Rellena el selector de modelos del formulario de apartados con todo el inventario.
    function updateApartadoModelDropdown() {
        const select = document.getElementById('apartadoModelSelect');
        select.innerHTML = '<option value="">-- Elige modelo --</option>';
        inventoryDb.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.code;
            opt.textContent = `[${item.code}] ${item.name} (${item.audience || 'Gral'})`;
            select.appendChild(opt);
        });
    }

    // Rellena el selector de talla/color con las variantes del modelo elegido (el valor es el índice de la variante).
    // @param {string} code  Código del modelo.
    function loadApartadoVariants(code) {
        const select = document.getElementById('apartadoVariantSelect');
        select.innerHTML = '<option value="">-- Elige variante --</option>';
        if (!code) return;
        const item = inventoryDb.find(i => i.code === code);
        if (item && item.variants) {
            item.variants.forEach((v, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = `Talla ${v.size} (${v.color}) - $${v.price.toFixed(2)}`;
                select.appendChild(opt);
            });
        }
    }

    // Al elegir una variante propone el total (precio) y un abono inicial del 50 %.
    function autofillApartadoPrice() {
        const code = document.getElementById('apartadoModelSelect').value;
        const varIdx = document.getElementById('apartadoVariantSelect').value;
        if (!code || varIdx === '') return;
        const item = inventoryDb.find(i => i.code === code);
        if (item && item.variants[varIdx]) {
            const p = item.variants[varIdx].price;
            document.getElementById('apartadoTotal').value = p.toFixed(2);
            document.getElementById('apartadoAbono').value = (p / 2).toFixed(2);
        }
    }

    // Envío del formulario de apartados: guarda el apartado con su estado (PAGADO si el abono cubre el total; si no, PENDIENTE).
    document.getElementById('apartadoForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const clientName = document.getElementById('clientName').value.trim();
        const code = document.getElementById('apartadoModelSelect').value;
        const varIdx = document.getElementById('apartadoVariantSelect').value;
        const total = parseFloat(document.getElementById('apartadoTotal').value);
        const abono = parseFloat(document.getElementById('apartadoAbono').value);

        const item = inventoryDb.find(i => i.code === code);
        const v = item && item.variants[varIdx];
        if (!item || !v) { showToast('⚠️ Selecciona un modelo y una variante válidos.', true); return; }
        // Validaciones de montos: el abono no puede superar el total (antes generaba saldos negativos).
        if (!(total > 0)) { showToast('⚠️ El total debe ser mayor a 0.', true); return; }
        if (!(abono >= 0)) { showToast('⚠️ El abono no puede ser negativo.', true); return; }
        if (abono - total > 0.005) { showToast('⚠️ El abono no puede ser mayor al total.', true); return; }

        apartadosDb.push({
            id: Date.now(),
            clientName,
            prendaDesc: `[${item.code}] ${item.name} (${item.audience || ''}) (Talla ${v.size} a $${v.price.toFixed(2)})`,
            total,
            abono,
            // Estado calculado a partir del abono (con tolerancia de medio centavo).
            status: (abono - total >= -0.005) ? 'PAGADO' : 'PENDIENTE'
        });

        localStorage.setItem('ropa_apartados_v11', JSON.stringify(apartadosDb));
        renderApartadosTable();
        this.reset();
        loadApartadoVariants('');   // reset() no limpia las opciones de variante del modelo anterior
        showToast('🤝 Apartado y cliente guardados.');
    });

    // Dibuja la tabla de apartados con cliente, prenda, saldo pendiente (total - abono), estado y botón para eliminar.
    function renderApartadosTable() {
        const tbody = document.getElementById('apartadosTableBody');
        tbody.innerHTML = '';
        if (apartadosDb.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Sin apartados ni clientes.</td></tr>`;
            return;
        }
        apartadosDb.forEach(ap => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b>${escapeHtml(ap.clientName)}</b></td>
                <td>${escapeHtml(ap.prendaDesc)}</td>
                <td>$${Math.max(0, ap.total - ap.abono).toFixed(2)}</td>
                <td><span class="badge badge-${ap.status === 'PAGADO' ? 'pagado' : 'deuda'}">${ap.status}</span></td>
                <td><button class="btn btn-danger" style="padding:2px 6px; font-size:0.7rem;" onclick="deleteApartado(${Number(ap.id)})">✕</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Elimina un apartado tras confirmar en un diálogo.
    // @param {number} id  Identificador del apartado.
    async function deleteApartado(id) {
        const ap = apartadosDb.find(x => x.id === id);
        if (!ap) return;
        const ok = await confirmDialog({ title: 'Eliminar apartado', tone: 'danger', confirmText: 'Eliminar', message: `Se eliminará el apartado de ${ap.clientName}.` });
        if (!ok) return;
        apartadosDb = apartadosDb.filter(a => a.id !== id);
        localStorage.setItem('ropa_apartados_v11', JSON.stringify(apartadosDb));
        renderApartadosTable();
        showToast('Cliente/Apartado eliminado.');
    }
