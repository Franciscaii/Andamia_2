import { describe, expect, it } from "vitest";
import { escalaWidget, ESCALA_MAXIMA, ESCALA_MINIMA } from "../../src/logica/widgetEscritorio";

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
