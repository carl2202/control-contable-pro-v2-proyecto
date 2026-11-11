// ==========================================================================
// Interfaz común
// Notificaciones (toast), navegación entre módulos y utilidades de fichas/íconos
// compartidas por todos los módulos.
// ==========================================================================

    // Escapa texto para insertarlo de forma segura dentro de HTML (contenido o atributos entre comillas dobles).
    // Sin esto, una descripción/nombre con <, & o comillas rompía la tabla (o inyectaba HTML) al dibujarse con innerHTML.
    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Cambia el módulo visible (F1..F5) y refresca lo que necesita cada uno.
    // @param {string} mod  'contable' | 'inventario' | 'apartados' | 'cajaChica' | 'reportes'.
    function switchModule(mod) {
        // Paso 1: oculta todas las vistas y desactiva todos los botones del panel lateral.
        // Los ids siguen la convención view<Modulo> y btnMod<Modulo> (primera letra en mayúscula).
        ['contable', 'inventario', 'apartados', 'cajaChica', 'reportes', 'cierre', 'calendario'].forEach(m => {
            const v = document.getElementById(`view${m.charAt(0).toUpperCase() + m.slice(1)}`);
            const b = document.getElementById(`btnMod${m.charAt(0).toUpperCase() + m.slice(1)}`);
            if(v) v.classList.remove('active');
            if(b) b.classList.remove('active');
        });

        // Paso 2: activa la vista y el botón del módulo solicitado.
        const targetView = document.getElementById(`view${mod.charAt(0).toUpperCase() + mod.slice(1)}`);
        const targetBtn = document.getElementById(`btnMod${mod.charAt(0).toUpperCase() + mod.slice(1)}`);
        if(targetView) targetView.classList.add('active');
        if(targetBtn) targetBtn.classList.add('active');

        // Paso 3: acciones propias de cada módulo al abrirse.
        // Inventario: dibuja la tabla y asegura que el formulario tenga al menos una fila de variante.
        if (mod === 'inventario') {
            renderInventoryTable();
            if (document.getElementById('variantsContainer').children.length === 0) addVariantRow();
        }
        // Apartados: dibuja la tabla y carga los modelos disponibles en el selector.
        if (mod === 'apartados') {
            renderApartadosTable();
            updateApartadoModelDropdown();
        }
        // Contable: actualiza el selector de modelos para vender (el inventario pudo cambiar).
        if (mod === 'contable') {
            updateModelSaleDropdown();
        }
        // Caja Chica: recalcula saldo y tabla de movimientos.
        if (mod === 'cajaChica') {
            renderCajaChica();
        }
        if (mod === 'reportes') {
            // Se mantiene limpio sin autogenerar para cumplir que la alerta/reporte aparezca solo al crearlo
        }
        // Cierre de inventario: recalcula la valoración actual y el historial de cierres.
        if (mod === 'cierre') {
            renderCierre();
        }
        // Calendario: dibuja el mes visible con los estados de cada jornada.
        if (mod === 'calendario') {
            renderCalendar();
        }
    }

    // Selecciona un tipo de operación desde las fichas: guarda el valor en el <select id="type"> y ajusta el formulario.
    // @param {string} v  Tipo: venta, compra, cajachica, luz, agua o internet.
    function setOp(v) { document.getElementById('type').value = v; handleTypeChange(v); }
    // Marca como activa (.active) la ficha de operación cuyo data-op coincide con el valor.
    // @param {string} v  Tipo de operación seleccionado.
    // Solo toca las fichas de operación (las que tienen data-op). Antes recorría TODAS las .op-tile y, al cambiar de tipo de operación,
    // apagaba también las fichas de los filtros de público/prenda y de los conceptos de caja chica (que usan data-val).
    function syncOpTiles(v) { document.querySelectorAll('.op-tile[data-op]').forEach(t => t.classList.toggle('active', t.dataset.op === v)); }

    // Añade un ícono SVG y un 'tono' (success/danger/warning/primary) a cada tarjeta de métrica (.metric-card).
    // El tono se deduce del color del borde superior (style) y el ícono, del texto de la etiqueta (ventas, gastos, IVA, ganancia).
    function decorateMetrics() {
        // Biblioteca de íconos: cada valor es el contenido interno de un <svg> (trazos).
        const I = {
            up:'<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>', down:'<path d="M3 7l6 6 4-4 8 8M15 17h6v-6"/>',
            pct:'<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
            cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
            wallet:'<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><path d="M16 14h.01"/>',
            check:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>',
            pause:'<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>',
            sun:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
            cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
            box:'<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>'
        };
        document.querySelectorAll('.metric-card').forEach(c => {
            // Detecta el tono leyendo var(--success|danger|warning|primary) del atributo style; por defecto 'primary'.
            const m = (c.getAttribute('style') || '').match(/var\(--(success|danger|warning|primary)\)/);
            const tone = m ? m[1] : 'primary'; c.dataset.tone = tone;
            const lab = c.querySelector('.label'); const t = lab ? lab.textContent.toLowerCase() : '';
            const old = c.querySelector('.m-icon'); if (old) old.remove();
            const d = document.createElement('div'); d.className = 'm-icon';
            let iconSvg = I.wallet;
            // Elige el ícono según la etiqueta de la tarjeta; si no coincide ninguna usa la billetera.
            // Las reglas nuevas van primero: 'días sin ventas' debe ganarle a 'ventas', y 'promedio de ventas' al resto.
            if (/promedio/.test(t)) iconSvg = I.up;
            else if (/sin ventas/.test(t)) iconSvg = I.pause;
            else if (/laborad/.test(t)) iconSvg = I.check;
            else if (/asueto|feriado/.test(t)) iconSvg = I.sun;
            else if (/sin definir/.test(t)) iconSvg = I.cal;
            else if (/unidades|modelos/.test(t)) iconSvg = I.box;
            else if (/valor/.test(t)) iconSvg = I.cash;
            else if (/ventas/.test(t)) iconSvg = I.up;
            else if (/gastos/.test(t)) iconSvg = I.down;
            else if (/iva/.test(t)) iconSvg = I.pct;
            else if (/ganancia/.test(t)) iconSvg = I.cash;
            d.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + iconSvg + '</svg>';
            c.prepend(d);
        });
    }

    // Selecciona una opción en una rejilla de fichas: copia su valor al <select> asociado, dispara 'change' y sincroniza las fichas.
    // @param {string} id  id del <select> controlado.
    // @param {HTMLElement} el  Ficha pulsada (su data-val trae el valor).
    function setCat(id, el) { 
        const x = document.getElementById(id); 
        x.value = el.dataset.val; 
        x.dispatchEvent(new Event('change', {bubbles:true})); 
        syncCatTiles(); 
    }
    
    // Recorre las rejillas .cat-grid/.pill-grid y marca como activa la ficha que coincide con el valor actual de su <select> (data-for).
    function syncCatTiles() { 
        document.querySelectorAll('.cat-grid, .pill-grid').forEach(g => { 
            const x = document.getElementById(g.dataset.for); 
            if (!x) return;
            g.querySelectorAll('.op-tile').forEach(t => {
                t.classList.toggle('active', t.dataset.val === x.value);
            }); 
        }); 
    }
