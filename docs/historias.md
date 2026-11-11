# Historias de usuario de [Nombre del proyecto]

Cada funcionalidad se escribe como una historia: **quién** la necesita, **qué** quiere y **para qué**. Debajo van sus criterios de aceptación: frases que se pueden **comprobar** en el navegador o en REST Client.

Cada historia es una unidad de trabajo con el agente: un pedido, sus pruebas y un commit.

> Los ejemplos son de ReservaYa. Bórralos y escribe las historias de tu proyecto a partir de las funcionalidades de tu propuesta. Puedes pedirle al agente un primer borrador, pero **revísalo**.

## Entrega 1: base

### HU-01 Registrar mi negocio
**Como** dueño de una barbería, **quiero** registrar mi negocio y mi cuenta, **para** empezar a recibir reservas.

Criterios de aceptación:
- Al registrarme con datos válidos, entro a mi panel con el nombre de mi negocio.
- Si el correo ya existe, veo el mensaje “Ya existe una cuenta con ese correo” (RN-02).
- La contraseña se guarda cifrada.

Reglas involucradas: RN-02

### HU-02 Iniciar sesión
**Como** dueño, **quiero** iniciar sesión, **para** administrar mi negocio.

Criterios de aceptación:
- Con datos correctos entro al panel; con datos incorrectos veo un error claro.
- Si recargo la página, la sesión sigue iniciada.
- Sin sesión, las páginas del panel me llevan a iniciar sesión.

## Entrega 2: funcionalidad principal

### HU-03 Administrar mis servicios
**Como** dueño, **quiero** crear, editar y desactivar los servicios que ofrezco, **para** que los clientes sepan qué pueden reservar.

Criterios de aceptación:
- Puedo crear un servicio con nombre, duración y precio; si falta un dato, veo el error.
- Puedo buscar servicios por nombre.
- Si un servicio tiene citas, no se elimina: se desactiva (RN-08).
- Otro negocio no puede ver ni modificar mis servicios (RN-01).

Reglas involucradas: RN-01, RN-08, RN-09

### HU-04 [Título]
**Como** [rol], **quiero** [acción], **para** [beneficio].

Criterios de aceptación:
-
-
-

Reglas involucradas:

## Entrega 3: funcionalidad estrella ⭐

### HU-0X [Título]
**Como** [rol], **quiero** [acción], **para** [beneficio].

Criterios de aceptación:
-
-
-

Reglas involucradas:

## Entrega 4: publicación y presentación

### HU-0X Ver el resumen de mi negocio
**Como** dueño, **quiero** ver un panel con números y un gráfico, **para** saber cómo va mi negocio.

Criterios de aceptación:
-
-
