import { TEMAS } from "./temas";

/**
 * Aspecto de un widget del escritorio (app de PC): su tema, cuánto deja ver el escritorio de
 * fondo, qué tan redondeadas son sus esquinas y el tamaño de su letra. Se guarda por widget en
 * este dispositivo y se elige en el apartado Widgets (o en la esquinita del widget).
 */
export interface AspectoWidget {
  /** 0 = fondo opaco, 90 = casi invisible. El texto siempre queda nítido. */
  transparencia: number;
  /** Radio de las esquinas, en píxeles. */
  esquinas: number;
  /** Tema propio del widget; vacío = el mismo de la app. */
  temaId?: string;
  /** Tamaño de la letra, en porcentaje del normal. */
  letra?: number;
}

export const ASPECTO_INICIAL: AspectoWidget = { transparencia: 0, esquinas: 12, temaId: "", letra: 100 };
export const MAX_TRANSPARENCIA = 90;
export const MAX_ESQUINAS = 48;
export const LETRA_MIN_ESCRITORIO = 80;
export const LETRA_MAX_ESCRITORIO = 150;

/** Dónde se guarda el aspecto de cada widget (las ventanas de los widgets escuchan esta clave). */
export const claveAspecto = (id: string) => `andamia-widget-aspecto-${id}`;
const clave = claveAspecto;
const entre = (x: unknown, min: number, max: number, si: number) => (typeof x === "number" && Number.isFinite(x) ? Math.min(max, Math.max(min, Math.round(x))) : si);

export function leerAspecto(id: string): AspectoWidget {
  try {
    const g = JSON.parse(localStorage.getItem(clave(id)) ?? "null");
    if (g && typeof g === "object") {
      return {
        transparencia: entre(g.transparencia, 0, MAX_TRANSPARENCIA, ASPECTO_INICIAL.transparencia),
        esquinas: entre(g.esquinas, 0, MAX_ESQUINAS, ASPECTO_INICIAL.esquinas),
        temaId: typeof g.temaId === "string" && TEMAS.some((t) => t.id === g.temaId) ? g.temaId : "",
        letra: entre(g.letra, LETRA_MIN_ESCRITORIO, LETRA_MAX_ESCRITORIO, 100),
      };
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

/** Tamaños de texto de la app (Tailwind), para agrandarlos o achicarlos solo en un widget. */
const TEXTOS: Record<string, number> = { "--text-xs": 0.75, "--text-sm": 0.875, "--text-base": 1, "--text-lg": 1.125, "--text-xl": 1.25, "--text-2xl": 1.5, "--text-3xl": 1.875, "--text-5xl": 3 };

/** Variables CSS que cambian el tamaño de la letra (no el de los espacios) en un porcentaje. */
export function variablesLetra(letra: number): Record<string, string> {
  const k = letra / 100;
  return Object.fromEntries(Object.entries(TEXTOS).map(([v, rem]) => [v, `${+(rem * k).toFixed(4)}rem`]));
}
