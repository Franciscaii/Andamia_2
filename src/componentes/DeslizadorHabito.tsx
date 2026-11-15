import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Check } from "lucide-react";

const PERILLA = 24;
const MARGEN = 2;
/** Hasta dónde hay que llevar el círculo para que cuente (y cuánto hay que devolverlo para quitar la marca). */
const UMBRAL = 0.8;

/**
 * Interruptor largo de un hábito: el círculo se arrastra hacia la derecha y el lado
 * izquierdo se va coloreando; al soltarlo cerca del final queda hecho. Arrastrarlo de vuelta a la
 * izquierda quita la marca. Un toque no lo cambia (con teclado: Enter o Espacio).
 */
export function DeslizadorHabito({ nombre, color, hecho, marcable, alCambiar, clase = "min-w-0 flex-1" }: { nombre: string; color: string; hecho: boolean; marcable: boolean; alCambiar: (hecho: boolean) => void; clase?: string }) {
  const riel = useRef<HTMLDivElement>(null);
  // Dónde empezó el arrastre y hasta dónde va (en una ref: al soltar puede que el último movimiento aún no se haya pintado).
  const inicio = useRef<{ x: number; avance: number; ahora: number } | null>(null);
  // Avance del círculo mientras se arrastra, de 0 (izquierda) a 1 (derecha); null cuando está suelto.
  const [arrastre, setArrastre] = useState<number | null>(null);
  const avance = arrastre ?? (hecho ? 1 : 0);
  const recorrido = () => Math.max(1, (riel.current?.clientWidth ?? 0) - PERILLA - 2 * MARGEN);

  const alPresionar = (e: PointerEvent<HTMLSpanElement>) => {
    if (!marcable) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    inicio.current = { x: e.clientX, avance: hecho ? 1 : 0, ahora: hecho ? 1 : 0 };
    setArrastre(inicio.current.avance);
  };
  const alMover = (e: PointerEvent<HTMLSpanElement>) => {
    if (!inicio.current) return;
    inicio.current.ahora = Math.min(1, Math.max(0, inicio.current.avance + (e.clientX - inicio.current.x) / recorrido()));
    setArrastre(inicio.current.ahora);
  };
  const alSoltar = () => {
    if (!inicio.current) return;
    const final = inicio.current.ahora;
    inicio.current = null;
    if (!hecho && final >= UMBRAL) alCambiar(true);
    else if (hecho && final <= 1 - UMBRAL) alCambiar(false);
    setArrastre(null);
  };
  const alTeclear = (e: KeyboardEvent) => {
    if (!marcable || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    alCambiar(!hecho);
  };

  const suelto = arrastre === null;
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
      title={marcable ? (hecho ? "Arrastra el círculo a la izquierda para quitar la marca" : "Arrastra el círculo a la derecha para marcarlo hecho") : "Todavía no llega este día"}
      onKeyDown={alTeclear}
      className={`relative h-7 ${clase} overflow-hidden rounded-full bg-suave ring-1 ring-borde ring-inset ${marcable ? "" : "opacity-40"}`}
    >
      {/* El lado izquierdo se colorea hasta donde va el círculo. */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 rounded-full ${suelto ? "transition-[width] duration-200 ease-out" : ""}`}
        style={{ width: avance === 0 ? 0 : `calc(${izquierda} + ${PERILLA + MARGEN}px)`, background: `linear-gradient(90deg, color-mix(in srgb, ${color} 72%, white), ${color})` }}
      />
      <span
        data-testid="perilla-habito"
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        style={{ left: izquierda, width: PERILLA, height: PERILLA, touchAction: "none" }}
        className={`absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] ${marcable ? "cursor-grab active:cursor-grabbing" : ""} ${suelto ? "transition-[left] duration-200 ease-out" : ""}`}
      >
        <Check size={12} strokeWidth={3.5} style={{ color: avance > 0.5 ? color : "#c5cad3" }} />
      </span>
    </div>
  );
}
