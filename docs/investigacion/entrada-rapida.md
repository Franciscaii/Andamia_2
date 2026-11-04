# Entrada rápida

## Qué hace

Un campo en la parte superior de la lista crea una tarea al pulsar Enter. Reconoce fechas, horas, prioridades, etiquetas y repeticiones dentro del texto y las quita del título.

## Expresiones probadas

Los textos se escribieron en inglés, el idioma de la interfaz de la cuenta.

| Texto escrito | Título resultante | Datos reconocidos |
|---|---|---|
| `P2 hoy today !high` | `P2 hoy` | Hoy, todo el día, prioridad alta |
| `P3 manana tomorrow 22:00 !medium` | `P3 manana` | Mañana a las 22:00, prioridad media, aviso a la hora |
| `P5 subtareas next monday` | `P5 subtareas` | Próximo lunes, todo el día |
| `P6 repeticion every week` | `P6 repeticion` | Hoy, repetición semanal |
| `P7 recordatorio Dec 20 10am` | `P7 recordatorio` | 20 de diciembre a las 10:00, aviso a la hora |
| Texto con `#Otro` y `!low` | Sin esas partes | Etiqueta existente, prioridad baja |

## Reglas

1. Lo reconocido sale del título.
2. Con hora, la tarea recibe un aviso a la hora exacta sin pedirlo.
3. Sin hora, la tarea es de todo el día y no recibe aviso. Esto pudo depender de las preferencias de la cuenta.
4. Una repetición sin fecha toma hoy como fecha inicial.
5. El identificador se genera en el cliente antes de guardar.
6. La tarea queda arriba de la lista y su detalle se abre.
7. Después de crear, el foco sigue en el campo para seguir escribiendo.
8. Desde una lista, la tarea se crea en ella; desde otra vista, en la bandeja.

## Interacción con sugerencias

Al escribir `!` o `#` aparece una lista de sugerencias.

| Pulsación | Efecto |
|---|---|
| Primer Enter | Acepta la sugerencia; no crea la tarea |
| Segundo Enter | Crea la tarea |

**Caso observado:** como la automatización pulsó Enter una sola vez, el texto siguió en el campo y dos tareas se unieron en un título. Es probable que una persona lo note, pero Andamia debería mostrar claramente lo reconocido antes de crear.

## Prefijos

Según el panel de atajos: `*` fecha, `!` prioridad, `#` etiqueta, `~` o `^` lista, `@` persona. Solo se probaron `!` y `#`.

## Reconocimiento en español

No se observó: la cuenta usa inglés.

**Propuesta para Andamia:** reconocer `hoy`, `mañana`, días de la semana, `a las 10`, `cada semana`, `!alta`, `!media` y `!baja`.

## Casos límite

| Caso | Comportamiento |
|---|---|
| Texto vacío | No observado. Propuesta: no crear nada |
| Etiqueta inexistente | No probado, para no crear datos en la cuenta. Propuesta: crearla al confirmar |
| Palabra de fecha que forma parte del título | No observado. Propuesta: resaltar lo reconocido y permitir descartarlo |
| Reconocimiento desactivado | Existe una preferencia para ello; no se probó |
| Hora ya pasada hoy | No observado |

## Atajos

N o Tab+N enfocan el campo. Ver [atajos.md](atajos.md).
