# Modelo de datos de [Nombre del proyecto]

Tablas, columnas y relaciones acordadas. El agente debe respetar este modelo; si necesita cambiarlo, lo propone y espera aprobación.

> Los ejemplos son de ReservaYa. Reemplázalos con las tablas de tu proyecto (están en tu ficha y en tu propuesta).

## Reglas del modelo
- Toda tabla tiene `id INT AUTO_INCREMENT PRIMARY KEY` y `creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP`.
- Toda tabla con datos de un negocio tiene `negocio_id INT NOT NULL` con llave foránea hacia `negocios(id)` (RN-01).
- Nombres de tablas y columnas en español y en snake_case.
- Dinero en `DECIMAL(10,2)`; fechas en `DATE`; horas en `TIME`; fecha y hora en `DATETIME`.

## Tablas

### negocios
| Columna | Tipo | Notas |
| --- | --- | --- |
| id | INT | Llave primaria |
| nombre | VARCHAR(100) | NOT NULL |
| slug | VARCHAR(100) | UNIQUE; se usa en el enlace público |
| telefono | VARCHAR(20) | |

### usuarios
| Columna | Tipo | Notas |
| --- | --- | --- |
| id | INT | Llave primaria |
| negocio_id | INT | FK → negocios(id) |
| nombre | VARCHAR(100) | NOT NULL |
| correo | VARCHAR(120) | UNIQUE (RN-02) |
| password_hash | VARCHAR(255) | NOT NULL |
| rol | VARCHAR(20) | 'dueno' por defecto |

### servicios
| Columna | Tipo | Notas |
| --- | --- | --- |
| id | INT | Llave primaria |
| negocio_id | INT | FK → negocios(id) |
| nombre | VARCHAR(100) | NOT NULL |
| duracion_min | INT | NOT NULL, mayor que 0 |
| precio | DECIMAL(10,2) | NOT NULL |
| activo | BOOLEAN | TRUE por defecto (RN-08) |

### [tu tabla]
| Columna | Tipo | Notas |
| --- | --- | --- |
| | | |

## Relaciones

```
negocios 1 ──── * usuarios
negocios 1 ──── * servicios
servicios 1 ──── * citas
```

## Orden de creación
1. negocios, usuarios (entrega 1)
2. servicios
3. [siguientes tablas, empezando por las que no dependen de otras]
