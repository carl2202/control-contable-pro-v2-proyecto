// ==========================================================================
// Estado global y persistencia
// Declara las 'bases de datos' (localStorage), la fecha de hoy y la pestaña activa.
// Se carga PRIMERO: los demás scripts usan estas variables globales.
// ==========================================================================

    // Devuelve la fecha local de hoy como texto 'AAAA-MM-DD'.
    // Se usa como llave de cada día en storeDb y como valor de los <input type="date">.
    // Se construye con getFullYear/getMonth/getDate (hora LOCAL) para evitar el desfase de zona horaria de toISOString().
    const getTodayISO = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Convierte una fecha en 'AAAA-MM-DD' usando la hora LOCAL (compartida por calendario, cierres y reportes).
    const formatISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Congela un objeto y todo lo que contiene (los cierres de inventario son fotografías de solo lectura).
    const deepFreeze = (obj) => {
        if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
            Object.values(obj).forEach(deepFreeze);
            Object.freeze(obj);
        }
        return obj;
    };

    // Lee una "base de datos" de localStorage de forma segura.
    // Si el JSON está corrupto (o no es del tipo esperado) NO rompe la app: devuelve el valor por defecto.
    // Antes, un solo dato dañado lanzaba una excepción en state.js y la aplicación entera dejaba de cargar.
    const loadDb = (key, fallback) => {
        try {
            const parsed = JSON.parse(localStorage.getItem(key));
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed) === Array.isArray(fallback)) return parsed;
        } catch (err) {
            console.error('Datos dañados en localStorage (' + key + '); se inicia vacío.', err);
        }
        return fallback;
    };

    // Bases de datos en memoria. Cada una se carga desde localStorage al abrir la página
    // (o inicia vacía si no existe) y se vuelve a guardar cada vez que cambia.
    // storeDb: movimientos contables agrupados por fecha { 'AAAA-MM-DD': [ {id,type,desc,amount,tax,doc,time,items?,ccId?}, ... ] }.
    let storeDb = loadDb('ropa_store_v11', {});
    // inventoryDb: modelos de ropa [ {code,name,audience,category,variants:[{size,color,price,stock}]} ].
    let inventoryDb = loadDb('ropa_inv_v11', []);
    // apartadosDb: apartados de clientes [ {id,clientName,prendaDesc,total,abono,status} ].
    let apartadosDb = loadDb('ropa_apartados_v11', []);
    // cajaChicaDb: movimientos del fondo de caja chica [ {id,type:'ingreso'|'gasto',category,desc,amount,time,date} ].
    let cajaChicaDb = loadDb('ropa_cajachica_v11', []);
    // cierresDb: fotografías (snapshots) de cierres de inventario [ {id,date,time,scope,categories,note,totals,items:[...]} ].
    // Se congelan al cargarse: un cierre histórico nunca se modifica, solo se consulta o se elimina completo.
    let cierresDb = loadDb('ropa_cierres_v11', []).map(deepFreeze);
    // calendarDb: estado operativo por fecha { 'AAAA-MM-DD': { status: 'laborado'|'sinventas'|'asueto', note } }.
    let calendarDb = loadDb('ropa_calendario_v11', {});
    // Filtro activo del catálogo de inventario por público ('ALL', 'Hombre', 'Mujer', 'Niño', 'Niña', 'Unisex').
    let activeInvAudienceFilter = 'ALL';

    // Fecha de hoy calculada una sola vez al cargar la página.
    const todayStr = getTodayISO();
    // Garantiza que exista siempre la lista (pestaña) del día de hoy.
    if (!storeDb[todayStr]) storeDb[todayStr] = [];
    // Migración: versiones anteriores guardaban en una "fecha" falsa 'TODOS' los movimientos registrados desde la
    // pestaña "Todo Acumulado". Se pasan al día de hoy para que no se dupliquen pestañas ni queden fuera de los reportes.
    if (Array.isArray(storeDb['TODOS'])) {
        storeDb[todayStr] = storeDb[todayStr].concat(storeDb['TODOS']);
        delete storeDb['TODOS'];
        localStorage.setItem('ropa_store_v11', JSON.stringify(storeDb));
    }

    // Pestaña/fecha activa del módulo Contable: una fecha 'AAAA-MM-DD' o 'TODOS' (acumulado).
    let activeTab = todayStr;
    // Sincroniza el selector de fecha con la pestaña activa.
    document.getElementById('newDatePicker').value = activeTab;
