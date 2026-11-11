# Reglas de negocio de [Nombre del proyecto]

Una regla de negocio es una condición que el sistema debe cumplir **siempre**, sin importar quién lo use ni desde dónde. Se numeran (RN-01, RN-02…) para citarlas en los pedidos al agente, en las pruebas y en los commits.

Toda regla se valida **en la API**. La validación en React es solo una ayuda para el usuario.

> Los ejemplos son de ReservaYa. Bórralos y escribe las reglas de tu proyecto (entre 8 y 12). Revisa los criterios de aceptación de tu ficha: muchos ya son reglas de negocio.

## Reglas

| Código | Regla | Entidad | Dónde se valida | Respuesta si no se cumple | Prueba |
| --- | --- | --- | --- | --- | --- |
| RN-01 | Un negocio solo puede ver y modificar sus propios datos | Todas | API | 404 | Con el token de otro negocio, pedir un registro ajeno |
| RN-02 | El correo de un usuario es único en todo el sistema | usuarios | API y base de datos (UNIQUE) | 409 | Registrar dos veces el mismo correo |
| RN-03 | Dos citas del mismo negocio no pueden cruzarse en horario | citas | API | 409 | Crear una cita en un horario ocupado |
| RN-04 | Solo se puede reservar dentro del horario de atención del negocio | citas | API | 400 | Reservar a las 22:00 |
| RN-05 | No se puede reservar en una fecha pasada | citas | API | 400 | Reservar para ayer |
| RN-06 | La duración de la cita la define el servicio, no el cliente | citas | API | — (se calcula) | Enviar una hora de fin distinta: se ignora |
| RN-07 | Una cita cancelada o completada ya no cambia de estado | citas | API | 409 | Confirmar una cita cancelada |
| RN-08 | No se puede eliminar un servicio que tiene citas; se desactiva | servicios | API | 409 | Eliminar un servicio con citas |
| RN-09 | Solo el rol dueño puede crear, editar y eliminar servicios | servicios | API | 403 | Intentarlo con otro rol |
| RN-10 | | | | | |

## Estados

Dibuja los estados de cada entidad que los tenga y qué cambios están permitidos. Cada flecha permitida (y cada una prohibida) es una regla de negocio.

### citas

```
pendiente ──► confirmada ──► completada
    │              │   └───► no_asistio
    └──► cancelada ◄┘

Prohibido: salir de cancelada, completada o no_asistio (RN-07)
```

### [otra entidad con estados]

```

```

## Cálculos

Fórmulas que el sistema debe aplicar siempre igual (totales, impuestos, fechas de vencimiento…). Si no tienes, borra esta sección.

| Código | Cálculo | Ejemplo |
| --- | --- | --- |
| RN-11 | Ingreso estimado del mes = suma del precio de las citas completadas del mes | 3 citas de $5 = $15 |
| | | |
