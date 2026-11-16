import { useEffect, useState } from "react";
import { VISTAS_INTELIGENTES, type VistaInteligente } from "./vistas";

export type Seccion =
  | { tipo: "vista"; vista: VistaInteligente }
  | { tipo: "lista"; id: string }
  | { tipo: "etiqueta"; nombre: string }
  /** Todas las etiquetas: aquí se crean, editan y eliminan. */
  | { tipo: "etiquetas" }
  | { tipo: "calendario"; modo: ModoCalendario }
  | { tipo: "matriz" }
  | { tipo: "enfoque" }
  | { tipo: "habitos" }
  | { tipo: "ajustes" }
  | { tipo: "tema" }
  | { tipo: "widgets" }
  | { tipo: "buscar" }
  | { tipo: "estadisticas"; de: "tareas" | "habitos" };

export type ModoCalendario = "mes" | "semana";

export interface Ruta {
  seccion: Seccion;
  tareaId: string | null;
  /** Hábito cuyo detalle está abierto al costado (desde la Semana). */
  habitoId: string | null;
}

/** Pantalla de inicio. Hoy, Mañana, Todas y Bandeja ya no están en el menú, aunque sus direcciones siguen funcionando. */
export const INICIO: Seccion = { tipo: "vista", vista: "semana" };

export function leerRuta(hash: string): Ruta {
  const partes = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const iT = partes.indexOf("t");
  const iH = iT >= 0 ? -1 : partes.indexOf("h");
  const tareaId = iT >= 0 ? partes[iT + 1] ?? null : null;
  const habitoId = iH >= 0 ? partes[iH + 1] ?? null : null;
  const [a, b] = iT >= 0 ? partes.slice(0, iT) : iH >= 0 ? partes.slice(0, iH) : partes;
  if (a === "tareas" && VISTAS_INTELIGENTES.some((v) => v.id === b)) {
    return { seccion: { tipo: "vista", vista: b as VistaInteligente }, tareaId, habitoId };
  }
  if (a === "listas" && b) return { seccion: { tipo: "lista", id: b }, tareaId, habitoId };
  if (a === "etiquetas" && b) return { seccion: { tipo: "etiqueta", nombre: b }, tareaId, habitoId };
  if (a === "etiquetas") return { seccion: { tipo: "etiquetas" }, tareaId, habitoId };
  if (a === "calendario") return { seccion: { tipo: "calendario", modo: b === "semana" ? "semana" : "mes" }, tareaId, habitoId };
  if (a === "matriz" || a === "enfoque" || a === "habitos" || a === "ajustes" || a === "tema" || a === "widgets") return { seccion: { tipo: a }, tareaId, habitoId };
  if (a === "buscar") return { seccion: { tipo: "buscar" }, tareaId, habitoId };
  if (a === "estadisticas") return { seccion: { tipo: "estadisticas", de: b === "habitos" ? "habitos" : "tareas" }, tareaId, habitoId };
  return { seccion: INICIO, tareaId, habitoId };
}

export function hashDe(seccion: Seccion, tareaId: string | null = null, habitoId: string | null = null): string {
  let base: string;
  switch (seccion.tipo) {
    case "vista":
      base = `#/tareas/${seccion.vista}`;
      break;
    case "lista":
      base = `#/listas/${encodeURIComponent(seccion.id)}`;
      break;
    case "etiqueta":
      base = `#/etiquetas/${encodeURIComponent(seccion.nombre)}`;
      break;
    case "calendario":
      base = `#/calendario/${seccion.modo}`;
      break;
    case "etiquetas":
    case "matriz":
    case "enfoque":
    case "habitos":
    case "ajustes":
    case "tema":
    case "widgets":
      base = `#/${seccion.tipo}`;
      break;
    case "buscar":
      base = "#/buscar";
      break;
    case "estadisticas":
      base = `#/estadisticas/${seccion.de}`;
      break;
  }
  if (habitoId) return `${base}/h/${encodeURIComponent(habitoId)}`;
  return tareaId ? `${base}/t/${encodeURIComponent(tareaId)}` : base;
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState(() => leerRuta(window.location.hash));
  useEffect(() => {
    const alCambiar = () => setRuta(leerRuta(window.location.hash));
    window.addEventListener("hashchange", alCambiar);
    return () => window.removeEventListener("hashchange", alCambiar);
  }, []);
  return ruta;
}

export function irA(seccion: Seccion, tareaId: string | null = null, habitoId: string | null = null): void {
  window.location.hash = hashDe(seccion, tareaId, habitoId);
}

/** Abre el detalle de una tarea o evento; si ya estaba abierto, lo cierra (se toca de nuevo para esconderlo). */
export function alternarTarea(seccion: Seccion, tareaId: string): void {
  irA(seccion, leerRuta(window.location.hash).tareaId === tareaId ? null : tareaId);
}

/** Lo mismo para el detalle de un hábito. */
export function alternarHabito(seccion: Seccion, habitoId: string): void {
  irA(seccion, null, leerRuta(window.location.hash).habitoId === habitoId ? null : habitoId);
}
