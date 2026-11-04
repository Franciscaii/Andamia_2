import { defineConfig } from "@playwright/test";
import { entornoConJava } from "./scripts/con-java.mjs";

const entornoJava = entornoConJava();

// Sin estos valores, las pruebas sin cuenta ignoran un .env.local con el proyecto real.
const SIN_FIREBASE = { VITE_FIREBASE_API_KEY: "", VITE_FIREBASE_PROJECT_ID: "", VITE_FIREBASE_EMULADORES: "" };

const CON_EMULADORES = {
  VITE_FIREBASE_API_KEY: "clave-falsa-de-prueba",
  VITE_FIREBASE_PROJECT_ID: "demo-andamia",
  VITE_FIREBASE_AUTH_DOMAIN: "demo-andamia.firebaseapp.com",
  VITE_FIREBASE_APP_ID: "demo",
  VITE_FIREBASE_EMULADORES: "si",
};

if (!entornoJava) console.warn("Sin Java: se omiten los flujos con los emuladores de Firebase.");

// Usa el Chrome ya instalado en el equipo para no descargar navegadores.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  // Los arrastres son sensibles al tiempo: en serie no compiten por el equipo.
  workers: 1,
  reporter: "list",
  use: {
    channel: "chrome",
    locale: "es-CL",
    timezoneId: "America/Santiago",
  },
  projects: [
    { name: "local", testMatch: /(flujo|fase3|fase4|copia)\.spec\.ts/, use: { baseURL: "http://127.0.0.1:5199" } },
    { name: "pwa", testMatch: /pwa\.spec\.ts/, use: { baseURL: "http://127.0.0.1:4179" } },
    ...(entornoJava ? [{ name: "firebase", testMatch: /firebase\.spec\.ts/, use: { baseURL: "http://127.0.0.1:5198" } }] : []),
  ],
  webServer: [
    {
      command: "npx vite --port 5199 --strictPort --host 127.0.0.1",
      url: "http://127.0.0.1:5199",
      reuseExistingServer: false,
      timeout: 60_000,
      env: SIN_FIREBASE,
    },
    {
      command: "npx vite build --outDir dist-pruebas --emptyOutDir && npx vite preview --outDir dist-pruebas --port 4179 --strictPort --host 127.0.0.1",
      url: "http://127.0.0.1:4179",
      reuseExistingServer: false,
      timeout: 120_000,
      env: SIN_FIREBASE,
    },
    ...(entornoJava
      ? [
          {
            command: "npx firebase emulators:start --project demo-andamia --only auth,firestore",
            url: "http://127.0.0.1:9099",
            reuseExistingServer: false,
            timeout: 120_000,
            env: entornoJava as Record<string, string>,
          },
          {
            command: "npx vite --port 5198 --strictPort --host 127.0.0.1",
            url: "http://127.0.0.1:5198",
            reuseExistingServer: false,
            timeout: 60_000,
            env: CON_EMULADORES,
          },
        ]
      : []),
  ],
});
