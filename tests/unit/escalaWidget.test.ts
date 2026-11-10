import { describe, expect, it } from "vitest";
import { escalaQueCabe, escalaWidget, ESCALA_MAXIMA, ESCALA_MINIMA } from "../../src/logica/widgetEscritorio";

describe("escala del contenido de un widget", () => {
  const base = { ancho: 1000, alto: 600 };
  it("a su tamaño normal no cambia, y se achica o agranda según el lado que más limita", () => {
    expect(escalaWidget(base, 1000, 600)).toBe(1);
    expect(escalaWidget(base, 600, 600)).toBe(0.6);
    expect(escalaWidget(base, 1200, 660)).toBe(1.1);
  });
  it("tiene un mínimo y un máximo", () => {
    expect(escalaWidget(base, 100, 100)).toBe(ESCALA_MINIMA);
    expect(escalaWidget(base, 5000, 5000)).toBe(ESCALA_MAXIMA);
  });
});

describe("escala inicial del widget Semana (según el ancho)", () => {
  const base = { ancho: 1000 };
  it("sigue al ancho, entre el mínimo y el máximo", () => {
    expect(escalaQueCabe(base, 1000)).toBe(1);
    expect(escalaQueCabe(base, 800)).toBe(0.8);
    expect(escalaQueCabe(base, 100)).toBe(ESCALA_MINIMA);
    expect(escalaQueCabe(base, 5000)).toBe(ESCALA_MAXIMA);
  });
});
