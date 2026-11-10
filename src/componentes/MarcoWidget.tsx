import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ExternalLink, SlidersHorizontal } from "lucide-react";
import { hashDe, useRuta } from "../logica/ruta";
import { escalaQueCabe, escalaWidget, EVENTO_ALTO_WIDGET, WIDGETS } from "../logica/widgetEscritorio";
import {
  guardarAspecto,
  leerAspecto,
  MAX_ESQUINAS,
  MAX_TRANSPARENCIA,
  opacidades,
  type AspectoWidget,
} from "../logica/aspectoWidget";

/** Lo que la app de PC le da a la ventana de un widget (ver escritorio/precarga-widget.cjs). */
interface PuenteWidget {
  empezarAjuste: (borde: string) => void;
  terminarAjuste: () => void;
  ajustarAlto?: (alto: number) => void;
}
const puente = (): PuenteWidget | undefined =>
  (window as unknown as { andamiaWidget?: PuenteWidget }).andamiaWidget;

/** Alto máximo del widget elegido arrastrando su borde (se guarda en este computador). */
const claveTope = (id: string) => `andamia-widget-tope-${id}`;
function leerTope(id: string): number | null {
  try {
    const n = Number(localStorage.getItem(claveTope(id)));
    return Number.isFinite(n) && n >= 120 ? n : null;
  } catch {
    return null;
  }
}
function guardarTope(id: string, alto: number) {
  try {
    localStorage.setItem(claveTope(id), String(Math.round(alto)));
  } catch {
    // Sin almacenamiento: dura mientras el widget siga abierto.
  }
}
/** Sin tope elegido: hasta el borde de abajo de la pantalla. */
function altoDisponible(): number {
  const s = window.screen as Screen & { availTop?: number };
  const fondo = (s.availTop ?? 0) + s.availHeight;
  return Math.max(220, fondo - Math.max(0, window.screenY));
}

const BORDES: { id: string; clase: string; cursor: string }[] = [
  { id: "n", clase: "top-0 left-3 right-3 h-1.5", cursor: "ns-resize" },
  { id: "s", clase: "bottom-0 left-3 right-3 h-1.5", cursor: "ns-resize" },
  { id: "o", clase: "left-0 top-3 bottom-3 w-1.5", cursor: "ew-resize" },
  { id: "e", clase: "right-0 top-3 bottom-3 w-1.5", cursor: "ew-resize" },
  { id: "no", clase: "top-0 left-0 h-3 w-3", cursor: "nwse-resize" },
  { id: "ne", clase: "top-0 right-0 h-3 w-3", cursor: "nesw-resize" },
  { id: "so", clase: "bottom-0 left-0 h-3 w-3", cursor: "nesw-resize" },
  { id: "se", clase: "bottom-0 right-0 h-3 w-3", cursor: "nwse-resize" },
];

/** Bordes y esquinas que se arrastran para cambiar el tamaño de la ventana del widget. */
function BordesAjustables({ alSoltar }: { alSoltar?: (borde: string) => void }) {
  const p = puente();
  if (!p) return null;
  const soltar = (borde: string) => {
    p.terminarAjuste();
    alSoltar?.(borde);
  };
  return (
    <>
      {BORDES.map((b) => (
        <div
          key={b.id}
          data-borde-widget={b.id}
          aria-hidden
          className={`absolute z-50 touch-none [-webkit-app-region:no-drag] ${b.clase}`}
          // Casi invisible pero no del todo: en Windows, lo 100 % transparente no recibe el mouse.
          style={{ cursor: b.cursor, background: "rgba(128, 128, 128, 0.01)" }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            p.empezarAjuste(b.id);
          }}
          onPointerUp={() => soltar(b.id)}
          onLostPointerCapture={() => soltar(b.id)}
        />
      ))}
    </>
  );
}

function Deslizador({
  etiqueta,
  valor,
  max,
  unidad,
  alCambiar,
}: {
  etiqueta: string;
  valor: number;
  max: number;
  unidad: string;
  alCambiar: (v: number) => void;
}) {
  return (
    <label className="block text-xs">
      <span className="flex justify-between">
        <span>{etiqueta}</span>
        <span className="text-tenue tabular-nums">
          {valor}
          {unidad}
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={valor}
        onChange={(e) => alCambiar(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--acento)]"
      />
    </label>
  );
}

/**
 * Ventana de un widget del escritorio: barra para moverla, botón para abrir la vista en Andamia,
 * ajustes de transparencia y esquinas, y bordes para cambiar su tamaño.
 */
