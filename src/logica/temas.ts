/**
 * Temas de Andamia, al estilo de HorarioWidgets: cada tema es un estilo completo
 * (menú de color, fondo sólido/degradado/imagen, tarjetas, esquinas y tamaño del texto)
 * y se puede personalizar. Se guarda en este dispositivo.
 */
import { esAppNativa } from "./plataforma";

export type TipoFondo = "solido" | "degradado" | "imagen";

export interface Tema {
  id: string;
  nombre: string;
  oscuro: boolean;
  lateral: string;
  lateralTexto: string;
  fondo: string;
  fondo2: string;
  tipoFondo: TipoFondo;
  panel: string;
  texto: string;
  acento: string;
  /** 0 a 100. */
  opacidadLateral: number;
  opacidadPaneles: number;
  /** Radio de las esquinas grandes, en píxeles. */
  radio: number;
  /** Porcentaje del tamaño normal del texto. */
  escalaTexto: number;
  /** Imagen de fondo (data URL), cuando tipoFondo es "imagen". */
  imagen?: string;
}

const BASE = { opacidadLateral: 100, opacidadPaneles: 100, radio: 8, escalaTexto: 100 };

export const TEMAS: Tema[] = [
  { ...BASE, id: "clasico", nombre: "Clásico", oscuro: false, lateral: "#1a3e7a", lateralTexto: "#ffffff", fondo: "#f4f7fc", fondo2: "#e8eef9", tipoFondo: "solido", panel: "#ffffff", texto: "#1f2a3a", acento: "#1a3e7a" },
  { ...BASE, id: "noche", nombre: "Noche", oscuro: true, lateral: "#111827", lateralTexto: "#f9fafb", fondo: "#0f172a", fondo2: "#1e293b", tipoFondo: "solido", panel: "#1a2436", texto: "#f1f5f9", acento: "#60a5fa" },
  { ...BASE, id: "castillo", nombre: "Castillo", oscuro: true, lateral: "#2a1b12", lateralTexto: "#f4c773", fondo: "#1c1410", fondo2: "#3a2115", tipoFondo: "degradado", panel: "#2b1e16", texto: "#fbebd0", acento: "#f4a340", radio: 6, opacidadPaneles: 92 },
  { ...BASE, id: "cristal", nombre: "Cristal", oscuro: false, lateral: "#000000", lateralTexto: "#ffffff", fondo: "#6a8fd8", fondo2: "#c98bd9", tipoFondo: "degradado", panel: "#ffffff", texto: "#111827", acento: "#4f46e5", opacidadLateral: 35, opacidadPaneles: 82, radio: 12 },
  { ...BASE, id: "menta", nombre: "Menta", oscuro: false, lateral: "#0f766e", lateralTexto: "#ffffff", fondo: "#ffffff", fondo2: "#e6f7f4", tipoFondo: "degradado", panel: "#ffffff", texto: "#134e4a", acento: "#0f766e", radio: 12 },
  { ...BASE, id: "lavanda", nombre: "Lavanda", oscuro: false, lateral: "#6d28d9", lateralTexto: "#ffffff", fondo: "#fcfaff", fondo2: "#f1eafd", tipoFondo: "solido", panel: "#ffffff", texto: "#3b1f73", acento: "#6d28d9", radio: 12 },
  { ...BASE, id: "oceano", nombre: "Océano", oscuro: false, lateral: "#0e4f74", lateralTexto: "#ffffff", fondo: "#f1f8fc", fondo2: "#d9ecf7", tipoFondo: "degradado", panel: "#ffffff", texto: "#0f2f45", acento: "#0e7490", radio: 12 },
  { ...BASE, id: "rosa", nombre: "Rosa", oscuro: false, lateral: "#c2185b", lateralTexto: "#ffffff", fondo: "#fff6fa", fondo2: "#fde3ee", tipoFondo: "degradado", panel: "#ffffff", texto: "#5a1734", acento: "#d63384", radio: 14 },
  { ...BASE, id: "arena", nombre: "Arena", oscuro: false, lateral: "#8a5a2b", lateralTexto: "#fff8ee", fondo: "#faf6ef", fondo2: "#f1e6d4", tipoFondo: "degradado", panel: "#fffdf9", texto: "#3e2c1a", acento: "#b06a2c", radio: 10 },
  { ...BASE, id: "cielo", nombre: "Cielo", oscuro: false, lateral: "#2563eb", lateralTexto: "#ffffff", fondo: "#bfe3ff", fondo2: "#f3d9ff", tipoFondo: "degradado", panel: "#ffffff", texto: "#1e293b", acento: "#2563eb", opacidadLateral: 85, opacidadPaneles: 88, radio: 14 },
  { ...BASE, id: "grafito", nombre: "Grafito", oscuro: true, lateral: "#18181b", lateralTexto: "#fafafa", fondo: "#121214", fondo2: "#1c1c20", tipoFondo: "solido", panel: "#1f1f23", texto: "#ececf1", acento: "#fbbf24", radio: 10 },
  { ...BASE, id: "medianoche", nombre: "Medianoche", oscuro: true, lateral: "#1e1036", lateralTexto: "#ede9fe", fondo: "#140b26", fondo2: "#2a1650", tipoFondo: "degradado", panel: "#22163b", texto: "#f3e8ff", acento: "#a78bfa", radio: 12 },
  { ...BASE, id: "cereza", nombre: "Cereza", oscuro: true, lateral: "#3b0d16", lateralTexto: "#ffe4e6", fondo: "#1f0a10", fondo2: "#3d1220", tipoFondo: "degradado", panel: "#2a1018", texto: "#ffe4e6", acento: "#fb7185", radio: 12 },
  { ...BASE, id: "atardecer", nombre: "Atardecer", oscuro: false, lateral: "#be3a5a", lateralTexto: "#fff5ee", fondo: "#fff5ec", fondo2: "#ffdce5", tipoFondo: "degradado", panel: "#ffffff", texto: "#5c1f30", acento: "#be3a5a" },
];

