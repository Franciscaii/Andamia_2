import { describe, expect, it } from "vitest";
import { habitosDelDia } from "../../src/logica/habitos";
import { datosDelWidget, datosDeWidgets, leerHabitosMarcados } from "../../src/logica/widgetAndroid";
import type { Habito, Lista, RegistroHabito, Tarea } from "../../src/modelos/tipos";

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
    expect(dias).toHaveLength(42);
    expect(dias[7 + 2]).toMatchObject({ hoy: true, titulo: expect.stringContaining("Hoy"), fecha: "2026-11-11" });
    const estaSemana = dias.slice(7, 14);
    const jueves = estaSemana.find((d) => d.nombre === "Jue")!;
    expect(jueves.eventos[0]).toMatchObject({ titulo: "Doctor", color: "#e0245e" });
    expect(estaSemana.find((d) => d.nombre === "Vie")!.tareas.map((t) => t.titulo)).toContain("Leer");
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

  it("manda los hechos sueltos para que el widget arme día, semana, mes o año", () => {
    const { grupos, hechos } = datos.estadisticas.tareas;
    expect(hechos.length).toBeGreaterThan(0);
    for (const h of hechos) {
      expect(h).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}\|\d+$/);
      expect(Number(h.split("|")[1])).toBeLessThan(grupos.length);
    }
    expect(grupos.some((g) => g.nombre === "Universidad")).toBe(true);
  });
});

