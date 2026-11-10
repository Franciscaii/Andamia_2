import type { Lista, Prioridad, Tarea } from "../modelos/tipos";
import { estaPendiente } from "./vistas";

export type IdCuadrante = "urgente-importante" | "importante" | "urgente" | "ninguno";

export interface Cuadrante {
  id: IdCuadrante;
  nombre: string;
  ayuda: string;
  prioridad: Prioridad;
}

/**
 * Diseño de Andamia: cada cuadrante corresponde a un nivel de prioridad.
 * Orden de la usuaria, de izquierda a derecha y de arriba abajo.
 */
export const CUADRANTES: Cuadrante[] = [
  { id: "urgente-importante", nombre: "Urgente + Importante", ayuda: "Hazlo ahora", prioridad: "alta" },
  { id: "urgente", nombre: "Urgente + No importante", ayuda: "Resuélvelo rápido o delégalo", prioridad: "baja" },
  { id: "importante", nombre: "No urgente + Importante", ayuda: "Suele contribuir a objetivos a largo plazo", prioridad: "media" },
  { id: "ninguno", nombre: "No urgente + No importante", ayuda: "Déjalo para después", prioridad: "ninguna" },
];

export function prioridadDeCuadrante(id: IdCuadrante): Prioridad {
  return CUADRANTES.find((c) => c.id === id)?.prioridad ?? "ninguna";
}

export function cuadranteDePrioridad(prioridad: Prioridad): IdCuadrante {
  return CUADRANTES.find((c) => c.prioridad === prioridad)?.id ?? "ninguno";
}

export interface FiltrosMatriz {
  listaId: string | null;
  etiqueta: string | null;
}

/** Solo pendientes, en el orden que ella les da arrastrándolas dentro de cada cuadrante. */
export function repartirEnCuadrantes(tareas: Tarea[], listas: Lista[], filtros: FiltrosMatriz): Record<IdCuadrante, Tarea[]> {
  const excluidas = new Set(listas.filter((l) => !l.incluirEnTodas).map((l) => l.id));
  const reparto: Record<IdCuadrante, Tarea[]> = { "urgente-importante": [], importante: [], urgente: [], ninguno: [] };
  for (const t of tareas) {
    if (!estaPendiente(t)) continue;
    // Elegir una lista oculta en las vistas inteligentes la muestra igual.
    if (filtros.listaId ? t.listaId !== filtros.listaId : excluidas.has(t.listaId)) continue;
    if (filtros.etiqueta && !t.etiquetas.includes(filtros.etiqueta)) continue;
    reparto[cuadranteDePrioridad(t.prioridad)].push(t);
  }
  for (const lista of Object.values(reparto)) lista.sort((a, b) => a.orden - b.orden);
  return reparto;
}
