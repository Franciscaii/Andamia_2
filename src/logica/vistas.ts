import type { Lista, Tarea } from "../modelos/tipos";
import { diasHasta } from "./fechas";

export type VistaInteligente = "todas" | "hoy" | "manana" | "semana" | "bandeja" | "completadas" | "papelera";

export const VISTAS_INTELIGENTES: { id: VistaInteligente; nombre: string }[] = [
  { id: "todas", nombre: "Todas" },
  { id: "hoy", nombre: "Hoy" },
  { id: "manana", nombre: "Mañana" },
  { id: "semana", nombre: "Semana" },
  { id: "bandeja", nombre: "Bandeja de entrada" },
  { id: "completadas", nombre: "Completadas" },
  { id: "papelera", nombre: "Papelera" },
];

export interface Grupo {
  id: string;
  nombre: string;
  tareas: Tarea[];
  atenuado?: boolean;
}

const porOrden = (a: Tarea, b: Tarea) => a.orden - b.orden;

export const estaActiva = (t: Tarea) => t.eliminadaEn === null;
export const estaPendiente = (t: Tarea) => t.eliminadaEn === null && t.estado === "pendiente";

/** Listas cuyas tareas no deben aparecer en las vistas inteligentes. */
function idsExcluidos(listas: Lista[]): Set<string> {
  return new Set(listas.filter((l) => !l.incluirEnTodas).map((l) => l.id));
}

export function tareasDeVista(tareas: Tarea[], vista: VistaInteligente, listas: Lista[], ahora: Date = new Date()): Tarea[] {
  const excluidas = idsExcluidos(listas);
  const pendientes = tareas.filter((t) => estaPendiente(t) && !excluidas.has(t.listaId));
  const dias = (t: Tarea) => diasHasta(t, ahora);
  switch (vista) {
    case "todas":
      return pendientes.sort(porOrden);
    case "hoy":
      // Decisión de Andamia: lo atrasado sigue a la vista hasta resolverse.
      return pendientes.filter((t) => { const d = dias(t); return d !== null && d <= 0; }).sort(porOrden);
    case "manana":
      return pendientes.filter((t) => dias(t) === 1).sort(porOrden);
    case "semana":
      return pendientes.filter((t) => { const d = dias(t); return d !== null && d <= 6; }).sort(porOrden);
    case "bandeja":
      return tareas.filter((t) => estaPendiente(t) && t.listaId === "bandeja").sort(porOrden);
    case "completadas":
      return tareas
        .filter((t) => estaActiva(t) && t.estado === "completada")
        .sort((a, b) => (b.completadaEn ?? "").localeCompare(a.completadaEn ?? ""));
    case "papelera":
      return tareas
        .filter((t) => t.eliminadaEn !== null)
        .sort((a, b) => (b.eliminadaEn ?? "").localeCompare(a.eliminadaEn ?? ""));
  }
}

export function contarVista(tareas: Tarea[], vista: VistaInteligente, listas: Lista[], ahora: Date = new Date()): number {
  return tareasDeVista(tareas, vista, listas, ahora).length;
}

/** Agrupa por cercanía de la fecha. Omite los grupos vacíos. */
export function agruparPorFecha(tareas: Tarea[], ahora: Date = new Date()): Grupo[] {
  const definicion: { id: string; nombre: string; cumple: (d: number | null) => boolean }[] = [
    { id: "atrasadas", nombre: "Atrasadas", cumple: (d) => d !== null && d < 0 },
    { id: "hoy", nombre: "Hoy", cumple: (d) => d === 0 },
    { id: "manana", nombre: "Mañana", cumple: (d) => d === 1 },
    { id: "semana", nombre: "Próximos 7 días", cumple: (d) => d !== null && d >= 2 && d <= 6 },
    { id: "despues", nombre: "Más adelante", cumple: (d) => d !== null && d > 6 },
    { id: "sin-fecha", nombre: "Sin fecha", cumple: (d) => d === null },
  ];
  return definicion
    .map(({ id, nombre, cumple }) => ({ id, nombre, tareas: tareas.filter((t) => cumple(diasHasta(t, ahora))) }))
    .filter((g) => g.tareas.length > 0);
}

/** Calcula el orden al mover una tarea entre dos vecinas; pide renumerar si no hay hueco. */
export function ordenEntre(anterior: number | null, siguiente: number | null): number | null {
  if (anterior === null && siguiente === null) return 0;
  if (anterior === null) return (siguiente as number) - 1024;
  if (siguiente === null) return anterior + 1024;
  const medio = (anterior + siguiente) / 2;
  return medio > anterior && medio < siguiente ? medio : null;
}
