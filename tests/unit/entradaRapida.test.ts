import { describe, expect, it } from "vitest";
import { format, parseISO } from "date-fns";
import { interpretarEntrada } from "../../src/logica/entradaRapida";

// Miércoles 4 de noviembre de 2026, 14:00 hora local.
const AHORA = new Date(2026, 10, 4, 14, 0, 0);
const LISTAS = [
  { id: "t", nombre: "Trabajo" },
  { id: "c", nombre: "Casa de campo" },
];

const leer = (texto: string) => interpretarEntrada(texto, AHORA, LISTAS);
const local = (vence: string | null) => (vence ? format(parseISO(vence), "yyyy-MM-dd HH:mm") : null);

describe("fechas relativas", () => {
  it.each([
    ["Pagar hoy", "Pagar", "2026-11-04"],
    ["Llamar mañana", "Llamar", "2026-11-05"],
    ["Llamar manana", "Llamar", "2026-11-05"],
    ["Pagar pasado mañana", "Pagar", "2026-11-06"],
    ["Pagar PASADO MANANA", "Pagar", "2026-11-06"],
    ["Pagar ayer", "Pagar", "2026-11-03"],
    ["Enviar propuesta mañana", "Enviar propuesta", "2026-11-05"],
    ["Hola mañana", "Hola", "2026-11-05"],
    ["Revisar en 3 días", "Revisar", "2026-11-07"],
    ["Revisar en 2 semanas", "Revisar", "2026-11-18"],
  ])("%s", (texto, titulo, vence) => {
    const r = leer(texto);
    expect(r.titulo).toBe(titulo);
    expect(r.vence).toBe(vence);
    expect(r.todoElDia).toBe(true);
  });
});

describe("días de la semana", () => {
  it.each([
    ["Reunión el viernes", "Reunión", "2026-11-06"],
    ["Reunión del viernes", "Reunión", "2026-11-06"],
    ["Clase lunes", "Clase", "2026-11-09"],
    ["Clase el próximo lunes", "Clase", "2026-11-09"],
    ["Ir al mercado el sábado", "Ir al mercado", "2026-11-07"],
    ["Cita sabado", "Cita", "2026-11-07"],
    ["Cita el domingo", "Cita", "2026-11-08"],
  ])("%s", (texto, titulo, vence) => {
    const r = leer(texto);
    expect(r.titulo).toBe(titulo);
    expect(r.vence).toBe(vence);
  });

  it("el mismo día de la semana apunta a la semana siguiente", () => {
    expect(leer("Clase miércoles").vence).toBe("2026-11-11");
  });
});

describe("horas", () => {
  it.each([
    ["Café mañana 9am", "Café", "2026-11-05 09:00"],
    ["Café mañana 9 am", "Café", "2026-11-05 09:00"],
    ["Cena mañana 9pm", "Cena", "2026-11-05 21:00"],
    ["Cena mañana 9:30 pm", "Cena", "2026-11-05 21:30"],
    ["Corte mañana 12am", "Corte", "2026-11-05 00:00"],
    ["Almuerzo mañana 12pm", "Almuerzo", "2026-11-05 12:00"],
    ["Clase mañana 18:30", "Clase", "2026-11-05 18:30"],
    ["Clase mañana a las 10", "Clase", "2026-11-05 10:00"],
    ["Clase mañana a la 1", "Clase", "2026-11-05 01:00"],
    ["Yoga mañana a las 7 de la mañana", "Yoga", "2026-11-05 07:00"],
    ["Yoga el lunes a las 6 de la tarde", "Yoga", "2026-11-09 18:00"],
  ])("%s", (texto, titulo, esperado) => {
    const r = leer(texto);
    expect(r.titulo).toBe(titulo);
    expect(local(r.vence)).toBe(esperado);
    expect(r.todoElDia).toBe(false);
  });

  it("una hora futura sola es para hoy", () => {
    expect(local(leer("Llamar 18:30").vence)).toBe("2026-11-04 18:30");
  });

  it("una hora ya pasada sola es para mañana", () => {
    expect(local(leer("Llamar 9am").vence)).toBe("2026-11-05 09:00");
  });

  it("una fecha de hoy con hora pasada se respeta", () => {
    expect(local(leer("Llamar hoy 9am").vence)).toBe("2026-11-04 09:00");
  });

  it("una hora imposible queda en el título", () => {
    const r = leer("Revisar 25:99");
    expect(r.titulo).toBe("Revisar 25:99");
    expect(r.vence).toBeNull();
  });
});

