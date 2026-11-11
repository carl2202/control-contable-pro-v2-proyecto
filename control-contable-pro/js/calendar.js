// ==========================================================================
// Módulo F7: Calendario de operaciones y jornadas diarias
// Calendario mensual para registrar el estado operativo de cada fecha:
//   • laborado   -> día laborado.
//   • sinventas  -> local abierto/disponible pero sin transacciones de venta.
//   • asueto     -> día de asueto / feriado.
// Cada fecha especial puede llevar una nota o motivo. El estado se integra con el resto del sistema:
//   - Contable: muestra la jornada de la fecha activa y, al vender en un día sin ventas/asueto, lo pasa a "laborado".
//   - Reportes: totaliza días laborados / sin ventas / asueto del periodo y calcula el promedio de ventas por día laborado.
//   - Respaldo CSV: incluye el calendario.
// Un día sin estado explícito pero con ventas registradas se considera "laborado" automáticamente.
// ==========================================================================

    const CAL_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const CAL_WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const CAL_DOW_HEAD = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    // Estados disponibles: etiqueta corta (tarjetas/insignias) y nombre largo (editor).
    const CAL_STATUS = {
        laborado:  { label: 'Laborado',   long: 'Día laborado' },
        sinventas: { label: 'Sin ventas', long: 'Día sin ventas' },
        asueto:    { label: 'Asueto',     long: 'Asueto / Feriado' }
    };
    // Motivos sugeridos (fichas) para rellenar la nota con un clic.
    const CAL_NOTE_SUGGESTIONS = {
        laborado:  ['Jornada normal', 'Horario extendido'],
        sinventas: ['Cierre por mantenimiento', 'Sin afluencia de clientes', 'Cierre por inventario'],
        asueto:    ['Asueto nacional', 'Feriado local', 'Descanso del personal']
    };
    const CAL_NOTE_MAX = 140;

    // Mes visible en el calendario (inicia en el mes actual).
    let calViewYear = new Date().getFullYear();
    let calViewMonth = new Date().getMonth();

    // Convierte 'AAAA-MM-DD' en Date local (a las 00:00).
    function parseISODate(key) {
        const [y, m, d] = key.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    // 'AAAA-MM-DD' -> 'lunes, 2 de noviembre de 2026'.
    function formatLongDate(key) {
        const d = parseISODate(key);
        return `${CAL_WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${CAL_MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
    }

    // Guarda el calendario en localStorage.
    function saveCalendar() {
        localStorage.setItem('ropa_calendario_v11', JSON.stringify(calendarDb));
    }

    // Devuelve la información de jornada de una fecha.
    // @returns {{status:(string|null), note:string, explicit:boolean, salesCount:number, salesTotal:number, recordCount:number}}
    //   status null = sin definir. Si no hay estado explícito pero existen ventas, status = 'laborado' (explicit:false).
    function getDayInfo(key) {
        const records = storeDb[key] || [];
        const sales = records.filter(r => r.type === 'venta');
        const salesTotal = sales.reduce((acc, r) => acc + r.amount, 0);
        const base = { salesCount: sales.length, salesTotal, recordCount: records.length };
        const entry = calendarDb[key];
        if (entry && CAL_STATUS[entry.status]) return { ...base, status: entry.status, note: entry.note || '', explicit: true };
        if (sales.length > 0) return { ...base, status: 'laborado', note: '', explicit: false };
        return { ...base, status: null, note: '', explicit: false };
    }

    // Clase de la insignia según el estado (null = sin definir).
    const dayBadgeClass = (status) => 'badge-' + (status || 'sindefinir');
    const dayLabel = (status) => status ? CAL_STATUS[status].label : 'Sin definir';

    // Asigna estado y nota a una fecha.
    function setDayState(key, status, note) {
        calendarDb[key] = { status, note: String(note || '').trim().slice(0, CAL_NOTE_MAX) };
        saveCalendar();
    }

    // Llamada desde Contable al registrar una venta: si la fecha estaba marcada como "sin ventas" o "asueto",
    // pasa a "laborado" (conserva la nota, que queda como contexto: p. ej. "laborado en asueto nacional").
    // @returns {boolean} true si cambió el estado.
    function markDayWorkedOnSale(key) {
        const entry = calendarDb[key];
        if (entry && entry.status !== 'laborado') {
            entry.status = 'laborado';
            saveCalendar();
            return true;
        }
        return false;
    }

    // Redibuja todo lo que depende del calendario (vista de calendario y etiqueta de jornada de Contable).
    function refreshCalendarViews() {
        renderCalendar();
        renderDayStatusBadge();
    }

    // Cambia de mes (delta = -1 anterior, +1 siguiente).
    function changeCalMonth(delta) {
        calViewMonth += delta;
        if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
        if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
        renderCalendar();
    }

    // Vuelve al mes actual.
    function goCalToday() {
        const now = new Date();
        calViewYear = now.getFullYear();
        calViewMonth = now.getMonth();
        renderCalendar();
    }

    // Dibuja el mes visible: rejilla de días, tarjetas resumen del mes y lista de fechas especiales.
    function renderCalendar() {
        const grid = document.getElementById('calGrid');
        if (!grid) return;
        const y = calViewYear, m = calViewMonth;
        document.getElementById('calTitle').textContent = `${CAL_MONTHS[m]} ${y}`;

        const firstOffset = (new Date(y, m, 1).getDay() + 6) % 7;   // semana de lunes a domingo
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const counts = { laborado: 0, sinventas: 0, asueto: 0, sindefinir: 0 };
        const special = [];
        let html = CAL_DOW_HEAD.map(d => `<div class="cal-dow">${d}</div>`).join('');
        for (let i = 0; i < firstOffset; i++) html += '<div class="cal-day empty" aria-hidden="true"></div>';

        for (let d = 1; d <= daysInMonth; d++) {
            const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const info = getDayInfo(key);
            counts[info.status || 'sindefinir']++;
            if (info.status === 'sinventas' || info.status === 'asueto' || info.note) special.push({ key, info });

            const tag = info.status ? `<span class="d-tag">${CAL_STATUS[info.status].label}</span>` : '';
            const note = info.note ? `<span class="d-note">${escapeHtml(info.note)}</span>` : '';
            const sales = info.salesCount > 0 ? `<span class="d-sales">$${info.salesTotal.toFixed(2)}</span>` : '';
            const aria = `${formatLongDate(key)}: ${dayLabel(info.status)}${info.note ? '. ' + info.note : ''}`;
            html += `<button type="button" class="cal-day${key === todayStr ? ' today' : ''}" data-st="${info.status || 'sindefinir'}" data-date="${key}" ` +
                    `title="${escapeHtml(aria)}" aria-label="${escapeHtml(aria)}" onclick="openDayEditor('${key}')">` +
                    `<span class="d-top"><span class="d-num">${d}</span>${tag}</span>${note}${sales}</button>`;
        }
        grid.innerHTML = html;

        document.getElementById('calCntWorked').textContent = counts.laborado;
        document.getElementById('calCntNoSales').textContent = counts.sinventas;
        document.getElementById('calCntHoliday').textContent = counts.asueto;
        document.getElementById('calCntUndef').textContent = counts.sindefinir;

        const body = document.getElementById('calSpecialBody');
        body.innerHTML = special.length === 0
            ? '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:18px;">No hay fechas especiales ni notas en este mes.</td></tr>'
            : special.map(({ key, info }) => `<tr>
                <td class="cell-mono">${key}</td>
                <td><span class="badge ${dayBadgeClass(info.status)}">${dayLabel(info.status)}</span></td>
                <td>${info.note ? escapeHtml(info.note) : '<span style="color:var(--text-subtle);">—</span>'}</td>
            </tr>`).join('');
    }

    // Dibuja la etiqueta de jornada de la fecha activa en la barra de fecha de Contable.
    function renderDayStatusBadge() {
        const el = document.getElementById('dayStatusBadge');
        if (!el) return;
        if (activeTab === 'TODOS') { el.style.display = 'none'; el.innerHTML = ''; return; }
        const info = getDayInfo(activeTab);
        el.style.display = 'flex';
        el.innerHTML = `<span class="badge ${dayBadgeClass(info.status)}">Jornada: ${dayLabel(info.status)}${info.status && !info.explicit ? ' (automático)' : ''}</span>` +
            (info.note ? `<span class="day-status-note" title="${escapeHtml(info.note)}">${escapeHtml(info.note)}</span>` : '') +
            `<button type="button" class="btn btn-light" onclick="openDayEditor('${activeTab}')">Editar jornada</button>`;
    }

    // Abre el editor de un día: estado obligatorio + nota o motivo opcional.
    // Si el día tiene ventas y se marca como "sin ventas" o "asueto", pide confirmación para evitar inconsistencias.
    // @param {string} key  Fecha 'AAAA-MM-DD'.
    async function openDayEditor(key) {
        const info = getDayInfo(key);
        let selected = info.status;

        const body = document.createElement('div');
        body.className = 'day-editor';
        body.innerHTML = `
            <div class="day-editor-date">${escapeHtml(formatLongDate(key))}</div>
            <div class="day-editor-meta">${info.recordCount} movimiento(s) · ${info.salesCount} venta(s) · $${info.salesTotal.toFixed(2)}</div>
            <span class="dlg-label">Estado de la jornada</span>
            <div class="pill-grid" id="dayStatusPills">
                ${Object.entries(CAL_STATUS).map(([k, v]) => `<button type="button" class="op-tile op-pill" data-st="${k}"><span><b>${v.long}</b></span></button>`).join('')}
            </div>
            <div class="form-group">
                <label for="dayNote">Nota o motivo (opcional)</label>
                <input type="text" id="dayNote" maxlength="${CAL_NOTE_MAX}" placeholder="Ej. Asueto nacional, cierre por mantenimiento..." autocomplete="off">
            </div>
            <div class="day-suggestions" id="daySuggestions"></div>`;
        const noteInput = body.querySelector('#dayNote');
        noteInput.value = info.note;

        // Fichas de estado y motivos sugeridos según el estado elegido.
        const paintStatus = () => {
            body.querySelectorAll('#dayStatusPills .op-tile').forEach(t => t.classList.toggle('active', t.dataset.st === selected));
            const sug = body.querySelector('#daySuggestions');
            sug.innerHTML = selected ? CAL_NOTE_SUGGESTIONS[selected].map(s => `<button type="button" class="cat-chip">${escapeHtml(s)}</button>`).join('') : '';
            sug.querySelectorAll('.cat-chip').forEach(c => c.addEventListener('click', () => { noteInput.value = c.textContent; noteInput.focus(); }));
        };
        body.querySelectorAll('#dayStatusPills .op-tile').forEach(t => t.addEventListener('click', () => { selected = t.dataset.st; paintStatus(); }));
        paintStatus();

        const actions = [{ label: 'Cancelar', variant: 'light', value: 'cancel' }];
        if (info.explicit) actions.push({ label: 'Quitar estado', variant: 'danger', value: 'clear' });
        actions.push({
            label: 'Guardar', variant: 'primary', value: 'save',
            onClick: async () => {
                if (!selected) { showToast('⚠️ Selecciona el estado de la jornada.', true); return false; }
                if (selected !== 'laborado' && info.salesCount > 0) {
                    const ok = await confirmDialog({
                        title: 'Fecha con ventas registradas',
                        message: `El ${formatLongDate(key)} tiene ${info.salesCount} venta(s) por $${info.salesTotal.toFixed(2)}.\nMarcarlo como "${CAL_STATUS[selected].long}" puede generar inconsistencias en los reportes.\n\n¿Deseas continuar?`,
                        confirmText: 'Marcar de todos modos', tone: 'warning'
                    });
                    if (!ok) return false;
                }
                setDayState(key, selected, noteInput.value);
                return true;
            }
        });

        const result = await openDialog({ title: 'Jornada del día', body, actions, tone: 'primary', dismissValue: 'cancel', focus: '.pill-grid .op-tile' });
        if (result === 'save') {
            refreshCalendarViews();
            showToast(`Jornada del ${key} guardada como "${CAL_STATUS[selected].label}".`);
        } else if (result === 'clear') {
            delete calendarDb[key];
            saveCalendar();
            refreshCalendarViews();
            showToast(`Se quitó el estado de la jornada del ${key}.`, false, 'info');
        }
    }

    // Resume las jornadas de un rango de fechas (para Reportes).
    // @returns {{laborado:number, sinventas:number, asueto:number, sindefinir:number, special:Array}}
    function getJornadasSummary(start, end) {
        const out = { laborado: 0, sinventas: 0, asueto: 0, sindefinir: 0, special: [] };
        const cur = parseISODate(start), last = parseISODate(end);
        while (cur <= last) {
            const key = formatISODate(cur);
            const info = getDayInfo(key);
            out[info.status || 'sindefinir']++;
            if (info.status === 'sinventas' || info.status === 'asueto' || info.note) out.special.push({ key, status: info.status, note: info.note });
            cur.setDate(cur.getDate() + 1);
        }
        return out;
    }

    // Llena la sección "Jornadas del periodo" del reporte.
    // @param {string} start, end  Rango 'AAAA-MM-DD'.
    // @param {number} salesTotal  Ventas del rango (para el promedio por día laborado).
    function renderJornadasReport(start, end, salesTotal) {
        const sec = document.getElementById('jornadasSection');
        if (!sec) return;
        const j = getJornadasSummary(start, end);
        document.getElementById('repDaysWorked').textContent = j.laborado;
        document.getElementById('repDaysNoSales').textContent = j.sinventas;
        document.getElementById('repDaysHoliday').textContent = j.asueto;
        document.getElementById('repAvgSales').textContent = `$${(j.laborado > 0 ? salesTotal / j.laborado : 0).toFixed(2)}`;
        document.getElementById('repDaysUndef').textContent = j.sindefinir > 0
            ? `${j.sindefinir} día(s) del periodo sin jornada definida: no se cuentan en los totales anteriores.` : 'Todas las fechas del periodo tienen jornada definida.';
        document.getElementById('jornadasBody').innerHTML = j.special.length === 0
            ? '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:18px;">No hay fechas especiales ni notas en este rango.</td></tr>'
            : j.special.map(s => `<tr>
                <td class="cell-mono">${s.key}</td>
                <td><span class="badge ${dayBadgeClass(s.status)}">${dayLabel(s.status)}</span></td>
                <td>${s.note ? escapeHtml(s.note) : '<span style="color:var(--text-subtle);">—</span>'}</td>
            </tr>`).join('');
        sec.style.display = 'block';
    }