export const TEMA_INICIAL = "clasico";
export const TEMA_OSCURO_INICIAL = "noche";

export type AjustesTema = Partial<Omit<Tema, "id" | "nombre">>;
export interface EleccionTema {
  id: string;
  ajustes: AjustesTema;
}

export const CLAVE_TEMA = "andamia-tema-elegido";
/** Lo que lee index.html antes de pintar, para que no parpadee. */
export const CLAVE_VARIABLES = "andamia-tema-variables";
const CLAVE_ULTIMO = { claro: "andamia-tema-ultimo-claro", oscuro: "andamia-tema-ultimo-oscuro" };

export function presetDe(id: string): Tema {
  return TEMAS.find((t) => t.id === id) ?? TEMAS[0];
}

export function temaEfectivo(e: EleccionTema): Tema {
  return { ...presetDe(e.id), ...e.ajustes };
}

function leerLocal(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardarLocal(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento (o lleno): dura mientras la página siga abierta.
  }
}

export function leerEleccion(): EleccionTema {
  try {
    const g = JSON.parse(leerLocal(CLAVE_TEMA) ?? "null");
    if (g && typeof g.id === "string" && TEMAS.some((t) => t.id === g.id)) return { id: g.id, ajustes: g.ajustes ?? {} };
  } catch {
    // Valor dañado: se usa el inicial.
  }
  // Quien usaba el modo oscuro antes de los temas sigue en oscuro.
  return { id: leerLocal("andamia-tema") === "oscuro" ? TEMA_OSCURO_INICIAL : TEMA_INICIAL, ajustes: {} };
}

/** Último tema claro u oscuro elegido, para el botón de sol y luna del menú. */
export function ultimoTema(oscuro: boolean): string {
  const id = leerLocal(oscuro ? CLAVE_ULTIMO.oscuro : CLAVE_ULTIMO.claro);
  const t = TEMAS.find((x) => x.id === id && x.oscuro === oscuro);
  return t ? t.id : oscuro ? TEMA_OSCURO_INICIAL : TEMA_INICIAL;
}

