import { beforeEach, describe, expect, it } from "vitest";
import { ASPECTO_INICIAL, guardarAspecto, leerAspecto, opacidades } from "../../src/logica/aspectoWidget";

describe("aspecto de los widgets del escritorio", () => {
  beforeEach(() => {
    const guardado = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => guardado.set(k, v) };
  });

  it("recuerda cada widget por separado y acota los valores", () => {
    expect(leerAspecto("semana")).toEqual(ASPECTO_INICIAL);
    guardarAspecto("semana", { transparencia: 150, esquinas: -3 });
    expect(leerAspecto("semana")).toEqual({ transparencia: 90, esquinas: 0 });
    expect(leerAspecto("matriz")).toEqual(ASPECTO_INICIAL);
  });

  it("las tarjetas quedan más opacas que el fondo", () => {
    expect(opacidades({ transparencia: 0, esquinas: 0 })).toEqual({ fondo: 1, tarjetas: 1 });
    const o = opacidades({ transparencia: 80, esquinas: 0 });
    expect(o.fondo).toBeCloseTo(0.2);
    expect(o.tarjetas).toBeCloseTo(0.4);
  });
});
