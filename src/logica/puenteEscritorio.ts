import { useEffect, useState } from "react";

/** Lo que la app de PC le da a la ventana principal (ver escritorio/precarga-principal.cjs). */
export interface PuenteEscritorio {
  widgetsAbiertos: () => Promise<string[]>;
  abrirWidget: (id: string) => void;
  cerrarWidget: (id: string) => void;
  alCambiarWidgets: (fn: (abiertos: string[]) => void) => () => void;
  /** Desde la 1.4.2: la ventana no tiene barra de título; alto de la zona de los botones de Windows. */
  altoBarra?: number;
  colorBarra?: (colores: { fondo: string; simbolos: string }) => void;
}

/**
 * App de PC sin barra de título: deja una franja arriba para mover la ventana (sobre ella van los
 * botones de Windows) y les avisa los colores del tema. Devuelve el alto de la franja, o 0 si no aplica.
 */
export function useBarraVentana(): number {
  const p = puenteEscritorio();
  const alto = p?.colorBarra ? p.altoBarra ?? 32 : 0;
  useEffect(() => {
    if (!p?.colorBarra) return;
    const avisar = () => {
      const oscuro = document.documentElement.classList.contains("dark");
      p.colorBarra!({ fondo: "#00000000", simbolos: oscuro ? "#e5e7eb" : "#374151" });
    };
    avisar();
    const obs = new MutationObserver(avisar);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-tema"] });
    return () => obs.disconnect();
  }, [p]);
  return alto;
}

/** El puente, solo si Andamia corre dentro de la app de PC (en el navegador no existe). */
export function puenteEscritorio(): PuenteEscritorio | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { andamiaEscritorio?: PuenteEscritorio }).andamiaEscritorio;
}

/** Widgets que están puestos en el escritorio; se actualiza si se ponen o quitan desde otro lado. */
export function useWidgetsAbiertos(): string[] {
  const [abiertos, setAbiertos] = useState<string[]>([]);
  useEffect(() => {
    const p = puenteEscritorio();
    if (!p) return;
    let vivo = true;
    void p.widgetsAbiertos().then((ids) => vivo && setAbiertos(ids));
    const quitar = p.alCambiarWidgets((ids) => setAbiertos(ids));
    return () => {
      vivo = false;
      quitar();
    };
  }, []);
  return abiertos;
}
