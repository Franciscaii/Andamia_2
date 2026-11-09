import { describe, expect, it } from "vitest";
import { datosDelWidget } from "../../src/logica/widgetAndroid";
import type { Lista, Tarea } from "../../src/modelos/tipos";

const base: Tarea = {
  id: "t1", listaId: "bandeja", titulo: "Pagar luz", descripcion: "", estado: "pendiente", prioridad: "alta",
  vence: "2026-11-09", todoElDia: true, zonaHoraria: "America/Santiago", etiquetas: [], subtareas: [],
  repeticion: null, repetirDesde: "vencimiento", repetidaDe: null, recordatorios: [], avisosEnviados: [],
  columnaId: null, orden: 1, completadaEn: null, eliminadaEn: null, creadaEn: "", modificadaEn: "",
} as Tarea;
const listas: Lista[] = [{ id: "trabajo", nombre: "Trabajo", incluirEnTodas: true } as Lista, { id: "bandeja", nombre: "Bandeja", incluirEnTodas: true } as Lista];

describe("datosDelWidget", () => {
  const ahora = new Date(2026, 10, 9, 10, 0);
  it("lleva las tareas de hoy y las atrasadas, con hora, lista y prioridad", () => {
    const tareas = [
      base,
      { ...base, id: "t2", titulo: "Reunión", listaId: "trabajo", vence: new Date(2026, 10, 9, 15, 30).toISOString(), todoElDia: false, prioridad: "ninguna", orden: 2 },
      { ...base, id: "t3", titulo: "Atrasada", vence: "2026-11-07", orden: 3, prioridad: "baja" },
      { ...base, id: "t4", titulo: "Mañana", vence: "2026-11-10", orden: 4 },
      { ...base, id: "t5", titulo: "Hecha", estado: "completada", orden: 5 },
    ] as Tarea[];
    const datos = datosDelWidget(tareas, listas, ahora);
    expect(datos.fecha).toBe("2026-11-09");
    expect(datos.tareas.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(datos.tareas[0]).toMatchObject({ prioridad: 3, atrasada: false, detalle: "" });
    expect(datos.tareas[1]).toMatchObject({ detalle: "15:30 · Trabajo", prioridad: 0 });
    expect(datos.tareas[2]).toMatchObject({ atrasada: true, prioridad: 1 });
  });
});