describe("tema y aspecto de los widgets de Android", () => {
  it("mezcla colores en hexadecimal, como color-mix", async () => {
    const { mezclarHex } = await import("../../src/logica/widgetAndroid");
    expect(mezclarHex("#000000", 50, "#ffffff")).toBe("#808080");
    expect(mezclarHex("#fff", 100, "#000000")).toBe("#ffffff");
  });

  it("manda los colores de Clásico por defecto y guarda los de cada widget", async () => {
    const { datosDeWidgets, temaParaWidget } = await import("../../src/logica/widgetAndroid");
    const { presetDe } = await import("../../src/logica/temas");
    const t = temaParaWidget(presetDe("castillo"));
    expect(t).toMatchObject({ fondo: "#2b1e16", texto: "#fbebd0", acento: "#f4a340" });
    expect(t.tenue).toMatch(/^#[0-9a-f]{6}$/);
    const d = datosDeWidgets({ tareas: [], listas: [], etiquetas: [], habitos: [], registros: [] }, new Date(2026, 10, 11));
    expect(d.tema.fondo).toBe(presetDe("clasico").panel);
    const { configParaAndroid } = await import("../../src/logica/widgetAndroid");
    expect(JSON.parse(configParaAndroid({ temaId: "castillo", transparencia: 30, esquinas: 16, letra: 120 }))).toMatchObject({ transparencia: 30, esquinas: 16, letra: 120, tema: { fondo: "#2b1e16" } });
  });
});

describe("meses del widget Calendario", () => {
  it("manda 9 meses (2 antes y 6 después), con el actual marcado", async () => {
    const { mesesDelWidget } = await import("../../src/logica/widgetAndroid");
    const meses = mesesDelWidget({ tareas: [], listas: [], etiquetas: [], habitos: [], marcas: [] } as never, new Date(2026, 10, 11));
    expect(meses).toHaveLength(9);
    expect(meses[2].actual).toBe(true);
    expect(meses[2].corto).toBe("Nov");
    expect(meses[3].corto).toBe("Dic");
    expect(meses[4].corto).toBe("Ene 2027");
    expect(meses.every((m) => m.celdas.length % 7 === 0)).toBe(true);
  });
});

describe("tareas escritas en el + del widget", () => {
  it("cada celda del mes lleva su fecha, para poner ahí lo nuevo", async () => {
    const { mesDelWidget } = await import("../../src/logica/widgetAndroid");
    const mes = mesDelWidget({ tareas: [], listas: [], etiquetas: [], habitos: [], registros: [] } as never, new Date(2026, 10, 11));
    expect(mes.celdas[0].fecha).toBe("2026-10-26");
    expect(mes.celdas.find((c) => c.dia === 11 && c.delMes)?.fecha).toBe("2026-11-11");
  });

  it("lee la cola del widget y descarta lo que no sirve", async () => {
    const { leerRapidas } = await import("../../src/logica/widgetAndroid");
    const json = JSON.stringify([
      { id: "rapida-1", titulo: "Comprar pan", fecha: "2026-11-12", evento: false },
      { id: "rapida-2", titulo: "Doctor", fecha: "2026-11-13", evento: true },
      { id: "rapida-3", titulo: "   ", fecha: "2026-11-13", evento: false },
      { id: "rapida-4", titulo: "Sin fecha", fecha: "mañana", evento: false },
    ]);
    expect(leerRapidas(json).map((n) => n.titulo)).toEqual(["Comprar pan", "Doctor"]);
    expect(leerRapidas("no es json")).toEqual([]);
  });
});

describe("cuadro + del widget: tarea, evento o hábito", () => {
  it("manda las índoles con su nombre visible y color, y los colores de la app", async () => {
    const { formularioDelWidget } = await import("../../src/logica/widgetAndroid");
    const f = formularioDelWidget({ etiquetas: [{ nombre: "universidad", nombreVisible: "Universidad", color: "#14c9a0" }] as never });
    expect(f.indoles).toEqual([{ clave: "universidad", nombre: "Universidad", color: "#14c9a0" }]);
    expect(f.coloresHabito).toHaveLength(8);
    expect(f.coloresEvento.length).toBeGreaterThan(8);
  });

  it("acepta solo frecuencias de hábito válidas", async () => {
    const { frecuenciaValida } = await import("../../src/logica/widgetAndroid");
    expect(frecuenciaValida({ tipo: "dias", dias: [4, 0, 9, 0] })).toEqual({ tipo: "dias", dias: [0, 4] });
    expect(frecuenciaValida({ tipo: "dias", dias: [] })).toEqual({ tipo: "diaria" });
    expect(frecuenciaValida({ tipo: "semanal", veces: 12 })).toEqual({ tipo: "semanal", veces: 7 });
    expect(frecuenciaValida(null)).toEqual({ tipo: "diaria" });
  });
});

describe("tamaño de letra y temas nuevos", () => {
  it("lee la letra de cada widget, acotada, y 100% si no tiene", async () => {
    const { leerConfig } = await import("../../src/logica/widgetAndroid");
    expect(leerConfig('{"temaId":"rosa","transparencia":0,"esquinas":20,"letra":300}')).toMatchObject({ temaId: "rosa", letra: 150 });
    expect(leerConfig('{"temaId":"clasico"}').letra).toBe(100);
  });

  it("trae los temas nuevos para la app y los widgets", async () => {
    const { TEMAS } = await import("../../src/logica/temas");
    const ids = TEMAS.map((t) => t.id);
    for (const id of ["oceano", "rosa", "arena", "cielo", "grafito", "medianoche", "cereza"]) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("hábitos en el widget Semana", () => {
  const ahora = new Date(2026, 10, 11, 10, 0); // miércoles
  const habito = { id: "h1", nombre: "Leer", icono: "libro", color: "#3f74b5", frecuencia: { tipo: "diaria" }, metaDiaria: 1, unidad: "", inicio: "2026-11-10", recordatorioHora: null, avisosEnviados: [], archivado: false, orden: 1 };
  const habitos = [habito, { ...habito, id: "h2", nombre: "Apagado", archivado: true, orden: 2 }, { ...habito, id: "h3", nombre: "Clase", frecuencia: { tipo: "dias", dias: [3] }, orden: 0 }] as Habito[];
  const registros = [{ id: "h1|2026-11-11", habitoId: "h1", fecha: "2026-11-11", estado: "hecho", valor: 1 }] as RegistroHabito[];

  it("cada día trae sus hábitos activos y programados, con lo hecho y si se puede marcar", () => {
    const dias = datosDeWidgets({ tareas: [], listas, etiquetas: [], habitos, registros }, ahora).semanaDias;
    const dia = (fecha: string) => dias.find((d) => d.fecha === fecha)!;
    expect(dia("2026-11-09").habitos).toEqual([]); // antes de empezar
    expect(dia("2026-11-11").habitos).toEqual([{ id: "h1", nombre: "Leer", color: "#3f74b5", hecho: true, marcable: true }]);
    expect(dia("2026-11-12").habitos).toEqual([
      { id: "h3", nombre: "Clase", color: "#3f74b5", hecho: false, marcable: false },
      { id: "h1", nombre: "Leer", color: "#3f74b5", hecho: false, marcable: false },
    ]);
  });

  it("habitosDelDia deja marcar hoy y antes, no después", () => {
    expect(habitosDelDia(habitos, registros, new Date(2026, 10, 10), ahora).map((h) => [h.habito.id, h.estado, h.marcable])).toEqual([["h1", null, true]]);
    expect(habitosDelDia(habitos, registros, new Date(2026, 10, 13), ahora).every((h) => !h.marcable)).toBe(true);
  });

  it("lee las marcas hechas en el widget y descarta lo que no entiende", () => {
    expect(leerHabitosMarcados('{"h1|2026-11-11":true,"a|b|2026-11-10":false,"malo":true,"h2|ayer":true,"h3|2026-11-09":"si"}')).toEqual([
      { habitoId: "h1", fecha: "2026-11-11", hecho: true },
      { habitoId: "a|b", fecha: "2026-11-10", hecho: false },
    ]);
    expect(leerHabitosMarcados("")).toEqual([]);
    expect(leerHabitosMarcados("[]")).toEqual([]);
  });
});
