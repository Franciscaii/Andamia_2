import { beforeEach, describe, expect, it } from "vitest";
import { guardarAnchos, leerAnchos, moverBorde, pesosAutomaticos, PESO_VACIO } from "../../src/logica/anchosSemana";

describe("anchos de la semana", () => {
  beforeEach(() => {
    const guardado = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => guardado.set(k, v) };
  });

  it("achica los días sin nada", () => {
    expect(pesosAutomaticos([true, false, false, true, true, true, true])).toEqual([PESO_VACIO, 1, 1, PESO_VACIO, PESO_VACIO, PESO_VACIO, PESO_VACIO]);
  });

  it("mover un borde cambia solo esas dos columnas y respeta el mínimo", () => {
    const base = [200, 200, 200, 200, 200, 200, 200];
    expect(moverBorde(base, 1, 50)).toEqual([200, 250, 150, 200, 200, 200, 200]);
    expect(moverBorde(base, 1, 500)).toEqual([200, 304, 96, 200, 200, 200, 200]);
    expect(moverBorde(base, 1, -500)).toEqual([200, 96, 304, 200, 200, 200, 200]);
  });

  it("recuerda los anchos por semana y vuelve a automático", () => {
    guardarAnchos("2026-11-09", [1, 2, 3, 4, 5, 6, 7]);
    expect(leerAnchos("2026-11-09")).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(leerAnchos("2026-11-16")).toBeNull();
    guardarAnchos("2026-11-09", null);
    expect(leerAnchos("2026-11-09")).toBeNull();
  });
});
