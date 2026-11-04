import Dexie, { type Table } from "dexie";
import type { Carpeta, Etiqueta, Lista, Tarea } from "../modelos/tipos";

export class BaseAndamia extends Dexie {
  tareas!: Table<Tarea, string>;
  listas!: Table<Lista, string>;
  carpetas!: Table<Carpeta, string>;
  etiquetas!: Table<Etiqueta, string>;

  constructor() {
    super("andamia");
    this.version(1).stores({
      tareas: "id, listaId, estado, eliminadaEn, vence, orden",
      listas: "id, carpetaId, orden",
      carpetas: "id, orden",
      etiquetas: "nombre, orden",
    });
  }
}

export const bd = new BaseAndamia();
