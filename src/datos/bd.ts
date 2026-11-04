import Dexie, { type Table } from "dexie";
import type { Carpeta, Columna, Etiqueta, Lista, Tarea } from "../modelos/tipos";

export class BaseAndamia extends Dexie {
  tareas!: Table<Tarea, string>;
  listas!: Table<Lista, string>;
  carpetas!: Table<Carpeta, string>;
  etiquetas!: Table<Etiqueta, string>;
  columnas!: Table<Columna, string>;

  constructor() {
    super("andamia");
    this.version(1).stores({
      tareas: "id, listaId, estado, eliminadaEn, vence, orden",
      listas: "id, carpetaId, orden",
      carpetas: "id, orden",
      etiquetas: "nombre, orden",
    });
    // Fase 3: repeticiones, recordatorios y Kanban. Solo agrega datos; no quita ninguno.
    this.version(2)
      .stores({
        tareas: "id, listaId, estado, eliminadaEn, vence, orden, columnaId",
        columnas: "id, listaId, orden",
      })
      .upgrade(async (tx) => {
        await tx.table("tareas").toCollection().modify((t) => {
          t.repeticion ??= null;
          t.repetirDesde ??= "vencimiento";
          t.repetidaDe ??= null;
          t.recordatorios ??= [];
          t.avisosEnviados ??= [];
          t.columnaId ??= null;
        });
        await tx.table("listas").toCollection().modify((l) => {
          l.modo ??= "lista";
        });
      });
  }
}

export const bd = new BaseAndamia();
