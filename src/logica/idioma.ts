import { enUS, es as esLocale } from "date-fns/locale";
import type { Locale } from "date-fns";

export type Idioma = "es" | "en";
export const IDIOMAS: { id: Idioma; nombre: string }[] = [
  { id: "es", nombre: "Español" },
  { id: "en", nombre: "English" },
];

const CLAVE = "andamia-idioma";
// Este archivo también lo usa el service worker (sin DOM): se accede a la ventana sin tiparla.
const entorno = globalThis as unknown as { localStorage?: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }; location?: { reload: () => void } };

/** El idioma se guarda en este dispositivo; si nunca se eligió, es español. */
export function leerIdioma(): Idioma {
  try {
    return entorno.localStorage?.getItem(CLAVE) === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}

/** Guarda el idioma. La app se recarga para que toda ella (textos, fechas, widgets) cambie junta. */
export function elegirIdioma(idioma: Idioma, recargar = true) {
  try {
    entorno.localStorage?.setItem(CLAVE, idioma);
  } catch {
    /* sin almacenamiento: no se puede recordar */
  }
  if (recargar) entorno.location?.reload();
}

export const IDIOMA: Idioma = leerIdioma();

/** Fechas: el inglés conserva el lunes como primer día de la semana, igual que el español. */
const ingles: Locale = { ...enUS, options: esLocale.options };
export const es: Locale = IDIOMA === "en" ? ingles : esLocale;
