# Tablero Kanban

## Qué hace

Muestra las tareas en columnas. Hay dos variantes: por secciones en una lista propia y por día en Próximos 7 días.

## Tablero de una lista

| Elemento | Comportamiento |
|---|---|
| Activación | Desde el menú de la cabecera; se guarda en la lista |
| Primera vez | Crea una columna por defecto, sin sección, que recibe todas las tareas |
| Columna | Título, contador, botón de añadir y menú |
| Nueva sección | Botón a la derecha de la última columna |
| Tarjeta | Casilla, título, etiquetas, fecha, iconos |
| Completadas | Grupo plegable al final de la columna |
| Abrir tarea | Detalle en panel flotante; la ruta incluye la tarea |

El cambio de vista fue explícito y solo afectó a esa lista.

## Tablero por día

Una columna por día con su nombre, contador y botón para añadir. Las tareas muestran la lista de origen.

## Reglas

- Una tarea pertenece a una sola columna.
- El contador solo incluye pendientes.
- Al volver a lista, la asignación de columnas debería conservarse (no probado).

## No observado

| Tema | Propuesta para Andamia |
|---|---|
| Arrastrar entre columnas | Cambia la columna y el orden |
| Arrastrar en el tablero por día | Cambia la fecha |
| Borrar una columna con tareas | Las tareas pasan a la columna por defecto |
| Renombrar y reordenar columnas | Desde el menú de columna y arrastrando |
| Agrupación en vista de lista | La opción de añadir sección sugiere que las columnas se ven como secciones |

Plan gratuito: 39 columnas por lista. Andamia no necesita ese límite.

## Casos límite

| Caso | Comportamiento |
|---|---|
| Lista sin tareas | No observado |
| Muchas columnas | Se desplaza horizontalmente |

## Atajos

V y luego K. Ver [atajos.md](atajos.md).
