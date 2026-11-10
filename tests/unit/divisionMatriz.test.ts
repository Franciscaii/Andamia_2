import { beforeEach, describe, expect, it } from "vitest";
import { acotar, DIVISION_INICIAL, guardarDivision, leerDivision } from "../../src/logica/divisionMatriz";

describe("división de la matriz", () => {
  beforeEach(() => {
    const guardado = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => guardado.set(k, v) };
  });

  it("no deja un cuadrante con menos del 20 %", () => {
    expect(acotar(0.05)).toBe(0.2);
    expect(acotar(0.95)).toBe(0.8);
    expect(acotar(0.6)).toBe(0.6);
    expect(acotar(NaN)).toBe(0.5);
  });

  it("recuerda la división", () => {
    expect(leerDivision()).toEqual(DIVISION_INICIAL);
    guardarDivision({ columna: 0.7, fila: 0.3 });
    expect(leerDivision()).toEqual({ columna: 0.7, fila: 0.3 });
  });
});
