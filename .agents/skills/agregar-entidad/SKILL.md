---
name: agregar-entidad
description: Úsala cuando haya que agregar una entidad nueva al proyecto (una tabla con su CRUD completo): script SQL, esquema Zod, rutas de la API filtradas por negocio, pruebas en REST Client y pantalla en React con Tailwind.
---

# Agregar una entidad

Antes de empezar, revisa en docs/reglas-negocio.md las reglas que involucran a esta entidad y en docs/modelo-datos.md su tabla.

Sigue estos pasos en orden. Al final de cada paso, muestra lo que hiciste y espera mi aprobación antes de continuar.

## 1. Base de datos
- Crea `backend/database/NN-<entidad>.sql` (NN es el siguiente número).
- La tabla tiene: `id INT AUTO_INCREMENT PRIMARY KEY`, `negocio_id INT NOT NULL` con `FOREIGN KEY` hacia `negocios(id)`, los campos de la entidad (`NOT NULL` cuando sean obligatorios) y `creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.
- Si la entidad depende de otra (por ejemplo, una cita depende de un servicio), agrega su `FOREIGN KEY`.
- Muéstrame el script y espera a que lo ejecute en MySQL.

## 2. Esquema de validación
- Crea `backend/src/schemas/<entidad>Schema.js` con Zod, con mensajes de error en español.

## 3. Rutas de la API
- Crea `backend/src/routes/<entidad>.js` y móntalo en `src/index.js` como `/api/<entidad>`.
- Rutas: `GET /` (lista, con búsqueda `?q=` y los filtros que pida la ficha), `GET /:id`, `POST /`, `PUT /:id` y `DELETE /:id`.
- Todas usan `verificarToken`. Las que modifican datos revisan el rol cuando la ficha lo indique.
- Toda consulta filtra con `WHERE negocio_id = ?` usando `req.usuario.negocio_id`. Al insertar, el `negocio_id` sale del token, nunca del `body`.
- Si el registro no existe **o es de otro negocio**, responde 404.
- Responde 409 ante `ER_DUP_ENTRY` y `ER_ROW_IS_REFERENCED_2`, con un mensaje claro.
- Implementa en la API todas las reglas de negocio (RN-XX) que involucran a esta entidad, y comenta en el código el código de cada regla.

## 4. Pruebas
Agrega a `backend/pruebas.http`: crear con datos válidos (201), crear con datos inválidos (400), listar, buscar, editar, eliminar, una petición con el token de **otro negocio** que intenta ver o editar un registro ajeno (debe responder 404), y una prueba por cada regla de negocio involucrada, con su código RN-XX en el título.

## 5. Pantalla
- Crea `frontend/src/pages/<Entidad>.jsx` con Tailwind:
  - Lista (tabla en computadora, tarjetas en teléfono) con buscador y filtros.
  - Estados de carga, lista vacía y error.
  - Formulario con React Hook Form y Zod para crear y editar.
  - Eliminar con confirmación.
- Usa `fetchConToken` del AuthContext. Agrega la ruta protegida y el enlace en el menú lateral del panel.

## 6. Cierre
- Lista los archivos que creaste o cambiaste y explica cómo probarlos.
- Actualiza `docs/progreso.md`: marca las tareas terminadas y agrega lo hecho y lo pendiente.

No instales librerías nuevas sin preguntarme.