describe("fechas explícitas", () => {
  it("reconoce día y mes", () => {
    const r = leer("Viaje el 20 de diciembre");
    expect(r.titulo).toBe("Viaje");
    expect(r.vence).toBe("2026-12-20");
  });

  it("reconoce día, mes y hora", () => {
    const r = leer("Viaje 20 de diciembre a las 10");
    expect(r.titulo).toBe("Viaje");
    expect(local(r.vence)).toBe("2026-12-20 10:00");
  });

  it("un mes ya pasado va al año siguiente", () => {
    expect(leer("Examen 3 de marzo").vence).toBe("2027-03-03");
  });
});

describe("prioridad, etiquetas y lista", () => {
  it("combina todos los datos", () => {
    const r = leer("Enviar informe mañana 9am !alta #trabajo #urgente ~Trabajo");
    expect(r.titulo).toBe("Enviar informe");
    expect(local(r.vence)).toBe("2026-11-05 09:00");
    expect(r.prioridad).toBe("alta");
    expect(r.etiquetas).toEqual(["trabajo", "urgente"]);
    expect(r.listaId).toBe("t");
  });

  it.each(["alta", "media", "baja", "ninguna"])("!%s", (p) => {
    expect(leer(`Tarea !${p}`).prioridad).toBe(p);
    expect(leer(`Tarea !${p}`).titulo).toBe("Tarea");
  });

  it("una prioridad desconocida queda en el título", () => {
    const r = leer("Avisar !ya");
    expect(r.prioridad).toBeNull();
    expect(r.titulo).toBe("Avisar !ya");
  });

  it("admite listas con espacios y sin distinguir mayúsculas", () => {
    const r = leer("Podar ~casa de campo");
    expect(r.listaId).toBe("c");
    expect(r.titulo).toBe("Podar");
  });

  it("una lista desconocida queda en el título", () => {
    const r = leer("Podar ~jardín");
    expect(r.listaId).toBeNull();
    expect(r.titulo).toBe("Podar ~jardín");
  });

  it("no confunde # dentro de una palabra", () => {
    expect(leer("Canal C#1").etiquetas).toEqual([]);
  });
});

describe("casos que no deben interpretarse como fecha", () => {
  it.each([
    ["Comprar 3 manzanas"],
    ["Soy el responsable"],
    ["Mañanas de yoga"],
    ["Hoyo en el jardín"],
    ["Revisar marzo2026"],
    ["Ver capítulo 12"],
    ["Reunión con María"],
    ["Cita con Abril"],
    ["Saludar a Julio"],
    ["Llamar a Mayo"],
    ["Marzo es largo"],
    ["Decir sol y mar"],
    ["Pagar 12 cuotas"],
  ])("%s", (texto) => {
    const r = leer(texto);
    expect(r.vence).toBeNull();
    expect(r.titulo).toBe(texto);
  });

  it("por la mañana no significa mañana", () => {
    const r = leer("Correr por la mañana");
    expect(r.vence).toBeNull();
    expect(r.titulo).toBe("Correr por la mañana");
  });

  it("mañana por la mañana sí es mañana", () => {
    const r = leer("Correr mañana por la mañana");
    expect(r.vence).toBe("2026-11-05");
    expect(r.titulo).toBe("Correr por la mañana");
  });

  it("un texto que solo es una fecha se conserva como título", () => {
    const r = leer("mañana");
    expect(r.titulo).toBe("mañana");
    expect(r.vence).toBeNull();
  });
});
