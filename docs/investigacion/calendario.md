# Calendario

**Cobertura baja.** La cuenta gratuita muestra datos de ejemplo detrás de un aviso de pago, así que no se vio ninguna tarea real en el calendario. Esta ficha separa lo observado de lo propuesto.

## Observado

| Elemento | Detalle |
|---|---|
| Modos | Día, semana, mes, año y agenda |
| Cabecera | Título del periodo, añadir, selector de modo, anterior, hoy, siguiente, opciones |
| Panel lateral | Botón para mostrarlo |
| Semana y día | Horas en vertical, fila superior para todo el día, indicador de la hora actual |
| Mes | Rejilla con barras de color por tarea |
| Año | Doce meses con mapa de calor |
| Agenda | Lista ordenada por hora, agrupada por día |
| Preferencias | Mostrar detalle, completadas, subtareas, tareas futuras, sesiones de enfoque, hábitos; color de celda |

## Propuesta para Andamia

Sin validar contra la app, porque no se pudo probar.

| Regla | Propuesta |
|---|---|
| Tareas con hora | Bloque en su franja, con altura según la duración |
| Tareas de todo el día | Fila superior |
| Tarea sin duración | Altura mínima fija |
| Crear | Clic en una franja abre la entrada rápida con esa fecha y hora |
| Mover | Arrastrar cambia la fecha y la hora |
| Cambiar duración | Arrastrar el borde inferior |
| Repetidas | Mostrar ocurrencias futuras calculadas con la regla |
| Mes con muchas tareas | Mostrar unas pocas y un contador de restantes |
| Primer día de la semana | Según preferencia |
| Zona horaria | Mostrar en la zona local |

## Casos límite por decidir

- Tareas que cruzan la medianoche.
- Cambio de horario de verano.
- Solapamiento de varias tareas en la misma franja.

## Decisión para Andamia

En Andamia, el calendario estará disponible sin pago. No se copia el contenido de ejemplo.

## Atajos

D o 1 día, W o 2 semana, M o 3 mes, Y o 4 año, A o 5 agenda, T hoy. Ver [atajos.md](atajos.md).
