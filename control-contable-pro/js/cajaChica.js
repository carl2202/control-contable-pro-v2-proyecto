// ==========================================================================
// Módulo Caja Chica (F4)
// Fondo de caja chica: ingresos, gastos con concepto autorizado, saldo y alerta.
// ==========================================================================

    // Muestra el selector de concepto autorizado solo cuando el movimiento es un gasto (y lo vuelve obligatorio).
    // @param {string} val  'ingreso' | 'gasto'.
    function handleCajaChicaTypeChange(val) {
        const catGroup = document.getElementById('ccCategoryGroup');
        catGroup.style.display = (val === 'gasto') ? 'block' : 'none';
        document.getElementById('ccCategory').required = (val === 'gasto');
    }

    // Calcula el saldo actual del fondo: suma de ingresos menos suma de gastos.
    // @returns {number} Saldo disponible en dólares.
    function getCajaChicaBalance() {
        let totalIn = 0, totalOut = 0;
        cajaChicaDb.forEach(item => {
            if (item.type === 'ingreso') totalIn += item.amount;
            else totalOut += item.amount;
        });
        return totalIn - totalOut;
    }

    // Registra un ingreso (carga de fondo) o un gasto de caja chica; un gasto se rechaza si supera el saldo disponible.
    // @param {Event} e  Evento submit del formulario #cajaChicaForm.
    function handleCajaChicaSubmit(e) {
        e.preventDefault();
        const type = document.getElementById('ccType').value;
        const category = document.getElementById('ccCategory').value;
        const desc = document.getElementById('ccDesc').value.trim();
        const amount = parseFloat(document.getElementById('ccAmount').value);

        if (!(amount > 0)) { showToast('⚠️ Ingresa un monto mayor a 0.', true); return; }
        const currentBalance = getCajaChicaBalance();

        // Control de fondos: no se puede gastar más de lo que hay en caja chica (tolerancia de medio centavo por coma flotante).
        if (type === 'gasto' && amount - currentBalance > 0.005) {
            showToast(`⚠️ Fondos insuficientes en Caja Chica. Saldo actual: $${currentBalance.toFixed(2)}`, true);
            return;
        }

        cajaChicaDb.push({
            id: Date.now(),
            type,
            category: type === 'gasto' ? category : 'Inyección de Fondo',
            desc,
            amount,
            // Fecha ISO local del movimiento: los reportes por rango la necesitan para no sumar gastos de otras fechas.
            date: getTodayISO(),
            time: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
        });

        localStorage.setItem('ropa_cajachica_v11', JSON.stringify(cajaChicaDb));
        renderCajaChica();
        document.getElementById('cajaChicaForm').reset();
        handleCajaChicaTypeChange('ingreso');
        showToast(type === 'gasto' ? '📤 Gasto registrado de Caja Chica.' : '📥 Fondo de Caja Chica cargado con éxito.');
    }

    // Dibuja los movimientos del fondo (más recientes primero), los totales y la alerta de fondo bajo.
    function renderCajaChica() {
        const tbody = document.getElementById('cajaChicaTableBody');
        tbody.innerHTML = '';

        let totalIn = 0, totalOut = 0;
        if (cajaChicaDb.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">Sin movimientos en caja chica. Registre un fondo inicial.</td></tr>`;
        } else {
            cajaChicaDb.slice().reverse().forEach(item => {
                if (item.type === 'ingreso') totalIn += item.amount;
                else totalOut += item.amount;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${escapeHtml(item.time)}</td>
                    <td><span class="badge badge-${item.type === 'ingreso' ? 'ingreso' : 'egreso'}">${item.type.toUpperCase()}</span></td>
                    <td><b>[${escapeHtml(item.category)}]</b> ${escapeHtml(item.desc)}</td>
                    <td><b>$${item.amount.toFixed(2)}</b></td>
                    <td><button class="btn btn-danger" style="padding:2px 6px; font-size:0.7rem;" onclick="deleteCajaChicaItem(${item.id})">✕</button></td>
                `;
                tbody.appendChild(tr);
            });
        }

        const balance = totalIn - totalOut;
        document.getElementById('ccBalance').textContent = `$${balance.toFixed(2)}`;
        document.getElementById('ccTotalIn').textContent = `$${totalIn.toFixed(2)}`;
        document.getElementById('ccTotalOut').textContent = `$${totalOut.toFixed(2)}`;

        const alertLabel = document.getElementById('ccAlertLabel');
        const balanceVal = document.getElementById('ccBalance');
        
        // Alerta visual cuando el saldo es de $10.00 o menos.
        if (balance <= 10.00) {
            alertLabel.innerHTML = '⚠️ Fondo bajo ($10.00 o menos). Hay que reabastecer.';
            alertLabel.style.color = 'var(--danger)';
            balanceVal.style.color = 'var(--danger)';
        } else {
            alertLabel.innerHTML = 'Fondo en orden';
            alertLabel.style.color = 'var(--success)';
            balanceVal.style.color = 'var(--primary)';
        }
    }

    // Elimina un movimiento de caja chica por su id tras confirmar.
    // - No permite borrar un INGRESO si el saldo quedaría negativo (los gastos ya hechos dependen de él).
    // - Si el gasto nació en el módulo Contable, quita también ese registro para que ambos módulos sigan cuadrando.
    // @param {number} id  Identificador del movimiento.
    async function deleteCajaChicaItem(id) {
        const target = cajaChicaDb.find(i => i.id === id);
        if (!target) return;
        if (target.type === 'ingreso' && getCajaChicaBalance() - target.amount < -0.005) {
            showToast('⚠️ No se puede eliminar este ingreso: el saldo quedaría negativo. Elimina antes los gastos que dependen de él.', true);
            return;
        }
        const ok = await confirmDialog({
            title: 'Eliminar movimiento', tone: 'danger', confirmText: 'Eliminar',
            message: `Se eliminará el ${target.type} "${target.desc}" por $${target.amount.toFixed(2)}.` + (target.type === 'gasto' ? '\nSi se registró desde Contable, también se quitará de allí.' : '')
        });
        if (!ok) return;

        cajaChicaDb = cajaChicaDb.filter(i => i.id !== id);
        localStorage.setItem('ropa_cajachica_v11', JSON.stringify(cajaChicaDb));

        let touchedStore = false;
        Object.keys(storeDb).forEach(k => {
            const before = storeDb[k].length;
            storeDb[k] = storeDb[k].filter(r => !(r.type === 'cajachica' && r.ccId === id));
            if (storeDb[k].length !== before) touchedStore = true;
        });
        if (touchedStore) saveAndRefresh();

        renderCajaChica();
        showToast('Movimiento eliminado de Caja Chica.');
    }