export function MarcoWidget({
  id,
  nombre,
  children,
}: {
  id: string;
  nombre: string;
  children: ReactNode;
}) {
  const ruta = useRuta();
  const [aspecto, setAspecto] = useState<AspectoWidget>(() => leerAspecto(id));
  const [ajustes, setAjustes] = useState(false);

  // El fondo de la página queda transparente: el color lo pone este marco, con su transparencia.
  useEffect(() => {
    document.documentElement.classList.add("modo-widget");
    return () => document.documentElement.classList.remove("modo-widget");
  }, []);

  const cambiar = (c: Partial<AspectoWidget>) => {
    const nuevo = { ...aspecto, ...c };
    setAspecto(nuevo);
    guardarAspecto(id, nuevo);
  };
  const abrir = () => {
    // La app de PC intercepta "?abrir" y muestra la ventana principal; en el navegador abre Andamia completa.
    window.location.href = `${window.location.origin}${
      window.location.pathname
    }?abrir${hashDe(ruta.seccion, ruta.tareaId)}`;
  };
  // El contenido se achica o agranda con la ventana, para ver todo (o casi todo) a cualquier tamaño.
  const marco = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const escalaActual = useRef(1);
  escalaActual.current = escala;
  const ajustaAlto = id === "semana";
  // Semana: alto de su contenido a escala 1 (lo avisa la vista) y alto máximo que ella eligió arrastrando el borde.
  const [altoNatural, setAltoNatural] = useState<number | null>(null);
  const [tope, setTope] = useState<number | null>(() => leerTope(id));
  useEffect(() => {
    if (!ajustaAlto) return;
    const alAvisar = (e: Event) => {
      const enPantalla = (e as CustomEvent<number>).detail;
      if (enPantalla > 0) setAltoNatural(enPantalla / (escalaActual.current || 1));
    };
    window.addEventListener(EVENTO_ALTO_WIDGET, alAvisar);
    return () => window.removeEventListener(EVENTO_ALTO_WIDGET, alAvisar);
  }, [ajustaAlto]);
  useEffect(() => {
    const base = WIDGETS.find((w) => w.id === id);
    const el = marco.current;
    if (!base || !el) return;
    const medir = () => {
      if (!ajustaAlto) {
        setEscala(escalaWidget(base, el.clientWidth, el.clientHeight));
        return;
      }
      // Semana: la escala del ancho, achicada si hace falta para que todo quepa sin barra de desplazamiento.
      // La ventana toma justo ese alto, sin pasar del tope (el que ella eligió o el borde de la pantalla).
      const maximo = tope ?? altoDisponible();
      const e = escalaQueCabe(base, el.clientWidth, altoNatural, maximo);
      setEscala((antes) => (Math.abs(antes - e) >= 0.01 ? e : antes));
      if (altoNatural) puente()?.ajustarAlto?.(Math.min(maximo, Math.ceil(altoNatural * e) + 2));
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [id, ajustaAlto, altoNatural, tope]);
  // Al soltar el borde de arriba o de abajo, ese alto pasa a ser el tope del widget.
  const alSoltarBorde = (borde: string) => {
    if (!ajustaAlto || !/[ns]/.test(borde)) return;
    window.setTimeout(() => {
      const alto = window.innerHeight;
      setTope(alto);
      guardarTope(id, alto);
    }, 50);
  };
  const o = opacidades(aspecto);
  const estilo = {
    borderRadius: aspecto.esquinas,
    "--panel": `color-mix(in srgb, var(--panel-solido) ${Math.round(
      o.tarjetas * 100
    )}%, transparent)`,
  } as CSSProperties;

  return (
    <div ref={marco} className="relative h-full">
      <div
        className="relative flex h-full flex-col overflow-hidden"
        style={estilo}
        data-widget={id}
        data-testid="marco-widget"
      >
        <div
          aria-hidden
          data-testid="fondo-widget"
          className="pointer-events-none absolute inset-0 -z-0"
          style={{
            background: "var(--fondo-capa, var(--fondo))",
            opacity: o.fondo,
          }}
        />
        {/* Franja invisible arriba para mover el widget: no ocupa alto, así la Semana aprovecha todo el espacio. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 z-30 h-3 [-webkit-app-region:drag]"
          data-testid="barra-widget"
          title={`Arrastra aquí para mover el widget ${nombre}`}
        />
        {/* Esquinita siempre visible: abre transparencia y esquinas. */}
        <div className="group/esquina absolute top-1 right-1 z-40 flex items-center gap-1 [-webkit-app-region:no-drag]">
          <button
            type="button"
            aria-label="Abrir en Andamia"
            title="Abrir en Andamia"
            className="rounded-full bg-[var(--panel-solido)] p-1 text-tenue opacity-0 shadow-sm transition-opacity group-hover/esquina:opacity-100 focus-visible:opacity-100 hover:text-texto"
            onClick={abrir}
          >
            <ExternalLink size={12} />
          </button>
          <button
            type="button"
            aria-label="Transparencia y esquinas"
            aria-expanded={ajustes}
            title="Transparencia y esquinas"
            className={`rounded-full bg-[var(--panel-solido)] p-1 text-tenue shadow-sm transition-opacity hover:text-texto hover:opacity-100 ${ajustes ? "opacity-100" : "opacity-50"}`}
            onClick={() => setAjustes((x) => !x)}
          >
            <SlidersHorizontal size={12} />
          </button>
        </div>
        {ajustes && (
          <div
            role="group"
            aria-label="Aspecto del widget"
            className="absolute top-8 right-2 z-50 w-60 space-y-3 rounded-lg border border-borde bg-[var(--panel-solido)] p-3 text-texto shadow-lg [-webkit-app-region:no-drag]"
          >
            <Deslizador
              etiqueta="Transparencia"
              valor={aspecto.transparencia}
              max={MAX_TRANSPARENCIA}
              unidad="%"
              alCambiar={(v) => cambiar({ transparencia: v })}
            />
            <Deslizador
              etiqueta="Esquinas"
              valor={aspecto.esquinas}
              max={MAX_ESQUINAS}
              unidad=" px"
              alCambiar={(v) => cambiar({ esquinas: v })}
            />
            <p className="text-[11px] text-tenue">
              {puente()
                ? "Arrastra los bordes del widget para cambiar su tamaño."
                : "Solo este widget; se guarda en este computador."}
            </p>
          </div>
        )}
        <div className="relative flex min-h-0 flex-1 flex-col" data-testid="contenido-widget" style={{ zoom: escala }}>
          {children}
        </div>
      </div>
      <BordesAjustables alSoltar={alSoltarBorde} />
    </div>
  );
}
