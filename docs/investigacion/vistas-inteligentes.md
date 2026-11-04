# Vistas inteligentes

## Qué hacen

Reúnen tareas de todas las listas según un criterio automático. No contienen tareas propias.

| Vista | Criterio |
|---|---|
| Todas | Todas las pendientes de las listas incluidas |
| Hoy | Fecha de hoy |
| Mañana | Fecha de mañana |
| Próximos 7 días | Desde hoy hasta seis días después |
| Resumen | Informe de un periodo |

## Agrupación en Todas

Secciones plegables, en este orden: Hoy, Mañana, Próximos 7 días, Sin fecha, Completadas. Cada una lleva contador. Completadas muestra unas pocas y ofrece ver más.

Falta observar la sección de atrasadas: no había tareas atrasadas.

## Filas de tarea

Cada fila muestra:

- Casilla con el color de la prioridad.
- Título.
- Etiquetas.
- Lista de origen, en las vistas que mezclan listas.
- Fecha en palabras relativas (hoy, mañana, día de la semana) o absoluta si está lejos.
- Iconos de recordatorio, repetición y descripción.

## Próximos 7 días como tablero

Puede mostrarse en columnas, una por día, con título, contador y botón para añadir en ese día. La vista recuerda el modo elegido.

**Efecto observado:** al abrir Hoy, la app guardó por su cuenta el orden de las tareas de ese día. Andamia debe guardar el orden por grupo de fecha, además del orden general.

## Resumen

Genera un informe de texto editable a partir de las tareas de un periodo.

| Control | Opciones vistas |
|---|---|
| Fecha | Periodo; por defecto, esta semana |
| Listas, estado y más | Filtros; por defecto, todo |
| Agrupar | Por estado de finalización |
| Campos | Datos a incluir en cada tarea |
| Plantilla | Formato del informe |
| Próximo periodo | Casilla para incluir tareas siguientes |
| Acciones | Guardar como, copiar |

## Reglas

- Una tarea aparece en todas las vistas que cumpla, sin duplicarse dentro de una misma vista.
- Una tarea repetida cuenta por su próxima fecha.
- Una tarea con fecha de otra zona horaria se muestra según su zona guardada. Falta validarlo: solo se vio con la zona de la cuenta y UTC.

## Casos límite

| Caso | Comportamiento |
|---|---|
| Vista sin tareas | No observado. Propuesta: estado vacío con una invitación a añadir |
| Tarea añadida desde una vista inteligente | Va a la bandeja; el campo lo indica. En la vista de un día, propuesta: asignar esa fecha |
| Cambio de día con la app abierta | No observado. Propuesta: recalcular al cambiar de fecha |

## Atajos

G y luego A, T, R, N o B. Ver [atajos.md](atajos.md).
