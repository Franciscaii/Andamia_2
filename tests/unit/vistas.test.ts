import { describe, expect, it } from "vitest";
import { agruparPorFecha, ordenEntre, tareasDeVista } from "../../src/logica/vistas";
import { buscarTareas, FILTROS_VACIOS, resaltar } from "../../src/logica/busqueda";
import { componerVence, etiquetaFecha } from "../../src/logica/fechas";
import type { Lista, Tarea } from "../../src/modelos/tipos";

const AHORA = new Date(2026, 10, 4, 14, 0, 0);
let n = 0;

function tarea(cambios: Partial<Tarea> = {}): Tarea {
  n += 1;
  return {
    id: `t${n}`,
    listaId: "bandeja",
    titulo: `Tarea ${n}`,
    descripcion: "",
    estado: "pendiente",
    prioridad: "ninguna",
    vence: null,
    todoElDia: false,
    zonaHoraria: "America/Santiago",
    etiquetas: [],
    subtareas: [],
    repeticion: null,
    repetirDesde: "vencimiento",
    repetidaDe: null,
    recordatorios: [],
    avisosEnviados: [],
    columnaId: null,
    orden: n,
    completadaEn: null,
    eliminadaEn: null,
    creadaEn: "2026-11-01T00:00:00.000Z",
    modificadaEn: "2026-11-01T00:00:00.000Z",
    ...cambios,
  };
}

const atrasada = tarea({ titulo: "atrasada", vence: "2026-11-02", todoElDia: true });
const hoy = tarea({ titulo: "hoy", vence: "2026-11-04", todoElDia: true });
const hoyNoche = tarea({ titulo: "hoy noche", vence: new Date(2026, 10, 4, 23, 30).toISOString() });
const manana = tarea({ titulo: "mañana", vence: "2026-11-05", todoElDia: true });
const sexto = tarea({ titulo: "sexto día", vence: "2026-11-10", todoElDia: true });
const septimo = tarea({ titulo: "séptimo día", vence: "2026-11-11", todoElDia: true });
const sinFecha = tarea({ titulo: "sin fecha" });
const hecha = tarea({ titulo: "hecha", vence: "2026-11-04", todoElDia: true, estado: "completada", completadaEn: "2026-11-04T10:00:00.000Z" });
const borrada = tarea({ titulo: "borrada", vence: "2026-11-04", todoElDia: true, eliminadaEn: "2026-11-04T11:00:00.000Z" });
const TODAS = [atrasada, hoy, hoyNoche, manana, sexto, septimo, sinFecha, hecha, borrada];

const titulos = (ts: Tarea[]) => ts.map((t) => t.titulo).sort();

describe("vistas inteligentes", () => {
  it("Hoy incluye lo de hoy y lo atrasado, sin completadas ni borradas", () => {
    expect(titulos(tareasDeVista(TODAS, "hoy", [], AHORA))).toEqual(["atrasada", "hoy", "hoy noche"]);
  });

  it("Mañana solo incluye el día siguiente", () => {
    expect(titulos(tareasDeVista(TODAS, "manana", [], AHORA))).toEqual(["mañana"]);
  });

  it("Próximos 7 días llega hasta seis días después de hoy", () => {
    const r = titulos(tareasDeVista(TODAS, "semana", [], AHORA));
    expect(r).toContain("sexto día");
    expect(r).not.toContain("séptimo día");
    expect(r).not.toContain("sin fecha");
  });

  it("Todas incluye las pendientes con y sin fecha", () => {
    expect(tareasDeVista(TODAS, "todas", [], AHORA)).toHaveLength(7);
  });

  it("Completadas y Papelera son excluyentes", () => {
    expect(titulos(tareasDeVista(TODAS, "completadas", [], AHORA))).toEqual(["hecha"]);
    expect(titulos(tareasDeVista(TODAS, "papelera", [], AHORA))).toEqual(["borrada"]);
  });

  it("una lista excluida no aparece en vistas inteligentes", () => {
    const lista: Lista = { id: "x", nombre: "X", color: null, carpetaId: null, incluirEnTodas: false, modo: "lista", orden: 0 };
    const oculta = tarea({ titulo: "oculta", listaId: "x", vence: "2026-11-04", todoElDia: true });
    expect(titulos(tareasDeVista([oculta, hoy], "hoy", [lista], AHORA))).toEqual(["hoy"]);
  });

  it("una hora nocturna no se desplaza de día", () => {
    expect(etiquetaFecha(hoyNoche, AHORA)).toBe("Hoy 23:30");
  });

  it("una tarea de todo el día no se desplaza por la zona horaria", () => {
    expect(etiquetaFecha(hoy, AHORA)).toBe("Hoy");
    expect(etiquetaFecha(manana, AHORA)).toBe("Mañana");
  });

  it("agrupa por cercanía en orden y omite grupos vacíos", () => {
    const grupos = agruparPorFecha([sinFecha, manana, atrasada, septimo], AHORA);
    expect(grupos.map((g) => g.id)).toEqual(["atrasadas", "manana", "despues", "sin-fecha"]);
  });
});

