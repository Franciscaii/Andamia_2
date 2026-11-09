# Apps de Andamia para Windows y Android

Las dos apps usan la misma cuenta y el mismo Firebase que la web (andamia-85eab).

## App de PC (Windows) — carpeta `escritorio/`

Abre la Andamia publicada (https://andamia-85eab.web.app) en su propia ventana, así que
**se actualiza sola** cada vez que se publica la web. Agrega:

- Ícono junto al reloj (bandeja). Cerrar la ventana la esconde ahí; "Salir" la cierra.
- Atajo global **Ctrl + Alt + N**: abre "Hoy" con el cursor en "Añadir tarea".
- **Modo escritorio** (tipo widget): ventana chica con "Hoy", detrás de las demás ventanas; vuelve sola tras Windows + D y recuerda dónde la dejaste.
- **Modo mini**: ventana chica, siempre encima, en la esquina de abajo a la derecha.
- Opción **Abrir al iniciar Windows** (arranca escondida en la bandeja).

Comandos (PowerShell, dentro de `Andamia`):

| Para qué | Comando |
| --- | --- |
| Instalar lo necesario (una vez) | `npm.cmd --prefix escritorio install` |
| Probar sin instalar | `npm.cmd run pc` |
| Crear el instalador .exe | `npm.cmd run pc:instalador` → queda en `escritorio\instaladores` |

Solo hay que crear un instalador nuevo si cambia `escritorio/principal.cjs`, no cuando cambia la web.

## App de Android — carpeta `android/`

Los archivos de Andamia van **dentro** de la app. Cuando cambie la web hay que crear un `.apk`
nuevo e instalarlo encima del anterior (los datos están en Firebase y no se pierden).

El `.apk` se crea gratis en GitHub Actions (archivo `.github/workflows/android.yml`):
pestaña **Actions** → **App de Android** → **Run workflow**, y al terminar se descarga
`Andamia-Android` desde la sección *Artifacts*.

La configuración pública de Firebase va en `.env.android`. La llave de firma va en dos secretos
del repositorio (Settings → Secrets and variables → Actions): `ANDAMIA_LLAVE_BASE64` (la llave .jks
en base64) y `ANDAMIA_LLAVE_CLAVE` (su contraseña).

**La llave de firma (`andamia-android.jks`) y su contraseña no van en el repositorio.**
Sin ellas no se puede actualizar la app instalada.

Cambios en el código web para la app de Android (`src/logica/plataforma.ts`):

- No registra el service worker (no hace falta dentro de la app).
- Inicia Firebase Auth con `initializeAuth` + IndexedDB (sin ventanas emergentes).
- Oculta "Continuar con Google" y el botón "Instalar".
- El botón "atrás" del teléfono vuelve atrás o deja la app en segundo plano.

## Widget "Hoy" de Android

Muestra las tareas de hoy y las atrasadas (hasta 30). Tocar el círculo la marca como hecha: el widget la quita al tiro y la app la completa en Andamia la próxima vez que se abra. Tocar el texto abre la tarea; el "+" abre "Añadir tarea".

La app le envía las tareas al widget cada vez que cambian (`src/logica/widgetAndroid.ts`). Si la app no se abre en todo el día, el widget muestra la lista del día anterior y lo indica en el título.
