import { pointerWithin, rectIntersection, type CollisionDetection } from "@dnd-kit/core";

/** Con ratón manda el puntero; con teclado no hay puntero y se usa la posición del elemento. */
export const colisionPunteroOTeclado: CollisionDetection = (args) => (args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args));
