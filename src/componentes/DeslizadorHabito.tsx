import { useRef, type KeyboardEvent, type MouseEvent } from "react";
import { Check } from "lucide-react";

const PERILLA_GRANDE = 24;
const MARGEN = 2;

/**
 * Interruptor largo de un hábito: se marca pinchando su lado derecho y se desmarca pinchando el
 * izquierdo; pinchar el círculo lo cambia siempre (marca o desmarca). No se arrastra.
 * Con teclado: Enter o Espacio.
 */
export function DeslizadorHabito({ nombre, color, hecho, marcable, alCambiar, clase = "min-w-0 flex-1", pequeno = false }: { nombre: string; color: string; hecho: boolean; marcable: boolean; alCambiar: (hecho: boolean, origen?: { x: number; y: number }) => void; clase?: string; pequeno?: boolean }) {
  const PERILLA = pequeno ? 16 : PERILLA_GRANDE;
  const riel = useRef<HTMLDivElement>(null);
  const avance = hecho ? 1 : 0;

  const alPinchar = (e: MouseEvent) => {
    e.stopPropagation();
    if (!marcable || !riel.current) return;
    const r = riel.current.getBoundingClientRect();
    const derecha = e.clientX >= r.left + r.width / 2;
    // Pinchar el círculo siempre lo cambia: a la izquierda lo marca y a la derecha lo desmarca.
    const enCirculo = (e.target as HTMLElement).closest("[data-testid='perilla-habito']") !== null;
    // Al marcar, el confeti sale del círculo ya puesto a la derecha.
    const origen = { x: r.right - MARGEN - PERILLA / 2, y: r.top + r.height / 2 };
    if (enCirculo) alCambiar(!hecho, origen);
    else if (derecha !== hecho) alCambiar(derecha, origen);
  };
  const alTeclear = (e: KeyboardEvent) => {
    if (!marcable || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    const r = riel.current?.getBoundingClientRect();
    alCambiar(!hecho, r ? { x: r.right - MARGEN - PERILLA / 2, y: r.top + r.height / 2 } : undefined);
  };

  const izquierda = `calc(${MARGEN}px + (100% - ${PERILLA + 2 * MARGEN}px) * ${avance})`;
  return (
    <div
      ref={riel}
      role="switch"
      tabIndex={marcable ? 0 : -1}
      aria-checked={hecho}
      aria-disabled={!marcable}
      aria-label={`Hábito ${nombre}`}
      data-testid="deslizador-habito"
      title={marcable ? (hecho ? "Pincha el círculo o a la izquierda para quitar la marca" : "Pincha el círculo o a la derecha para marcarlo hecho") : "Todavía no llega este día"}
      onClick={alPinchar}
      onKeyDown={alTeclear}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 42%, white)` }}
      className={`relative ${pequeno ? "h-5" : "h-7"} ${clase} overflow-hidden rounded-full ring-1 ring-borde ring-inset ${marcable ? "cursor-pointer" : "opacity-40"}`}
    >
      {/* El lado izquierdo se colorea hasta donde va el círculo. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ease-out"
        style={{ width: avance === 0 ? 0 : `calc(${izquierda} + ${PERILLA + MARGEN}px)`, background: `linear-gradient(90deg, color-mix(in srgb, ${color} 72%, white), ${color})` }}
      />
      <span
        data-testid="perilla-habito"
        style={{ left: izquierda, width: PERILLA, height: PERILLA }}
        className="absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-[left] duration-200 ease-out"
      >
        <Check size={pequeno ? 9 : 12} strokeWidth={3.5} style={{ color: hecho ? color : "#c5cad3" }} />
      </span>
    </div>
  );
}
