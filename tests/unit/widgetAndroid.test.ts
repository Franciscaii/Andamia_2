import { describe, expect, it } from "vitest";
import { datosDelWidget, datosDeWidgets } from "../../src/logica/widgetAndroid";
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
    // En el orden manual de la semana; lo completado de hoy se queda (tachado) para el progreso.
    expect(datos.tareas.map((t) => t.id)).toEqual(["t1", "t2", "t3", "t5"]);
    expect(datos.titulo).toBe("Hoy, lun 9 de noviembre");
    expect(datos.tareas[0]).toMatchObject({ prioridad: 3, atrasada: false, detalle: "", hecha: false });
    expect(datos.tareas[1]).toMatchObject({ detalle: "15:30 · Trabajo", prioridad: 0 });
    expect(datos.tareas[2]).toMatchObject({ atrasada: true, prioridad: 1 });
    expect(datos.tareas[3]).toMatchObject({ hecha: true, atrasada: false });
  });

  it("separa los eventos y lleva dificultad y etiqueta", () => {
    const tareas = [
      { ...base, id: "e1", titulo: "Doctor", esEvento: true, vence: new Date(2026, 10, 9, 11, 0).toISOString(), todoElDia: false },
      { ...base, id: "t1", dificultad: "media", etiquetas: ["uni"] },
    ] as Tarea[];
    const etiquetas = [{ nombre: "uni", nombreVisible: "Universidad", color: "#2f9e5b", orden: 0 }];
    const datos = datosDelWidget(tareas, listas, ahora, etiquetas);
    expect(datos.eventos).toEqual([{ id: "e1", titulo: "Doctor", hora: "11:00", color: "" }]);
    expect(datos.tareas).toHaveLength(1);
    expect(datos.tareas[0]).toMatchObject({ dificultad: 2, etiqueta: "Universidad", colorEtiqueta: "#2f9e5b" });
  });
});

describe("datos de los widgets Semana, Matriz, Calendario y estadísticas", () => {
  const ahora = new Date(2026, 10, 11, 10, 0); // miércoles
  const tareas = [
    base,
    { ...base, id: "e1", titulo: "Doctor", esEvento: true, vence: "2026-11-12", colorEvento: "#e0245e", orden: 2 },
    { ...base, id: "t2", titulo: "Leer", prioridad: "media", vence: "2026-11-13", orden: 3 },
    { ...base, id: "t3", titulo: "Lista", estado: "completada", completadaEn: new Date(2026, 10, 10, 9).toISOString(), etiquetas: ["universidad"], orden: 4 },
  ] as Tarea[];
  const datos = datosDeWidgets({ tareas, listas, etiquetas: [{ nombre: "universidad", nombreVisible: "Universidad", color: "#14c9a0" }] as never, habitos: [], registros: [] }, ahora);

  it("la semana trae los 7 días, cada uno con sus eventos y tareas, con hoy marcado", () => {
    const dias = datos.semanaDias;
    expect(dias).toHaveLength(7);
    expect(dias[2]).toMatchObject({ hoy: true, titulo: expect.stringContaining("Hoy"), fecha: "2026-11-11" });
    const jueves = dias.find((d) => d.nombre === "Jue")!;
    expect(jueves.eventos[0]).toMatchObject({ titulo: "Doctor", color: "#e0245e" });
    expect(dias.find((d) => d.nombre === "Vie")!.tareas.map((t) => t.titulo)).toContain("Leer");
  });

  it("la matriz trae los 4 cuadrantes numerados y solo pendientes", () => {
    const secciones = datos.matriz.filter((f) => f.tipo === "seccion");
    expect(secciones.map((s) => String((s as { titulo: string }).titulo).slice(0, 1))).toEqual(["1", "2", "3", "4"]);
    expect(datos.matriz.some((f) => (f as { id?: string }).id === "t3")).toBe(false);
    expect(datos.matriz.some((f) => (f as { id?: string }).id === "e1")).toBe(false);
  });

  it("el mes empieza en lunes, marca hoy y lleva lo de cada día", () => {
    expect(datos.mes.titulo).toBe("Noviembre 2026");
    expect(datos.mes.celdas.length % 7).toBe(0);
    const hoy = datos.mes.celdas.find((c) => c.hoy)!;
    expect(hoy.dia).toBe(11);
    const doce = datos.mes.celdas.find((c) => c.delMes && c.dia === 12)!;
    expect(doce.entradas[0]).toMatchObject({ titulo: "Doctor", evento: true });
  });

  it("las estadísticas cuentan lo completado esta semana por etiqueta", () => {
    expect(datos.estadisticas.tareas.total).toBe(1);
    expect(datos.estadisticas.tareas.filas[0]).toMatchObject({ nombre: "Universidad", cantidad: 1, porcentaje: 100 });
    expect(datos.estadisticas.tareas.serie).toHaveLength(7);
    expect(datos.estadisticas.habitos.total).toBe(0);
  });
});
