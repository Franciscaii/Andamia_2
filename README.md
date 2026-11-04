# Andamia

Gestor de tareas personal, con interfaz en español, que guarda los datos en tu navegador. No necesita cuenta ni servidor.

La especificación está en [docs/investigacion/](docs/investigacion/README.md).

## Instalar y ejecutar

Requiere Node.js 22 o superior.

```bash
npm install
```

```bash
npm run dev
```

Después abre <http://localhost:5173>.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia la app en modo desarrollo |
| `npm run build` | Revisa los tipos y genera la versión final en `dist/` |
| `npm run preview` | Sirve la versión de `dist/` |
| `npm test` | Ejecuta las pruebas de lógica |
| `npm run test:e2e` | Ejecuta los flujos de punta a punta; requiere Google Chrome instalado |

## Funciones

| Área | Incluye |
|---|---|
| Organización | Bandeja de entrada, listas con color, carpetas y etiquetas |
| Vistas | Todas, Hoy, Mañana, Próximos 7 días, Completadas, Papelera |
| Tareas | Título, notas, fecha y hora, cuatro prioridades, etiquetas y subtareas |
| Papelera | Las tareas borradas se pueden restaurar o eliminar para siempre |
| Búsqueda | En títulos, notas y subtareas, sin distinguir mayúsculas ni acentos, con filtros |
| Orden | Arrastrar con el ratón o con el teclado |
| Apariencia | Tema claro y oscuro; se adapta a móviles |

## Entrada rápida

Escribe la tarea y los datos en una sola línea. Antes de crearla verás lo que se reconoció.

```text
Enviar informe mañana 9am !alta #trabajo ~Oficina
```

| Dato | Ejemplos |
|---|---|
| Día | `hoy`, `mañana`, `pasado mañana`, `ayer`, `el viernes`, `en 3 días`, `en 2 semanas` |
| Fecha | `20 de diciembre`, `25/12` |
| Hora | `9am`, `9:30 pm`, `18:30`, `a las 10`, `a las 6 de la tarde` |
| Prioridad | `!alta`, `!media`, `!baja`, `!ninguna` |
| Etiqueta | `#trabajo`; se crea si no existe |
| Lista | `~Oficina`; debe existir, y admite nombres con espacios |

Reglas:

- Un día de la semana es siempre su próxima ocurrencia: `lunes` dicho un lunes es dentro de 7 días.
- Una hora sin día es para hoy, o para mañana si ya pasó.
- La tarea se crea en la lista o vista abierta, salvo que el texto indique otra cosa.

## Atajos

| Tecla | Acción |
|---|---|
| `N` | Ir al campo de nueva tarea |
| `/` | Abrir la búsqueda |
| `Esc` | Cerrar el detalle o un diálogo |
| `Espacio` y flechas, sobre el asa de una tarea | Reordenar |

## Tus datos

- Se guardan en IndexedDB, solo en este navegador y en este equipo.
- Borrar los datos del sitio en el navegador también borra tus tareas.
- Otro navegador u otro puerto ven una base de datos distinta.
- Aún no hay copia de seguridad ni exportación.

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/modelos` | Tipos de datos |
| `src/datos` | Base de datos, repositorio y estado de la app |
| `src/logica` | Entrada rápida, vistas, búsqueda, fechas y rutas |
| `src/vistas` | Pantallas |
| `src/componentes` | Piezas de la interfaz |
| `tests/unit` | Pruebas de lógica |
| `tests/e2e` | Flujos de punta a punta |

## Pendiente

Repetición, recordatorios, Kanban, calendario, matriz de Eisenhower, Pomodoro, hábitos, resumen, filtros guardados, renombrar etiquetas, reordenar listas y subtareas, y exportar datos.
