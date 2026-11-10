import { closestCenter, pointerWithin, rectIntersection, type CollisionDetection } from "@dnd-kit/core";

/** Con ratón manda el puntero; con teclado no hay puntero y se usa la posición del elemento. */
export const colisionPunteroOTeclado: CollisionDetection = (args) => (args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args));

/**
 * Para listas ordenables dentro de zonas (días, cuadrantes): con el puntero manda lo que está
 * bajo él, prefiriendo una tarea antes que la zona que la contiene; con teclado, lo más cercano.
 */
export function colisionTareasEnZonas(esZona: (id: string) => boolean): CollisionDetection {
  return (args) => {
    const choques = args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);
    const tareas = choques.filter((c) => !esZona(String(c.id)));
    return tareas.length ? tareas : choques;
  };
}
