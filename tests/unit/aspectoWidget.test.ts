import { beforeEach, describe, expect, it } from "vitest";
import { ASPECTO_INICIAL, guardarAspecto, leerAspecto, opacidades, variablesLetra } from "../../src/logica/aspectoWidget";

describe("aspecto de los widgets del escritorio", () => {
  beforeEach(() => {
    const guardado = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => guardado.set(k, v) };
  });

  it("recuerda cada widget por separado y acota los valores", () => {
    expect(leerAspecto("semana")).toEqual(ASPECTO_INICIAL);
    guardarAspecto("semana", { transparencia: 150, esquinas: -3 });
    expect(leerAspecto("semana")).toEqual({ transparencia: 90, esquinas: 0, temaId: "", letra: 100 });
    expect(leerAspecto("matriz")).toEqual(ASPECTO_INICIAL);
  });

  it("guarda tema y tamaño de letra válidos", () => {
    guardarAspecto("semana", { transparencia: 10, esquinas: 8, temaId: "no-existe", letra: 400 });
    expect(leerAspecto("semana")).toMatchObject({ temaId: "", letra: 150 });
    expect(variablesLetra(100)["--text-base"]).toBe("1rem");
    expect(variablesLetra(150)["--text-base"]).toBe("1.5rem");
  });

  it("las tarjetas quedan más opacas que el fondo", () => {
    expect(opacidades({ transparencia: 0, esquinas: 0 })).toEqual({ fondo: 1, tarjetas: 1 });
    const o = opacidades({ transparencia: 80, esquinas: 0 });
    expect(o.fondo).toBeCloseTo(0.2);
    expect(o.tarjetas).toBeCloseTo(0.4);
    // Con su propio ajuste, las tarjetas no dependen del fondo.
    expect(opacidades({ transparencia: 80, esquinas: 0, tarjetas: 10 }).tarjetas).toBeCloseTo(0.9);
    guardarAspecto("semana", { transparencia: 0, esquinas: 0, tarjetas: 50 });
    expect(leerAspecto("semana").tarjetas).toBe(50);
  });
});
