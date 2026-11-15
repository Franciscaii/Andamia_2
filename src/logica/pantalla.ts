import { useEffect, useState } from "react";

/** Desde este ancho la ventana se trata como computador; más angosta, como celular. */
const CONSULTA_COMPUTADOR = "(min-width: 1024px)";

/**
 * Si la vista se muestra como en el computador. `siempre` lo fuerza: los widgets del escritorio
 * son ventanas angostas, pero siguen siendo del computador.
 */
export function useEsComputador(siempre = false): boolean {
  const [es, setEs] = useState(() => siempre || (typeof window !== "undefined" && window.matchMedia(CONSULTA_COMPUTADOR).matches));
  useEffect(() => {
    const m = window.matchMedia(CONSULTA_COMPUTADOR);
    const alCambiar = () => setEs(siempre || m.matches);
    m.addEventListener("change", alCambiar);
    return () => m.removeEventListener("change", alCambiar);
  }, [siempre]);
  return es;
}
