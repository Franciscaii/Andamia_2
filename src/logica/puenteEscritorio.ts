import { useEffect, useState } from "react";

/** Lo que la app de PC le da a la ventana principal (ver escritorio/precarga-principal.cjs). */
export interface PuenteEscritorio {
  widgetsAbiertos: () => Promise<string[]>;
  abrirWidget: (id: string) => void;
  cerrarWidget: (id: string) => void;
  alCambiarWidgets: (fn: (abiertos: string[]) => void) => () => void;
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
