// ==========================================================================
// Arranque de la aplicación
// Se carga ÚLTIMO: ejecuta la inicialización una vez disponibles todas las funciones.
// ==========================================================================

    // Muestra el módulo Contable al iniciar.
    switchModule('contable');
    // Dibuja pestañas, historial, métricas y gráfico con los datos guardados.
    saveAndRefresh();
    // Deja el formulario configurado para el tipo de operación 'venta'.
    handleTypeChange('venta');
    // Añade íconos y tonos a las tarjetas de métricas.
    decorateMetrics();
    // Sincroniza las fichas de categoría con los valores iniciales de sus selects.
    syncCatTiles();
