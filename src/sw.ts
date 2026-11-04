/// <reference lib="webworker" />
import Dexie from "dexie";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { avisosDeHabitos } from "./logica/habitos";
import { etiquetaFecha } from "./logica/fechas";
import { avisosPendientes } from "./logica/recordatorios";
import type { Habito, RegistroHabito, Tarea } from "./modelos/tipos";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[] };

const CACHE_META = "andamia-meta";
const CLAVE_BASE = "/__base-activa";
const ETIQUETA_REVISION = "andamia-avisos";

// La app completa queda guardada para funcionar sin conexión.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

self.addEventListener("install", () => void self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

async function abrirOEnfocar(url: string) {
  const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const v of ventanas) {
    await v.focus();
    return v.navigate(url);
  }
  return self.clients.openWindow(url);
}

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(abrirOEnfocar((e.notification.data as { url?: string } | null)?.url ?? "/"));
});

// Preparado para Cloud Messaging: llegaría aquí si algún día un servidor envía avisos.
self.addEventListener("push", (e) => {
  let datos: { notification?: { title?: string; body?: string }; data?: { url?: string } } = {};
  try {
    datos = (e.data?.json() ?? {}) as typeof datos;
  } catch {
    // Un mensaje que no es JSON se muestra con el texto genérico.
  }
  e.waitUntil(
    self.registration.showNotification(datos.notification?.title ?? "Andamia", {
      body: datos.notification?.body,
      icon: "/iconos/icono-192.png",
      data: { url: datos.data?.url ?? "/" },
    }),
  );
});

/**
 * Mejor esfuerzo con la app cerrada: el navegador decide cuándo despierta este
 * código, y puede tardar horas o no hacerlo. No reemplaza a un servidor.
 */
async function revisarAvisos() {
  const guardado = await (await caches.open(CACHE_META)).match(CLAVE_BASE);
  const nombre = guardado ? await guardado.text() : "andamia";
  if (!(await Dexie.exists(nombre))) return;
  const db = await new Dexie(nombre).open();
  try {
    const [tareas, habitos, registros] = await Promise.all([
      db.table("tareas").toArray() as Promise<Tarea[]>,
      db.table("habitos").toArray() as Promise<Habito[]>,
      db.table("registrosHabito").toArray() as Promise<RegistroHabito[]>,
    ]);
    const ahora = new Date();
    for (const a of avisosPendientes(tareas, ahora)) {
      await self.registration.showNotification(a.tarea.titulo || "Recordatorio", {
        body: `Recordatorio: ${etiquetaFecha(a.tarea, ahora)}`,
        tag: a.clave,
        icon: "/iconos/icono-192.png",
        data: { url: "/" },
      });
      await db.table("tareas").update(a.tarea.id, { avisosEnviados: [...a.tarea.avisosEnviados, a.clave] });
    }
    for (const a of avisosDeHabitos(habitos, registros, ahora)) {
      await self.registration.showNotification(a.habito.nombre, {
        body: "Hábito pendiente de hoy",
        tag: a.clave,
        icon: "/iconos/icono-192.png",
        data: { url: "/#/habitos" },
      });
      await db.table("habitos").update(a.habito.id, { avisosEnviados: [a.clave] });
    }
  } finally {
    db.close();
  }
}

self.addEventListener("periodicsync", ((e: Event & { tag: string; waitUntil: (p: Promise<unknown>) => void }) => {
  if (e.tag === ETIQUETA_REVISION) e.waitUntil(revisarAvisos());
}) as EventListener);
