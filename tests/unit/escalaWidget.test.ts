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

describe("escala del widget Semana para que todo quepa", () => {
  const base = { ancho: 1000 };
  it("usa el ancho si el contenido cabe en el alto", () => {
    expect(escalaQueCabe(base, 1000, 500, 800)).toBe(1);
    expect(escalaQueCabe(base, 800, null, 300)).toBe(0.8);
  });
  it("se achica si el contenido no cabe, sin bajar del mínimo", () => {
    expect(escalaQueCabe(base, 1000, 1000, 700)).toBe(0.7);
    expect(escalaQueCabe(base, 1000, 5000, 300)).toBe(ESCALA_MINIMA);
  });
});
