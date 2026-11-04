# Listas, bandeja, carpetas y etiquetas

## Qué hace

Las tareas se organizan en listas. La bandeja de entrada recibe las tareas creadas sin lista. Las etiquetas clasifican tareas de distintas listas.

## Crear una lista

| Campo | Opciones | Por defecto |
|---|---|---|
| Nombre | Hasta 64 caracteres | Vacío, con el foco puesto |
| Color | Sin color, siete colores o personalizado | Sin color |
| Vista | Lista, tablero, cronograma (de pago) | Lista |
| Carpeta | Ninguna o una existente | Ninguna |
| Tipo | Tareas (hay un selector con más opciones) | Tareas |
| Mostrar en listas inteligentes | Selector | Todas las tareas |

El formulario incluye una vista previa de la lista. Al crearla, la app navega a ella.

## Reglas

- El contador de la barra lateral cuenta solo las pendientes: al completar una tarea bajó de 8 a 7.
- Las tareas de una lista propia también cuentan en Todas, Hoy y Próximos 7 días si cumplen la fecha y la lista está incluida.
- Las completadas se agrupan al final de la lista, en un grupo plegable.
- Las tareas nuevas quedan arriba.
- Sin ninguna lista, la sección muestra un texto de ayuda.

## Acciones sobre una lista

| Origen | Acciones |
|---|---|
| Menú contextual | Editar, fijar, duplicar, compartir, archivar, borrar |
| Menú de cabecera | Cambiar vista, ocultar completadas, mostrar detalles, opciones de vista, añadir sección, compartir, actividad, imprimir |
| Botón de orden | Agrupar por y ordenar por; ambos arrancan en orden personalizado |

## Borrar una lista

La app pide confirmación con el nombre de la lista y avisa que sus tareas también se borran.

Observado al borrar la lista de prueba:

- La lista desaparece de la barra lateral y los contadores se recalculan, incluidos los de etiquetas.
- Sus tareas pasan a la papelera, tanto las pendientes como las completadas.

Falta observar qué ocurre al restaurar una de esas tareas, ya que su lista ya no existe.

**Propuesta para Andamia:** restaurarla en la bandeja de entrada.

## Etiquetas

- Se muestran con color en la tarea y en la barra lateral, y con contador de pendientes.
- La búsqueda de una etiqueta no distingue mayúsculas: `#otro` coincide con una etiqueta llamada `Otro`.
- Se guardan en minúsculas y se muestran con su forma original.
- No se observaron etiquetas anidadas ni su creación desde la barra lateral.

## Carpetas

La cuenta no tenía carpetas; solo se vio el selector en el formulario.

**Propuesta:** una carpeta agrupa listas, se pliega en la barra lateral y al borrarla sus listas quedan sueltas.

## Límites del plan gratuito observados

Solo como referencia: 9 listas, 99 tareas por lista, 19 subtareas por tarea, 2 recordatorios por tarea. **Andamia no los replicará.**

## Casos límite

| Caso | Comportamiento |
|---|---|
| Nombre de lista vacío | No observado. Propuesta: desactivar el botón de crear |
| Nombre de más de 64 caracteres | El campo limita la longitud |
| Nombres repetidos | No observado |

## Atajos

Ver [atajos.md](atajos.md): G, I para la bandeja y V para cambiar la vista.
