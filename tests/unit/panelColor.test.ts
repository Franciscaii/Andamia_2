import { describe, expect, it } from "vitest";
import { hexAHsv, hsvAHex } from "../../src/componentes/PanelColor";

describe("selector de color", () => {
  it("va y vuelve entre hex y tono/intensidad/brillo", () => {
    for (const hex of ["#ff0000", "#12ab34", "#3d94cc", "#000000", "#ffffff", "#9b5cd6"]) {
      expect(hsvAHex(hexAHsv(hex))).toBe(hex);
    }
  });

  it("el rojo puro es tono 0, intensidad y brillo al máximo", () => {
    expect(hexAHsv("#ff0000")).toEqual([0, 1, 1]);
    expect(hexAHsv("#00ff00")[0]).toBe(120);
    expect(hexAHsv("#0000ff")[0]).toBe(240);
  });

  it("un color mal escrito no rompe: parte de un azul suave", () => {
    expect(hexAHsv("azul")[0]).toBe(200);
  });
});
