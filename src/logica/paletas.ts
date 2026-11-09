/** Temas de color de Andamia: cada uno tiñe toda la app (fondo, menú, tarjetas y acento). */
export type Paleta = "oceano" | "lavanda" | "coral" | "rosa" | "grafito" | "verde";

export const PALETAS: { id: Paleta; nombre: string; muestra: string; fondo: string; lateral: string }[] = [
  { id: "oceano", nombre: "Océano", muestra: "#2f6fb0", fondo: "#f3f7fc", lateral: "#e2ecf8" },
  { id: "lavanda", nombre: "Lavanda", muestra: "#7a52c7", fondo: "#f7f4fc", lateral: "#ebe4f8" },
  { id: "coral", nombre: "Coral", muestra: "#c4553f", fondo: "#fcf5f2", lateral: "#f7e5dd" },
  { id: "rosa", nombre: "Rosa", muestra: "#c2457f", fondo: "#fcf4f8", lateral: "#f8e3ed" },
  { id: "grafito", nombre: "Grafito", muestra: "#4a5058", fondo: "#f4f5f6", lateral: "#e6e8eb" },
  { id: "verde", nombre: "Verde", muestra: "#2f6b5e", fondo: "#faf8f4", lateral: "#f1eee7" },
];

/** Francisca dejó de querer el verde: el tema por defecto es Océano. */
export const PALETA_INICIAL: Paleta = "oceano";
export const CLAVE_PALETA = "andamia-paleta";

export function esPaleta(valor: unknown): valor is Paleta {
  return PALETAS.some((p) => p.id === valor);
}

export function leerPaleta(): Paleta {
  try {
    const v = localStorage.getItem(CLAVE_PALETA);
    return esPaleta(v) ? v : PALETA_INICIAL;
  } catch {
    return PALETA_INICIAL;
  }
}

/** Aplica la paleta a la página y a la barra de la ventana (theme-color). */
export function aplicarPaleta(paleta: Paleta) {
  document.documentElement.dataset.paleta = paleta;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", PALETAS.find((p) => p.id === paleta)!.muestra);
  try {
    localStorage.setItem(CLAVE_PALETA, paleta);
  } catch {
    // Sin almacenamiento: dura mientras la página siga abierta.
  }
}
