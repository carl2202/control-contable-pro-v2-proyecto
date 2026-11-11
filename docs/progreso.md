# Progreso de Control Contable Pro

## Estado actual
- Estado: Migración 100% completada a React (Vite + TypeScript + Tailwind CSS)
- Backend: Express + SQLite relacional con control de acceso por roles y sesiones
- Última actualización: 04/11/2026

## Tareas completadas
### Arquitectura y Setup
- [x] Estructura base unificada según el kit de inicio con documentación en `docs/`.
- [x] Configuración de React 19, Vite, TypeScript y Tailwind CSS en `pnpm`.
- [x] Servidor Express integrado con base de datos SQLite relacional y modo WAL.

### Autenticación y Control de Acceso
- [x] Capa de autenticación asíncrona segura con Bearer tokens y almacenamiento en `localStorage`.
- [x] Validación de roles: **Dueño / Admin** (PIN `1234`) y **Empleado / Cajero** (PIN `0000`).
- [x] Modal interactivo de inicio de sesión con teclado numérico, visualización de errores y cambio de usuario fluido.

### Servicios REST Centralizados
- [x] Implementación de `src/services/` con bloques `try/catch` robustos:
  - `auth.service.ts`
  - `movements.service.ts`
  - `dates.service.ts`
  - `inventory.service.ts`
  - `cajaChica.service.ts`
  - `cierres.service.ts`
  - `apartados.service.ts`
  - `calendar.service.ts`
  - `reports.service.ts`

### Módulos 100% React
- [x] **F1 Contable**: Pestañas de fechas, registro de ventas con ficha de tallas, compras, servicios, caja chica, buscador en historial con recálculo dinámico de métricas, y gráfico de balance de 7 días.
- [x] **F2 Inventario**: Alta y edición de modelos con variantes dinámicas (talla, color, costo, precio, stock), filtros de público y categoría, y corrección del truncamiento de texto en botones de edición.
- [x] **F3 Apartados**: Reservas con abonos parciales, liquidación de entrega y cálculo de saldo pendiente.
- [x] **F4 Caja Chica**: Inyecciones de fondo, gastos operativos autorizados, control estricto contra saldo negativo y libro de movimientos.
- [x] **F5 Reportes**: Desglose consolidado de gastos (ropa + comida + servicios básicos + caja chica), balance de IVA (13% para El Salvador) y exportación de respaldo integral en CSV.
- [x] **F6 Cierres**: Arqueo físico diario de caja con calculadora por denominaciones de billetes/monedas y congelación de snapshots de inventario valorizado a costo.
- [x] **F7 Calendario**: Matriz mensual de jornadas comerciales (laborado, sin ventas, asueto/feriado), sincronizada con las ventas contables.

### Corrección de Errores y Estabilidad
- [x] **Inventario y Variantes**: Eliminado el truncamiento en botones de edición y asegurada la persistencia atómica de variantes preservando precios de costo y referencias.
- [x] **Cálculo de IVA y Buscadores**: IVA del 13% incluido aplicado correctamente tanto a ventas como a gastos sin comprobante (generando Vales Internos `VLE-XXXX`). El buscador recalcula con precisión los totales filtrados.
- [x] **Sincronización de Stock**: Descuento automático de unidades al vender y restitución exacta del stock a bodega al eliminar un registro como Dueño.
- [x] **Diseño Responsive**: Clases `overflow-x-auto` y contenedores flexibles para visualización en computadoras y dispositivos móviles.
