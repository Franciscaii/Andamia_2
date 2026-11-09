import { describe, expect, it } from "vitest";
import { contenidoDelDia, diasDeSemana, nombreCortoDia, progresoDe, tituloDelDia } from "../../src/logica/semana";
import type { Lista, Tarea } from "../../src/modelos/tipos";

const base = {
  id: "t", listaId: "bandeja", titulo: "x", descripcion: "", estado: "pendiente", prioridad: "ninguna",
  vence: "2026-11-09", todoElDia: true, zonaHoraria: "America/Santiago", etiquetas: [], subtareas: [],
  repeticion: null, repetirDesde: "vencimiento", repetidaDe: null, recordatorios: [], avisosEnviados: [],
  columnaId: null, orden: 1, completadaEn: null, eliminadaEn: null, creadaEn: "", modificadaEn: "",
} as Tarea;
const listas: Lista[] = [];
const ahora = new Date(2026, 10, 11, 10, 0); // miércoles 11

describe("semana", () => {
  it("va de lunes a domingo", () => {
    const dias = diasDeSemana(ahora);
    expect(dias.map((d) => d.getDate())).toEqual([9, 10, 11, 12, 13, 14, 15]);
    expect(nombreCortoDia(dias[0])).toBe("Lun");
    expect(tituloDelDia(ahora, ahora)).toBe("Hoy, mié 11 de noviembre");
    expect(tituloDelDia(dias[4], ahora)).toBe("Vie 13 de noviembre");
  });

  it("separa eventos, cuenta el progreso solo con tareas e incluye lo atrasado hoy", () => {
    const tareas = [
      { ...base, id: "a", vence: "2026-11-11" },
      { ...base, id: "b", vence: "2026-11-11", estado: "completada" },
      { ...base, id: "c", vence: "2026-11-09" },
      { ...base, id: "d", vence: "2026-11-11", esEvento: true },
      { ...base, id: "e", vence: "2026-11-09", esEvento: true },
      { ...base, id: "f", vence: "2026-11-11", eliminadaEn: "2026-11-10" },
    ] as Tarea[];
    const hoy = contenidoDelDia(tareas, listas, ahora, ahora);
    expect(hoy.eventos.map((t) => t.id)).toEqual(["d"]);
    expect(hoy.tareas.map((t) => t.id).sort()).toEqual(["a", "b", "c"]);
    expect(hoy.progreso).toEqual({ hechas: 1, total: 3, porcentaje: 33 });

    const lunes = contenidoDelDia(tareas, listas, new Date(2026, 10, 9), ahora);
    expect(lunes.eventos.map((t) => t.id)).toEqual(["e"]);
    expect(lunes.tareas.map((t) => t.id)).toEqual(["c"]);
  });

  it("sin tareas el progreso es 0 %", () => {
    expect(progresoDe([])).toEqual({ hechas: 0, total: 0, porcentaje: 0 });
  });
});
