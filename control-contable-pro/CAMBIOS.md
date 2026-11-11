# Cambios de esta versión

## Parte 1 – Ajustes
- contable.js: el IVA vuelve a calcularse también en gastos "Sin Comprobante" (se mantiene el redondeo a centavos).
- contable.js: el buscador del historial recalcula ventas, gastos, IVA y ganancia con los datos filtrados.
- main.js: eliminado el bloque keydown; F5 recarga la página con normalidad.
- reports.js: respaldo CSV con todas las bases (movimientos, inventario con costos, apartados, caja chica, cierres, calendario).
- reports.js / index.html: "Total Gastado" suma ropa + comida + servicios básicos (luz, agua, internet) + otros gastos de caja chica.

## Parte 2 – Nuevo
- js/cierre.js, css/cierre.css: módulo F6 Cierre de Inventario (valor a costo, snapshots congelados, cierre general o por categorías).
- inventory.js: nuevo campo de costo por variante (necesario para valorar el inventario).
- js/calendar.js, css/calendar.css: módulo F7 Calendario (laborado / sin ventas / asueto + nota), integrado con Contable y Reportes.
- js/dialogs.js, css/feedback.css: toasts apilados y diálogos modales que reemplazan a confirm().
