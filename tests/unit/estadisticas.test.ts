import { describe, expect, it } from "vitest";
import { hechosDeHabitos, hechosDeTareas, resumir, tituloPeriodo, tramosDe, rangoDe, type Grupo } from "../../src/logica/estadisticas";
import type { Habito, RegistroHabito, Tarea } from "../../src/modelos/tipos";

const t = (id: string, completadaEn: string | null, etiquetas: string[] = [], extra: Partial<Tarea> = {}) =>
  ({ id, titulo: id, estado: completadaEn ? "completada" : "pendiente", completadaEn, eliminadaEn: null, etiquetas, ...extra }) as Tarea;

const grupos: Grupo[] = [
  { clave: "vida", nombre: "VidaCotidiana", color: "#7fa3dc" },
  { clave: "uni", nombre: "Universidad", color: "#14c9a0" },
];
const ahora = new Date(2026, 10, 11, 12); // miércoles 11 nov

describe("estadísticas", () => {
  it("cuenta por la primera etiqueta, con porcentaje, sin eventos, borradas ni pendientes", () => {
    const hechos = hechosDeTareas([
      t("a", new Date(2026, 10, 9, 10).toISOString(), ["vida"]),
      t("b", new Date(2026, 10, 10, 10).toISOString(), ["vida", "uni"]),
      t("c", new Date(2026, 10, 11, 10).toISOString(), ["uni"]),
      t("d", new Date(2026, 10, 11, 11).toISOString()),
      t("e", null, ["uni"]),
      t("f", new Date(2026, 10, 11, 10).toISOString(), ["uni"], { esEvento: true }),
      t("g", new Date(2026, 10, 11, 10).toISOString(), ["uni"], { eliminadaEn: "x" }),
      t("h", new Date(2026, 10, 2, 10).toISOString(), ["uni"]), // semana anterior
    ]);
    const r = resumir(hechos, grupos, "semana", ahora);
    expect(r.total).toBe(4);
    expect(r.filas.map((f) => [f.nombre, f.cantidad, f.porcentaje])).toEqual([
      ["VidaCotidiana", 2, 50],
      ["Universidad", 1, 25],
      ["Sin etiqueta", 1, 25],
    ]);
    expect(r.serie).toHaveLength(7);
    expect(r.serie[0]).toEqual({ etiqueta: "Lun", valores: { vida: 1, uni: 0, "": 0 } });
    expect(r.serie[2].valores).toEqual({ vida: 0, uni: 1, "": 1 });
    // Lo más reciente primero.
    expect(r.hechos[0].id).toBe("d");
  });

  it("tramos y títulos de cada período", () => {
    expect(tramosDe("dia", rangoDe("dia", ahora))).toHaveLength(12);
    expect(tramosDe("mes", rangoDe("mes", ahora))).toHaveLength(30);
    expect(tramosDe("anio", rangoDe("anio", ahora)).map((x) => x.etiqueta)[0]).toBe("Ene");
    expect(tituloPeriodo("semana", ahora, ahora)).toBe("9 nov – 15 nov");
    expect(tituloPeriodo("mes", ahora, ahora)).toBe("Noviembre 2026");
  });

  it("hábitos: cuenta los días hechos de cada hábito", () => {
    const habitos = [{ id: "h1", nombre: "Leer", color: "#3f74b5" }] as Habito[];
    const registros = [
      { id: "1", habitoId: "h1", fecha: "2026-11-10", estado: "hecho", valor: 1 },
      { id: "2", habitoId: "h1", fecha: "2026-11-11", estado: "parcial", valor: 0 },
      { id: "3", habitoId: "otro", fecha: "2026-11-11", estado: "hecho", valor: 1 },
    ] as RegistroHabito[];
    const r = resumir(hechosDeHabitos(habitos, registros), [{ clave: "h1", nombre: "Leer", color: "#3f74b5" }], "semana", ahora);
    expect(r.total).toBe(1);
    expect(r.filas[0]).toMatchObject({ nombre: "Leer", cantidad: 1, porcentaje: 100 });
  });
});
