/** Temas de color de Andamia: cambian el color de acento (botones, día de hoy, menú). */
export type Paleta = "oceano" | "lavanda" | "coral" | "rosa" | "grafito" | "verde";

export const PALETAS: { id: Paleta; nombre: string; muestra: string }[] = [
  { id: "oceano", nombre: "Océano", muestra: "#2f6fb0" },
  { id: "lavanda", nombre: "Lavanda", muestra: "#7a52c7" },
  { id: "coral", nombre: "Coral", muestra: "#c4553f" },
  { id: "rosa", nombre: "Rosa", muestra: "#c2457f" },
  { id: "grafito", nombre: "Grafito", muestra: "#4a5058" },
  { id: "verde", nombre: "Verde", muestra: "#2f6b5e" },
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
