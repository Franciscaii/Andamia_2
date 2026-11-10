/**
 * Aspecto de un widget del escritorio (app de PC): cuánto deja ver el escritorio de fondo
 * y qué tan redondeadas son sus esquinas. Se guarda por widget en este dispositivo.
 */
export interface AspectoWidget {
  /** 0 = fondo opaco, 90 = casi invisible. El texto siempre queda nítido. */
  transparencia: number;
  /** Radio de las esquinas, en píxeles. */
  esquinas: number;
}

export const ASPECTO_INICIAL: AspectoWidget = { transparencia: 0, esquinas: 12 };
export const MAX_TRANSPARENCIA = 90;
export const MAX_ESQUINAS = 28;

const clave = (id: string) => `andamia-widget-aspecto-${id}`;
const entre = (x: unknown, min: number, max: number, si: number) => (typeof x === "number" && Number.isFinite(x) ? Math.min(max, Math.max(min, Math.round(x))) : si);

export function leerAspecto(id: string): AspectoWidget {
  try {
    const g = JSON.parse(localStorage.getItem(clave(id)) ?? "null");
    if (g && typeof g === "object") {
      return { transparencia: entre(g.transparencia, 0, MAX_TRANSPARENCIA, ASPECTO_INICIAL.transparencia), esquinas: entre(g.esquinas, 0, MAX_ESQUINAS, ASPECTO_INICIAL.esquinas) };
    }
  } catch {
    // Valor dañado o sin almacenamiento.
  }
  return ASPECTO_INICIAL;
}

export function guardarAspecto(id: string, a: AspectoWidget) {
  try {
    localStorage.setItem(clave(id), JSON.stringify(a));
  } catch {
    // Sin almacenamiento: dura mientras la ventana siga abierta.
  }
}

/** Opacidad del fondo y de las tarjetas: las tarjetas se aclaran menos, para que se sigan leyendo. */
export function opacidades(a: AspectoWidget): { fondo: number; tarjetas: number } {
  const t = a.transparencia / 100;
  return { fondo: 1 - t, tarjetas: 1 - t * 0.75 };
}
