# Firebase paso a paso

Esta guía conecta Andamia con tu propio proyecto de Firebase en el plan gratuito (Spark), para tener cuentas y sincronización entre dispositivos. Toma unos 20 minutos.

Sin este paso Andamia funciona igual, pero solo en un navegador y sin cuenta.

## Antes de empezar

| Necesitas | Detalle |
|---|---|
| Una cuenta de Google | Con ella entras a Firebase |
| Tarjeta de crédito | **No hace falta**: el plan Spark no la pide |

Los datos de la app web (paso 2) no son secretos: identifican tu proyecto y viajan en la página. Lo que protege tus datos son las reglas de seguridad del paso 6.

## 1. Crear el proyecto

1. Entra a <https://console.firebase.google.com>.
2. Pulsa **Crear un proyecto** o **Agregar proyecto**.
3. Escribe un nombre, por ejemplo `andamia`, y anota el **ID del proyecto** que aparece debajo.
4. Google Analytics no es necesario: puedes desactivarlo.
5. Comprueba que el plan diga **Spark**. Si la consola te ofrece pasar a Blaze, no aceptes.

## 2. Registrar la app web

1. En la página del proyecto, pulsa el icono **`</>`** (Web).
2. Ponle un apodo, por ejemplo `Andamia web`.
3. Marca **Configurar Firebase Hosting** si te lo ofrece. No es obligatorio.
4. Copia los valores de `firebaseConfig`. Los usarás en el paso 5.

## 3. Activar el inicio de sesión

1. En el menú, entra a **Compilación → Authentication** y pulsa **Comenzar**.
2. En **Método de acceso**, activa **Correo electrónico/contraseña**. No hace falta el enlace sin contraseña.
3. Activa también **Google**: elige tu correo de asistencia y guarda.

## 4. Crear la base de datos

1. Entra a **Compilación → Firestore Database** y pulsa **Crear base de datos**.
2. Elige la edición **Standard** si te la pregunta.
3. En la ubicación, elige **`southamerica-west1` (Santiago)** si estás en Chile. **No se puede cambiar después.**
4. Elige **Iniciar en modo de producción**. Así todo queda bloqueado hasta publicar las reglas del paso 6.

## 5. Copiar la configuración

En la carpeta `Andamia`, copia la plantilla:

```bash
copy .env.example .env.local
```

Abre `.env.local` y completa los valores del paso 2:

| Variable | Valor de `firebaseConfig` |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

Git ignora `.env.local`, así que no se sube al repositorio.

Después copia también `.firebaserc.example` como `.firebaserc`, y cambia `id-de-tu-proyecto` por tu ID:

```bash
copy .firebaserc.example .firebaserc
```

## 6. Iniciar sesión en la CLI y publicar las reglas

La CLI de Firebase ya está instalada dentro del proyecto. Abre una terminal en la carpeta `Andamia`:

```bash
npx firebase login
```

Se abre el navegador para autorizar con tu cuenta de Google. Luego publica las reglas:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes
```

**No te saltes este paso.** Sin reglas publicadas, Firestore rechaza todas las escrituras y la app mostrará un aviso de error.

## 7. Probar en tu equipo

1. Reinicia `npm run dev` para que lea `.env.local`.
2. Abre <http://localhost:5173> y entra a **Cuenta y ajustes**.
3. Crea una cuenta.
4. Si tenías datos sin cuenta, la app te ofrece copiarlos.
5. Abre la misma dirección en otro navegador, entra con la misma cuenta y crea una tarea: debe aparecer en el primero.
6. En la consola de Firebase, en **Firestore Database**, verás tus datos bajo `users`.

## 8. Publicar en internet

Esto deja la app disponible en una dirección pública. Tus datos siguen protegidos por tu cuenta, pero cualquiera puede abrir la página y crear su propia cuenta.

```bash
npm run deploy
```

Al terminar verás una dirección como `https://tu-proyecto.web.app`:

- Ábrela en el móvil, inicia sesión e instala la app desde el menú del navegador.
- Si usarás Google para entrar, confirma que ese dominio aparezca en **Authentication → Configuración → Dominios autorizados**. Los de `web.app` y `firebaseapp.com` se agregan solos.

Para evitar que otras personas creen cuentas en tu proyecto, cuando ya tengas la tuya entra a **Authentication → Configuración → Acciones del usuario** y desactiva **Habilitar la creación (registro)**.

## 9. Clave VAPID para Cloud Messaging (opcional)

Hoy no aporta avisos nuevos, porque **enviar avisos programados requiere Cloud Functions, que no están en el plan Spark**. Solo deja listo el registro de dispositivos para el futuro.

1. Entra a **Configuración del proyecto → Cloud Messaging**.
2. En **Certificados push web**, pulsa **Generar par de claves**.
3. Copia la clave pública en `.env.local`, como `VITE_FIREBASE_VAPID_KEY`.

## Límites del plan gratuito

| Recurso | Límite aproximado |
|---|---|
| Almacenamiento de Firestore | 1 GiB |
| Lecturas | 50.000 al día |
| Escrituras | 20.000 al día |
| Borrados | 20.000 al día |
| Hosting | 10 GB guardados y 360 MB de descarga al día |

Revisa los valores vigentes en la página de precios de Firebase, porque pueden cambiar. Para uso personal, Andamia no debería acercarse a ellos: agrupa las ediciones seguidas en una sola escritura. Si llegaras al límite, Firebase detiene las operaciones hasta el día siguiente sin cobrarte, y la app sigue funcionando sin conexión.

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| Cuenta y ajustes dice que las cuentas no están configuradas | Falta `.env.local`, o no reiniciaste `npm run dev` |
| "Firebase rechazó el cambio" | No publicaste las reglas del paso 6 |
| "Este método de acceso no está activado" | Falta activarlo en el paso 3 |
| La ventana de Google no abre | El navegador la bloqueó; permítela para este sitio |
| Google da error de dominio no autorizado | Agrega el dominio en **Dominios autorizados** |

## Para desarrollar sin tocar el proyecto real

Los emuladores corren en tu equipo y no usan internet ni tu cuenta. Necesitan Java 21 o superior. Si no lo tienes en el sistema, los scripts usan el que trae Android Studio.

| Comando | Qué hace |
|---|---|
| `npm run emuladores` | Inicia los emuladores de Authentication y Firestore |
| `npm run test:reglas` | Prueba las reglas de seguridad |
| `npm run test:e2e` | Prueba los flujos, incluidos los de Firebase |