describe("orden entre vecinas", () => {
  it("calcula arriba, abajo y al medio", () => {
    expect(ordenEntre(null, 100)).toBe(-924);
    expect(ordenEntre(100, null)).toBe(1124);
    expect(ordenEntre(100, 200)).toBe(150);
    expect(ordenEntre(null, null)).toBe(0);
  });

  it("pide renumerar cuando no hay hueco", () => {
    expect(ordenEntre(1, 1)).toBeNull();
  });
});

describe("componer fecha", () => {
  it("sin fecha, sin hora y con hora", () => {
    expect(componerVence("", "10:00")).toEqual({ vence: null, todoElDia: false });
    expect(componerVence("2026-11-05", "")).toEqual({ vence: "2026-11-05", todoElDia: true });
    expect(componerVence("2026-11-05", "10:00").vence).toBe(new Date(2026, 10, 5, 10, 0).toISOString());
  });
});

describe("búsqueda", () => {
  const conNotas = tarea({ titulo: "Informe", descripcion: "Enviar a María mañana", etiquetas: ["trabajo"], prioridad: "alta" });
  const conSub = tarea({ titulo: "Mudanza", subtareas: [{ id: "s", titulo: "Comprar cajas", estado: "pendiente", orden: 0 }] });
  const base = [conNotas, conSub, hecha, borrada];

  it("busca en título, notas y subtareas sin distinguir mayúsculas, acentos ni ñ", () => {
    const buscar = (consulta: string) => titulos(buscarTareas(base, { ...FILTROS_VACIOS, consulta }, AHORA));
    expect(buscar("INFORME")).toEqual(["Informe"]);
    expect(buscar("maria")).toEqual(["Informe"]);
    expect(buscar("manana")).toEqual(["Informe"]);
    expect(buscar("cajas")).toEqual(["Mudanza"]);
    expect(buscar("cajas informe")).toEqual([]);
  });

  it("incluye completadas y excluye la papelera", () => {
    const r = titulos(buscarTareas(base, FILTROS_VACIOS, AHORA));
    expect(r).toContain("hecha");
    expect(r).not.toContain("borrada");
  });

  it("aplica filtros combinados", () => {
    const f = { ...FILTROS_VACIOS, etiqueta: "trabajo", prioridad: "alta" as const };
    expect(titulos(buscarTareas(base, f, AHORA))).toEqual(["Informe"]);
    expect(buscarTareas(base, { ...f, prioridad: "baja" }, AHORA)).toEqual([]);
  });

  it("filtra por fecha y estado", () => {
    expect(titulos(buscarTareas(base, { ...FILTROS_VACIOS, fecha: "hoy" }, AHORA))).toEqual(["hecha"]);
    expect(titulos(buscarTareas(base, { ...FILTROS_VACIOS, estado: "completada" }, AHORA))).toEqual(["hecha"]);
    expect(buscarTareas(base, { ...FILTROS_VACIOS, fecha: "sin-fecha" }, AHORA)).toHaveLength(2);
  });

  it("resalta sin perder el texto original", () => {
    const partes = resaltar("Reunión con María", "maria");
    expect(partes.map((p) => p.texto).join("")).toBe("Reunión con María");
    expect(partes.filter((p) => p.coincide).map((p) => p.texto)).toEqual(["María"]);
  });
});
