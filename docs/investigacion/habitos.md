# Hábitos

**Cobertura baja.** La cuenta no tenía hábitos y crear uno quedaba fuera de lo autorizado. Se vieron la pantalla vacía y el formulario, sin guardar.

## Observado

### Pantalla

| Elemento | Detalle |
|---|---|
| Cabecera | Título con menú desplegable, cambio de vista, añadir y opciones |
| Franja semanal | Últimos siete días, con el día de la semana y su número |
| Estado vacío | Ilustración con invitación a crear un hábito |

### Formulario de creación

| Campo | Valor por defecto |
|---|---|
| Icono | Uno predefinido, editable |
| Nombre | Vacío, con texto de ejemplo |
| Frecuencia | Diaria |
| Meta | Cumplirlo completo |
| Fecha de inicio | Hoy |
| Días objetivo | Para siempre |
| Sección | Otros |
| Recordatorios | Ninguno; botón para añadir |
| Registro emergente | Casilla desactivada |

Las secciones existen como entidad. Las preferencias permiten mostrar hábitos en el calendario y en Hoy, y elegir su orden. El plan gratuito permite 5 hábitos.

## Propuesta para Andamia

| Regla | Propuesta |
|---|---|
| Registrar | Un clic en el día marca el hábito como cumplido |
| Meta numérica | Registrar cantidad y unidad; cumplido al alcanzar la meta |
| Omitir o fallar | Estados distintos de "sin registro" |
| Racha | Días seguidos cumplidos según la frecuencia; los días no programados no la rompen |
| Días pasados | Se pueden editar; los futuros no |
| Archivar | Oculta el hábito y conserva su historial |
| Estadísticas | Racha actual, mejor racha, porcentaje y calendario mensual |

## Casos límite por decidir

| Caso | Propuesta |
|---|---|
| Cambiar la frecuencia con historial | Conservar registros y recalcular desde el cambio |
| Hábito semanal con cantidad de días | La racha se cuenta por semanas |
| Días anteriores a la fecha de inicio | No se pueden registrar |
| Días objetivo cumplidos | Mostrar logro y ofrecer archivar |

## Atajos

No traen atajo por defecto; el panel permite asignar uno para ir a hábitos. Ver [atajos.md](atajos.md).
