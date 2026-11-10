import type { Seccion } from "./ruta";

/**
 * Widgets del escritorio (app de PC): cada widget es una ventana chica sin bordes que
 * abre Andamia con ?widget=<tipo>. Ahí no hay menú lateral, solo una barra para moverla.
 */
export type TipoWidget = "semana" | "calendario" | "matriz" | "estadistica-tareas" | "estadistica-habitos";

/** `ancho` y `alto`: tamaño en que el contenido se ve a escala normal; al achicar o agrandar el widget, el contenido se escala con él. */
export const WIDGETS: { id: TipoWidget; nombre: string; seccion: Seccion; ancho: number; alto: number; soloAncho?: boolean }[] = [
  { id: "semana", nombre: "Semana", seccion: { tipo: "vista", vista: "semana" }, ancho: 1040, alto: 620, soloAncho: true },
  { id: "calendario", nombre: "Calendario", seccion: { tipo: "calendario", modo: "mes" }, ancho: 520, alto: 520 },
  { id: "matriz", nombre: "Matriz", seccion: { tipo: "matriz" }, ancho: 560, alto: 560 },
  { id: "estadistica-tareas", nombre: "Estadística Tareas", seccion: { tipo: "estadisticas", de: "tareas" }, ancho: 380, alto: 560 },
  { id: "estadistica-habitos", nombre: "Estadística Hábitos", seccion: { tipo: "estadisticas", de: "habitos" }, ancho: 380, alto: 560 },
];

/** La Semana del widget avisa con este evento cuánto mide su contenido en pantalla (a la escala actual). */
export const EVENTO_ALTO_WIDGET = "andamia-alto-widget";

/**
 * Escala del widget Semana: la del ancho, pero más chica si hace falta para que todo el contenido
 * (que a escala 1 mide `altoNatural`) quepa en `altoTope`. Nunca menos que ESCALA_MINIMA.
 */
export function escalaQueCabe(base: { ancho: number }, ancho: number, altoNatural: number | null, altoTope: number): number {
  if (ancho <= 0) return 1;
  let e = ancho / base.ancho;
  if (altoNatural && altoNatural > 0 && altoTope > 0) e = Math.min(e, altoTope / altoNatural);
  return Math.floor(Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, e)) * 100) / 100;
}

export const ESCALA_MINIMA = 0.45;
export const ESCALA_MAXIMA = 1.3;

/** Cuánto escalar el contenido para que quepa en un widget de ese tamaño. */
export function escalaWidget(base: { ancho: number; alto: number; soloAncho?: boolean }, ancho: number, alto: number): number {
  if (ancho <= 0 || alto <= 0) return 1;
  // Semana: el alto de la ventana se ajusta al contenido, así que la escala la manda solo el ancho.
  const e = base.soloAncho ? ancho / base.ancho : Math.min(ancho / base.ancho, alto / base.alto);
  return Math.round(Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, e)) * 100) / 100;
}

export function widgetDeDireccion(busqueda: string): (typeof WIDGETS)[number] | null {
  const id = new URLSearchParams(busqueda).get("widget");
  return WIDGETS.find((w) => w.id === id) ?? null;
}

/** El widget de esta ventana, si es una. */
export const WIDGET_ACTUAL = typeof window === "undefined" ? null : widgetDeDireccion(window.location.search);
