import { useEffect, useState } from "react";
import { VISTAS_INTELIGENTES, type VistaInteligente } from "./vistas";

export type Seccion =
  | { tipo: "vista"; vista: VistaInteligente }
  | { tipo: "lista"; id: string }
  | { tipo: "etiqueta"; nombre: string }
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
}

/** Pantalla de inicio. Hoy, Mañana, Todas y Bandeja ya no están en el menú, aunque sus direcciones siguen funcionando. */
export const INICIO: Seccion = { tipo: "vista", vista: "semana" };

export function leerRuta(hash: string): Ruta {
  const partes = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const iT = partes.indexOf("t");
  const tareaId = iT >= 0 ? partes[iT + 1] ?? null : null;
  const [a, b] = iT >= 0 ? partes.slice(0, iT) : partes;
  if (a === "tareas" && VISTAS_INTELIGENTES.some((v) => v.id === b)) {
    return { seccion: { tipo: "vista", vista: b as VistaInteligente }, tareaId };
  }
  if (a === "listas" && b) return { seccion: { tipo: "lista", id: b }, tareaId };
  if (a === "etiquetas" && b) return { seccion: { tipo: "etiqueta", nombre: b }, tareaId };
  if (a === "calendario") return { seccion: { tipo: "calendario", modo: b === "semana" ? "semana" : "mes" }, tareaId };
  if (a === "matriz" || a === "enfoque" || a === "habitos" || a === "ajustes" || a === "tema" || a === "widgets") return { seccion: { tipo: a }, tareaId };
  if (a === "buscar") return { seccion: { tipo: "buscar" }, tareaId };
  if (a === "estadisticas") return { seccion: { tipo: "estadisticas", de: b === "habitos" ? "habitos" : "tareas" }, tareaId };
  return { seccion: INICIO, tareaId };
}

export function hashDe(seccion: Seccion, tareaId: string | null = null): string {
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

export function irA(seccion: Seccion, tareaId: string | null = null): void {
  window.location.hash = hashDe(seccion, tareaId);
}
