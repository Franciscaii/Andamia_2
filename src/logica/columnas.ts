import type { Columna, Tarea } from "../modelos/tipos";

export const NOMBRE_COLUMNA_INICIAL = "Sin sección";

/** Reparte las tareas; las que no tienen una columna válida van a la primera. */
export function repartirEnColumnas(tareas: Tarea[], columnas: Columna[]): Map<string, Tarea[]> {
  const orden = [...columnas].sort((a, b) => a.orden - b.orden);
  const reparto = new Map<string, Tarea[]>(orden.map((c) => [c.id, []]));
  if (!orden.length) return reparto;
  for (const t of [...tareas].sort((a, b) => a.orden - b.orden)) {
    const destino = t.columnaId && reparto.has(t.columnaId) ? t.columnaId : orden[0].id;
    reparto.get(destino)?.push(t);
  }
  return reparto;
}
