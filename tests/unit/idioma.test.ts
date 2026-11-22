import { describe, expect, it } from "vitest";
import { aIngles } from "../../src/logica/traducciones";

describe("traducción al inglés", () => {
  it("traduce textos completos y conserva los espacios", () => {
    expect(aIngles("Guardar")).toBe("Save");
    expect(aIngles("  Cancelar ")).toBe("  Cancel ");
  });
  it("traduce textos con partes que cambian", () => {
    expect(aIngles("Completar: Comprar pan")).toBe("Complete: Comprar pan");
    expect(aIngles("Mover Reunión")).toBe("Move Reunión");
    expect(aIngles("Añadir tarea en Urgente + Importante")).toBe("Add task in Urgent + Important");
    expect(aIngles("Monday 9 de November")).toBe("Monday November 9");
  });
  it("deja en español lo que no conoce", () => {
    expect(aIngles("Texto que escribió la persona")).toBe("Texto que escribió la persona");
  });
});
