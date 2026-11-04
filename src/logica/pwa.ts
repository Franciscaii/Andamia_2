import type { Tarea } from "../modelos/tipos";
import { claveAviso, momentoDeAviso } from "./recordatorios";

const CACHE_META = "andamia-meta";
const CLAVE_BASE = "/__base-activa";
const ETIQUETA_REVISION = "andamia-avisos";

export interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let eventoInstalacion: EventoInstalacion | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((o) => o());

export function registrarPwa(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoInstalacion = e as EventoInstalacion;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    eventoInstalacion = null;
    avisar();
  });
  // Solo en la versión final: en desarrollo una caché estorbaría los cambios.
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/sw.js").then(() => activarRevisionPeriodica());
  }
}

export const sePuedeInstalar = () => eventoInstalacion !== null;
export const estaInstalada = () => typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;

export function alCambiarInstalacion(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export async function instalar(): Promise<void> {
  const e = eventoInstalacion;
  if (!e) return;
  await e.prompt();
  await e.userChoice;
  eventoInstalacion = null;
  avisar();
}

/** Le dice al service worker qué base revisar cuando la app esté cerrada. */
export async function anotarBaseActiva(nombre: string): Promise<void> {
  if (!("caches" in window)) return;
  try {
    await (await caches.open(CACHE_META)).put(CLAVE_BASE, new Response(nombre));
  } catch {
    // Sin caché, la revisión en segundo plano usa la base local.
  }
}

/** Solo existe en Chrome o Edge con la app instalada, y el navegador decide la frecuencia. */
export async function activarRevisionPeriodica(): Promise<boolean> {
  try {
    const registro = (await navigator.serviceWorker?.ready) as ServiceWorkerRegistration & { periodicSync?: { register: (t: string, o: { minInterval: number }) => Promise<void> } };
    if (!registro?.periodicSync) return false;
    const permiso = await navigator.permissions.query({ name: "periodic-background-sync" as PermissionName });
    if (permiso.state !== "granted") return false;
    await registro.periodicSync.register(ETIQUETA_REVISION, { minInterval: 60 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}

/** Usa el service worker si lo hay: en Android, `new Notification` no funciona. */
export async function mostrarNotificacion(titulo: string, cuerpo: string, clave: string, url: string, alPulsar: () => void): Promise<void> {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const registro = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (registro) {
    await registro.showNotification(titulo, { body: cuerpo, tag: clave, icon: "/iconos/icono-192.png", data: { url } });
    return;
  }
  const n = new Notification(titulo, { body: cuerpo, tag: clave });
  n.onclick = () => {
    window.focus();
    alPulsar();
    n.close();
  };
}

const LIMITE_TRIGGERS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Programa avisos en el propio navegador donde exista esa función experimental.
 * Hoy casi ningún navegador la tiene: sin ella no hace nada.
 */
export async function programarAvisos(tareas: Tarea[], ahora: Date = new Date()): Promise<number> {
  const Disparador = (window as unknown as { TimestampTrigger?: new (t: number) => unknown }).TimestampTrigger;
  if (!Disparador || !("Notification" in window) || Notification.permission !== "granted") return 0;
  const registro = await navigator.serviceWorker?.getRegistration();
  if (!registro) return 0;
  let programados = 0;
  for (const t of tareas) {
    if (t.eliminadaEn !== null || t.estado !== "pendiente") continue;
    for (const r of t.recordatorios) {
      const momento = momentoDeAviso(t, r);
      if (!momento || momento <= ahora || momento.getTime() - ahora.getTime() > LIMITE_TRIGGERS_MS) continue;
      await registro.showNotification(t.titulo || "Recordatorio", { tag: claveAviso(t, r), icon: "/iconos/icono-192.png", data: { url: "/" }, showTrigger: new Disparador(momento.getTime()) } as NotificationOptions);
      programados += 1;
    }
  }
  return programados;
}
