import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { semanasDelMes } from "../../src/vistas/VistaSemana";

describe("mes desplegado del celular", () => {
  it("muestra 6 semanas de lunes a domingo que contienen todo el mes", () => {
    const semanas = semanasDelMes(new Date(2026, 10, 11));
    expect(semanas).toHaveLength(6);
    expect(semanas.every((s) => s.length === 7)).toBe(true);
    expect(format(semanas[0][0], "yyyy-MM-dd")).toBe("2026-10-26");
    expect(semanas[0][0].getDay()).toBe(1);
    const dias = semanas.flat().map((d) => format(d, "yyyy-MM-dd"));
    expect(dias).toContain("2026-11-01");
    expect(dias).toContain("2026-11-30");
  });
});