function luminancia(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const canal = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

/** Texto legible sobre un color: blanco o casi negro. */
export function textoSobre(hex: string): string {
  return luminancia(hex) > 0.45 ? "#14171a" : "#ffffff";
}

const mezcla = (color: string, pct: number, con: string) => `color-mix(in srgb, ${color} ${pct}%, ${con})`;
const conOpacidad = (color: string, op: number) => (op >= 100 ? color : mezcla(color, Math.max(0, op), "transparent"));

export function capaFondo(t: Tema): string {
  if (t.tipoFondo === "imagen" && t.imagen) return `url("${t.imagen}") center / cover no-repeat fixed, ${t.fondo}`;
  if (t.tipoFondo === "degradado") return `linear-gradient(160deg, ${t.fondo}, ${t.fondo2}) fixed`;
  return t.fondo;
}

/** Variables CSS del tema (ver src/estilos.css). */
export function variablesDe(t: Tema): Record<string, string> {
  const p = t.panel;
  const app = {
    texto: t.texto,
    tenue: mezcla(t.texto, 62, p),
    suave: mezcla(t.texto, 8, p),
    borde: mezcla(t.texto, 16, p),
    acento: t.acento,
    "acento-suave": mezcla(t.acento, 16, p),
    "sobre-acento": textoSobre(t.acento),
  };
  const v: Record<string, string> = {
    "--fondo": t.fondo,
    "--fondo-capa": capaFondo(t),
    "--panel": conOpacidad(p, t.opacidadPaneles),
    "--panel-solido": p,
    // Los campos para escribir: casi del color de las tarjetas, siempre opacos.
    "--campo": mezcla(t.texto, 4, p),
    "--lateral": conOpacidad(t.lateral, t.opacidadLateral),
    "--lat-base": t.lateral,
    "--lat-texto": t.lateralTexto,
    "--radius-sm": `${t.radio * 0.5}px`,
    "--radius-md": `${t.radio * 0.75}px`,
    "--radius-lg": `${t.radio}px`,
    "--radius-xl": `${t.radio * 1.5}px`,
    "--radius-2xl": `${t.radio * 2}px`,
  };
  for (const [k, valor] of Object.entries(app)) {
    v[`--${k}`] = valor;
    v[`--app-${k}`] = valor;
  }
  return v;
}

/** Aplica el tema a la página y a la barra de la ventana, y lo guarda en este dispositivo. */
export function aplicarTema(e: EleccionTema) {
  const t = temaEfectivo(e);
  const vars = variablesDe(t);
  const raiz = document.documentElement;
  for (const [k, valor] of Object.entries(vars)) raiz.style.setProperty(k, valor);
  raiz.style.fontSize = `${t.escalaTexto}%`;
  raiz.classList.toggle("dark", t.oscuro);
  raiz.dataset.tema = t.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.lateral);
  if (esAppNativa()) {
    // Arriba el color del inicio del fondo y abajo el del final (en un degradado): las franjas del teléfono quedan igual a lo que se ve.
    const abajo = t.tipoFondo === "degradado" ? t.fondo2 : t.fondo;
    void import("./widgetAndroid").then((m) => m.pintarBarraSistema(t.fondo, luminancia(t.fondo) <= 0.45, abajo, luminancia(abajo) <= 0.45));
  }
  guardarLocal(CLAVE_TEMA, JSON.stringify(e));
  guardarLocal(t.oscuro ? CLAVE_ULTIMO.oscuro : CLAVE_ULTIMO.claro, t.id);
  guardarLocal("andamia-tema", t.oscuro ? "oscuro" : "claro");
  guardarLocal(CLAVE_VARIABLES, JSON.stringify({ vars, oscuro: t.oscuro, color: t.lateral, escala: t.escalaTexto, id: t.id }));
}

/** Achica la imagen elegida para que quepa en el almacenamiento del navegador. */
export function leerImagenFondo(archivo: File, lado = 1600): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.round(img.width * k);
      lienzo.height = Math.round(img.height * k);
      lienzo.getContext("2d")!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
      URL.revokeObjectURL(url);
      resolver(lienzo.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error("No se pudo leer la imagen."));
    };
    img.src = url;
  });
}
