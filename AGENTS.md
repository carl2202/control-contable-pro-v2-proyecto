# Control Contable Pro • Tienda de Ropa

## El proyecto
Sistema contable y de gestión integral para tienda de ropa en El Salvador (Régimen Fiscal IVA 13%), con facturación de ventas, inventario por variantes (tallas, colores, costos y precios), control de apartados de clientes, arqueo de caja chica, cierres de caja y snapshots de inventario valorizado, y calendario de jornadas comerciales.
Roles:
- **Dueño / Administrador**: Acceso total a finanzas, márgenes, eliminación de movimientos, restauración de stock y configuración (PIN: `1234`).
- **Empleado / Cajero**: Registro de ventas, consulta de stock, registro de gastos autorizados y cierres de turno (PIN: `0000`).

## Tecnologías
- **Frontend (`src/`)**: React 19 con Vite, TypeScript y Tailwind CSS.
- **Backend (`server/`)**: Node.js con Express, SQLite relacional (`node:sqlite DatabaseSync`) en modo WAL, sesiones con Bearer tokens y validación de roles.
- **Servicios Centralizados (`src/services/`)**: Capa de API asíncrona tipada para Autenticación, Movimientos, Fechas, Inventario, Caja Chica, Cierres, Apartados, Calendario y Reportes.
- **Gestor de Paquetes**: pnpm.

## Estructura
```
control-contable-pro-v2/
├── css/                     # Hojas de estilo del sistema original (tokens, botones, layout, etc.)
├── data/                    # Base de datos SQLite relacional (control_contable.db)
├── docs/                    # Especificaciones, modelo de datos, reglas de negocio y progreso
├── public/                  # Activos estáticos públicos
├── server/                  # Backend Node.js / Express
│   ├── db.ts                # Inicialización SQLite, tablas, migraciones y seeds
│   └── routes.ts            # Rutas REST de la API con control de acceso por roles
├── src/                     # Frontend 100% React + TypeScript
│   ├── components/          # Componentes modulares
│   │   ├── Header.tsx       # Encabezado con estado del sistema y selector de roles
│   │   ├── Sidebar.tsx      # Barra de navegación F1..F7
│   │   ├── LoginModal.tsx   # Modal de acceso con teclado numérico y selector de roles
│   │   ├── MetricCard.tsx   # Tarjeta de métrica interactiva con tono e íconos SVG
│   │   └── modules/         # Vistas de los 7 módulos del sistema
│   │       ├── ContableModule.tsx   # F1: Ventas, Compras, Servicios, Fechas e IVA
│   │       ├── InventoryModule.tsx  # F2: Catálogo de Bodega, Variantes y Costos
│   │       ├── ApartadosModule.tsx  # F3: Reservas de Prendas y Abonos
│   │       ├── CajaChicaModule.tsx  # F4: Fondo Operativo y Gastos Menores
│   │       ├── ReportsModule.tsx    # F5: Balance Financiero y Respaldo CSV
│   │       ├── CierreModule.tsx     # F6: Arqueo Diario y Cierre de Inventario
│   │       └── CalendarModule.tsx   # F7: Jornadas Comerciales y Asuetos
│   ├── context/
│   │   ├── AuthContext.tsx      # Estado de sesión, tokens en localStorage y roles
│   │   └── FeedbackContext.tsx  # Toasts apilados y diálogos modales de confirmación
│   ├── services/            # Capa de cliente REST centralizada con try/catch
│   │   ├── api.ts           # Cliente base con Authorization Bearer y errores
│   │   ├── auth.service.ts
│   │   ├── movements.service.ts
│   │   ├── dates.service.ts
│   │   ├── inventory.service.ts
│   │   ├── cajaChica.service.ts
│   │   ├── cierres.service.ts
│   │   ├── apartados.service.ts
│   │   ├── calendar.service.ts
│   │   └── reports.service.ts
│   ├── types/               # Definiciones de TypeScript
│   ├── utils/               # Exportación de respaldo CSV
│   ├── App.tsx              # Componente raíz con atajos de teclado F1..F7
│   ├── index.css            # Importación de Tailwind y estilos originales
│   └── main.tsx             # Punto de entrada React
├── index.html               # Entrada SPA de Vite con Google Fonts
├── package.json             # Dependencias y scripts
├── server.ts                # Servidor híbrido Express + Vite dev/prod
├── tsconfig.json            # Configuración TypeScript
└── vite.config.ts           # Configuración Vite con Tailwind y alias
```

## Reglas de Negocio
- **RN-01**: Roles y Permisos: Solo el Dueño puede eliminar movimientos, eliminar fechas, ver margen de ganancia neta y borrar prendas.
- **RN-02**: Cálculo de IVA (13% El Salvador): El impuesto se calcula sobre el precio venta/compra incluido mediante la fórmula `monto / 1.13 * 0.13`, aplicándose tanto a facturas como a gastos "Sin Comprobante".
- **RN-03**: Vales Internos de Caja: Toda operación registrada con "Sin Comprobante" genera correlativo único `VLE-XXXX`.
- **RN-04**: Sincronización de Stock: Registrar una venta descuenta exactamente las unidades de la variante (`inventory_variants.stock -= qty`). Eliminar una venta como Dueño regresa las unidades vendidas a la bodega.
- **RN-05**: Variantes sin pérdida de referencias: Las variantes conservan su costo y relación con el código del modelo.
- **RN-06**: Caja Chica Protegida: No se puede registrar un gasto ni eliminar un ingreso si deja el saldo de caja chica en negativo.
