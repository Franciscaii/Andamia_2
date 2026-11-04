import Dexie, { type Table } from "dexie";
import type { Carpeta, Columna, Etiqueta, Habito, Lista, RegistroHabito, SesionEnfoque, Tarea } from "../modelos/tipos";

export const BASE_LOCAL = "andamia";

/** Base de una cuenta: sus datos nunca se mezclan con los de quien usa la app sin sesión. */
export const baseDeCuenta = (uid: string) => `andamia-u-${uid}`;

export const TABLAS = ["tareas", "listas", "carpetas", "etiquetas", "columnas", "sesiones", "habitos", "registrosHabito"] as const;
export type NombreTabla = (typeof TABLAS)[number];

export class BaseAndamia extends Dexie {
  tareas!: Table<Tarea, string>;
  listas!: Table<Lista, string>;
  carpetas!: Table<Carpeta, string>;
  etiquetas!: Table<Etiqueta, string>;
  columnas!: Table<Columna, string>;
  sesiones!: Table<SesionEnfoque, string>;
  habitos!: Table<Habito, string>;
  registrosHabito!: Table<RegistroHabito, string>;

  constructor(nombre: string = BASE_LOCAL) {
    super(nombre);
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
    // Fase 4: enfoque y hábitos. Solo agrega tablas; las anteriores no cambian.
    this.version(3).stores({
      sesiones: "id, inicio, tareaId",
      habitos: "id, orden",
      registrosHabito: "id, habitoId, fecha",
    });
  }
}

/** La base activa. Se reasigna al entrar o salir de una cuenta; quien la importa ve siempre la vigente. */
export let bd = new BaseAndamia();

/** Cambia la base activa. */
export async function usarBase(nombre: string): Promise<BaseAndamia> {
  if (bd.name === nombre) return bd;
  bd.close();
  bd = new BaseAndamia(nombre);
  await bd.open();
  return bd;
}
