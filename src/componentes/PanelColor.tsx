import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/** Color como tono (0 a 360), intensidad y brillo (0 a 1). */
type Hsv = [number, number, number];

export function hexAHsv(hex: string): Hsv {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [200, 0.62, 0.8];
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

export function hsvAHex([h, s, v]: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const a = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${a(f(5))}${a(f(3))}${a(f(1))}`;
}

const limitar = (x: number) => Math.min(1, Math.max(0, x));
const ALTO = 150;

/**
 * Selector de color a elección, como en el widget del celular: a la izquierda una barra vertical con
 * todos los tonos y a la derecha un cuadro donde se elige qué tan intenso (hacia la izquierda) y qué
 * tan claro (hacia arriba) es ese tono. Los dos se manejan arrastrando su círculo.
 */
export function PanelColor({ valor, alCambiar }: { valor: string; alCambiar: (hex: string) => void }) {
  const [hsv, setHsv] = useState<Hsv>(() => hexAHsv(valor));
  // Si el color cambia desde afuera, se sigue; si es el mismo que se está arrastrando, se conserva el tono
  // (en negro o en blanco el tono no se puede sacar del color).
  useEffect(() => {
    setHsv((actual) => (hsvAHex(actual) === valor.toLowerCase() ? actual : hexAHsv(valor)));
  }, [valor]);
  const barra = useRef<HTMLDivElement>(null);
  const cuadro = useRef<HTMLDivElement>(null);

  const poner = (nuevo: Hsv) => {
    setHsv(nuevo);
    alCambiar(hsvAHex(nuevo));
  };
  const moverTono = (e: PointerEvent) => {
    const r = barra.current!.getBoundingClientRect();
    // Arriba y abajo son rojo; 359.9 evita que el círculo salte de un extremo al otro.
    poner([Math.min(359.9, (1 - limitar((e.clientY - r.top) / r.height)) * 360), hsv[1], hsv[2]]);
  };
  const moverCuadro = (e: PointerEvent) => {
    const r = cuadro.current!.getBoundingClientRect();
    poner([hsv[0], 1 - limitar((e.clientX - r.left) / r.width), 1 - limitar((e.clientY - r.top) / r.height)]);
  };
  const arrastre = (mover: (e: PointerEvent) => void) => ({
    onPointerDown: (e: PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      mover(e);
    },
    onPointerMove: (e: PointerEvent) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) mover(e);
    },
  });
  const teclasTono = (e: KeyboardEvent) => {
    const paso = e.key === "ArrowUp" || e.key === "ArrowRight" ? 5 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -5 : 0;
    if (!paso) return;
    e.preventDefault();
    poner([(hsv[0] + paso + 360) % 360, hsv[1], hsv[2]]);
  };
  const teclasCuadro = (e: KeyboardEvent) => {
    const dx = e.key === "ArrowRight" ? -0.05 : e.key === "ArrowLeft" ? 0.05 : 0;
    const dy = e.key === "ArrowUp" ? 0.05 : e.key === "ArrowDown" ? -0.05 : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    poner([hsv[0], limitar(hsv[1] + dx), limitar(hsv[2] + dy)]);
  };

  const puro = hsvAHex([hsv[0], 1, 1]);
  const circulo = "pointer-events-none absolute h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]";
  return (
    <div data-testid="panel-color" className="flex w-full max-w-xs gap-4 px-1 py-2">
      <div
        ref={barra}
        role="slider"
        tabIndex={0}
        aria-label="Tono"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv[0])}
        onKeyDown={teclasTono}
        {...arrastre(moverTono)}
        style={{ height: ALTO, touchAction: "none", background: "linear-gradient(to bottom, #f00 0%, #f0f 16.67%, #00f 33.33%, #0ff 50%, #0f0 66.67%, #ff0 83.33%, #f00 100%)" }}
        className="relative w-2.5 shrink-0 cursor-pointer rounded-full"
      >
        <span className={`${circulo} left-1/2`} style={{ top: `${(1 - hsv[0] / 360) * 100}%`, background: puro }} />
      </div>
      <div
        ref={cuadro}
        role="slider"
        tabIndex={0}
        aria-label="Intensidad y brillo"
        aria-valuetext={hsvAHex(hsv)}
        aria-valuenow={Math.round(hsv[2] * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        onKeyDown={teclasCuadro}
        {...arrastre(moverCuadro)}
        style={{ height: ALTO, touchAction: "none", background: `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, ${puro}, #fff)` }}
        className="relative min-w-0 flex-1 cursor-crosshair rounded border border-borde"
      >
        <span className={circulo} style={{ left: `${(1 - hsv[1]) * 100}%`, top: `${(1 - hsv[2]) * 100}%`, background: hsvAHex(hsv) }} />
      </div>
    </div>
  );
}
