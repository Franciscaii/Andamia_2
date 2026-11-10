import type { Seccion } from "./ruta";

/**
 * Widgets del escritorio (app de PC): cada widget es una ventana chica sin bordes que
 * abre Andamia con ?widget=<tipo>. Ahí no hay menú lateral, solo una barra para moverla.
 */
export type TipoWidget = "semana" | "calendario" | "matriz" | "estadistica-tareas" | "estadistica-habitos";

export const WIDGETS: { id: TipoWidget; nombre: string; seccion: Seccion }[] = [
  { id: "semana", nombre: "Semana", seccion: { tipo: "vista", vista: "semana" } },
  { id: "calendario", nombre: "Calendario", seccion: { tipo: "calendario", modo: "mes" } },
  { id: "matriz", nombre: "Matriz", seccion: { tipo: "matriz" } },
  { id: "estadistica-tareas", nombre: "Estadística Tareas", seccion: { tipo: "estadisticas", de: "tareas" } },
  { id: "estadistica-habitos", nombre: "Estadística Hábitos", seccion: { tipo: "estadisticas", de: "habitos" } },
];

export function widgetDeDireccion(busqueda: string): (typeof WIDGETS)[number] | null {
  const id = new URLSearchParams(busqueda).get("widget");
  return WIDGETS.find((w) => w.id === id) ?? null;
}

/** El widget de esta ventana, si es una. */
export const WIDGET_ACTUAL = typeof window === "undefined" ? null : widgetDeDireccion(window.location.search);
