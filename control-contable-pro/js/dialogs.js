// ==========================================================================
// Notificaciones y diálogos
// Sustituye a alert()/confirm() del navegador por toasts apilados y modales con el
// estilo de la aplicación (ver css/feedback.css).
//   showToast(msg, isError?, type?)  -> aviso flotante (misma firma de siempre: no hay que tocar a quienes la llaman).
//   confirmDialog({...})             -> Promise<boolean>; reemplaza a confirm().
//   openDialog({...})                -> modal genérico (lo usan el calendario y el cierre de inventario).
// ==========================================================================

    // Iconos (contenido interno de un <svg viewBox="0 0 24 24"> de trazo) para toasts y diálogos.
    const FEEDBACK_ICONS = {
        success: '<path d="M5 13l4 4L19 7"/>',
        error:   '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16h.01"/>',
        warning: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
        info:    '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
        danger:  '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',
        primary: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
        close:   '<path d="M6 6l12 12M18 6L6 18"/>'
    };
    const svgIcon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FEEDBACK_ICONS[name]}</svg>`;

    // Máximo de toasts visibles a la vez.
    const TOAST_MAX = 4;

    // Muestra una notificación flotante.
    // @param {string}  message  Texto. Si empieza con un emoji se quita: el icono lo pone el propio toast.
    // @param {boolean} isError  true = error/advertencia (rojo u ocre); false = éxito (verde).
    // @param {string}  [type]   Fuerza el tipo: 'success' | 'error' | 'warning' | 'info'.
    //                           Si se omite: los mensajes que empiezan con ⚠ son advertencias de validación; el resto sigue a isError.
    function showToast(message, isError = false, type) {
        const stack = document.getElementById('toastStack');
        if (!stack) return;
        const raw = String(message ?? '');
        type = type || (isError ? (raw.trim().startsWith('⚠') ? 'warning' : 'error') : 'success');
        const text = raw.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '');

        // Si ya hay un toast idéntico visible, solo se reinicia su temporizador (evita apilar 'Stock máximo alcanzado' en cada tecla).
        const dup = [...stack.children].find(t => t.dataset.msg === text && t.dataset.type === type && !t.classList.contains('leaving'));
        if (dup) {
            const bar = dup.querySelector('.t-bar');
            bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
            return;
        }
        while (stack.children.length >= TOAST_MAX) stack.firstElementChild.remove();

        const life = (type === 'error' || type === 'warning') ? 6000 : 4200;
        const el = document.createElement('div');
        el.className = `toast-item t-${type}`;
        el.setAttribute('role', (type === 'error' || type === 'warning') ? 'alert' : 'status');
        el.dataset.msg = text; el.dataset.type = type;
        el.style.setProperty('--t-life', life + 'ms');
        el.innerHTML = `<span class="t-ico">${svgIcon(type)}</span><span class="t-msg">${escapeHtml(text)}</span>` +
                       `<button type="button" class="t-close" aria-label="Cerrar notificación">${svgIcon('close')}</button><span class="t-bar"></span>`;
        el.querySelector('.t-close').addEventListener('click', () => dismissToast(el));
        el.querySelector('.t-bar').addEventListener('animationend', () => dismissToast(el));
        stack.appendChild(el);
    }

    // Cierra un toast con animación de salida.
    function dismissToast(el) {
        if (!el || el.classList.contains('leaving')) return;
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 180);
    }

    // Pila de diálogos abiertos (solo el de arriba reacciona a Esc y Tab; permite abrir una confirmación sobre otro modal).
    const dialogStack = [];

    // Abre una ventana modal y devuelve una promesa que se resuelve al cerrarse.
    // @param {Object}   o
    // @param {string}   o.title          Título.
    // @param {string|Node} o.body        Contenido (HTML ya seguro, o un nodo DOM).
    // @param {Array}    o.actions        Botones: { label, value, variant: 'primary'|'light'|'danger'|'warning', onClick?(dialogEl) }.
    //                                    Si onClick devuelve false el diálogo NO se cierra (sirve para validar).
    // @param {string}   o.tone           'primary' | 'danger' | 'warning' | 'info' (color del icono y del encabezado).
    // @param {boolean}  o.wide           Ventana ancha (tablas).
    // @param {*}        o.dismissValue   Valor devuelto al cerrar con Esc, con clic fuera o con la X.
    // @param {string}   o.focus          Selector del elemento que recibe el foco inicial.
    // @returns {Promise<*>} value del botón pulsado (o dismissValue).
    function openDialog({ title = '', body = '', actions = [], tone = 'primary', wide = false, dismissValue, focus } = {}) {
        return new Promise(resolve => {
            const previousFocus = document.activeElement;
            const titleId = 'dlgTitle' + Date.now() + dialogStack.length;

            const overlay = document.createElement('div');
            overlay.className = 'dlg-overlay';
            const dlg = document.createElement('div');
            dlg.className = `dlg tone-${tone}${wide ? ' dlg-wide' : ''}`;
            dlg.setAttribute('role', 'dialog');
            dlg.setAttribute('aria-modal', 'true');
            dlg.setAttribute('aria-labelledby', titleId);
            dlg.innerHTML = `<div class="dlg-head"><span class="dlg-ico">${svgIcon(FEEDBACK_ICONS[tone] ? tone : 'primary')}</span><h3 class="dlg-title" id="${titleId}">${escapeHtml(title)}</h3></div><div class="dlg-body"></div><div class="dlg-foot"></div>`;
            const bodyEl = dlg.querySelector('.dlg-body');
            if (body instanceof Node) bodyEl.appendChild(body); else bodyEl.innerHTML = body;
            overlay.appendChild(dlg);

            let settled = false;
            const close = (value) => {
                if (settled) return;
                settled = true;
                dialogStack.splice(dialogStack.indexOf(overlay), 1);
                document.removeEventListener('keydown', onKey, true);
                overlay.classList.add('closing');
                setTimeout(() => {
                    overlay.remove();
                    if (dialogStack.length === 0) document.body.classList.remove('dlg-open');
                    if (previousFocus && previousFocus.focus) previousFocus.focus();
                }, 140);
                resolve(value);
            };

            const foot = dlg.querySelector('.dlg-foot');
            actions.forEach(a => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = `btn btn-${a.variant || 'light'}`;
                b.textContent = a.label;
                b.addEventListener('click', async () => {
                    if (a.onClick) { const keepOpen = (await a.onClick(dlg)) === false; if (keepOpen) return; }
                    close(a.value);
                });
                foot.appendChild(b);
            });

            // Esc cancela; Tab queda atrapado dentro del diálogo superior.
            function onKey(e) {
                if (dialogStack[dialogStack.length - 1] !== overlay) return;
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(dismissValue); }
                else if (e.key === 'Tab') {
                    const f = [...dlg.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
                    if (!f.length) return;
                    const first = f[0], last = f[f.length - 1];
                    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                }
            }
            document.addEventListener('keydown', onKey, true);
            // Clic sobre el fondo (no sobre la ventana) = cancelar.
            overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(dismissValue); });

            dialogStack.push(overlay);
            document.body.classList.add('dlg-open');
            document.body.appendChild(overlay);
            const target = (focus && dlg.querySelector(focus)) || foot.lastElementChild || dlg;
            target.focus();
        });
    }

    // Reemplazo de confirm(): devuelve una promesa con true (confirmó) o false (canceló / Esc / clic fuera).
    // En acciones destructivas (tone 'danger') el foco inicial queda en "Cancelar" para evitar borrados accidentales con Enter.
    // @param {string} o.message  Texto plano (admite saltos de línea).
    // @param {string} o.tone     'danger' | 'warning' | 'primary'.
    function confirmDialog({ title = 'Confirmar', message = '', confirmText = 'Confirmar', cancelText = 'Cancelar', tone = 'primary' } = {}) {
        const variant = tone === 'danger' ? 'danger' : (tone === 'warning' ? 'warning' : 'primary');
        return openDialog({
            title, tone, dismissValue: false,
            body: `<p class="dlg-msg">${escapeHtml(message)}</p>`,
            actions: [
                { label: cancelText, variant: 'light', value: false },
                { label: confirmText, variant, value: true }
            ],
            focus: tone === 'danger' ? '.dlg-foot .btn:first-child' : '.dlg-foot .btn:last-child'
        });
    }
