import type { Lista, Prioridad, Tarea } from "../modelos/tipos";
import { estaPendiente } from "./vistas";

export type IdCuadrante = "urgente-importante" | "importante" | "urgente" | "ninguno";

export interface Cuadrante {
  id: IdCuadrante;
  nombre: string;
  ayuda: string;
  prioridad: Prioridad;
}

/** Diseño de Andamia: cada cuadrante corresponde a un nivel de prioridad. */
export const CUADRANTES: Cuadrante[] = [
  { id: "urgente-importante", nombre: "Urgente e importante", ayuda: "Hazlo ahora", prioridad: "alta" },
  { id: "importante", nombre: "Importante, no urgente", ayuda: "Planifícalo", prioridad: "media" },
  { id: "urgente", nombre: "Urgente, no importante", ayuda: "Resuélvelo rápido o delégalo", prioridad: "baja" },
  { id: "ninguno", nombre: "Ni urgente ni importante", ayuda: "Déjalo para después", prioridad: "ninguna" },
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

/** Solo pendientes: primero las que vencen antes; las sin fecha, al final. */
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
  const clave = (t: Tarea) => (t.vence ? new Date(t.vence.length === 10 ? `${t.vence}T00:00:00` : t.vence).getTime() : Number.POSITIVE_INFINITY);
  for (const lista of Object.values(reparto)) lista.sort((a, b) => clave(a) - clave(b) || a.orden - b.orden);
  return reparto;
}
