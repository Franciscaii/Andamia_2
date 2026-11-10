import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ExternalLink, SlidersHorizontal } from "lucide-react";
import { hashDe, useRuta } from "../logica/ruta";
import { escalaWidget, WIDGETS } from "../logica/widgetEscritorio";
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
}
const puente = (): PuenteWidget | undefined =>
  (window as unknown as { andamiaWidget?: PuenteWidget }).andamiaWidget;

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
function BordesAjustables() {
  const p = puente();
  if (!p) return null;
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
          onPointerUp={() => p.terminarAjuste()}
          onLostPointerCapture={() => p.terminarAjuste()}
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
  useEffect(() => {
    const base = WIDGETS.find((w) => w.id === id);
    const el = marco.current;
    if (!base || !el) return;
    const medir = () => setEscala(escalaWidget(base, el.clientWidth, el.clientHeight));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [id]);
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
        {/* Franja fina y transparente para mover el widget: sin barra de color ni menú; los botones aparecen al pasar el mouse. */}
        <div
          className="group/barra relative flex h-6 shrink-0 items-center justify-end gap-1 px-2 [-webkit-app-region:drag]"
          data-testid="barra-widget"
          title={`Arrastra aquí para mover el widget ${nombre}`}
        >
          <button
            type="button"
            aria-label="Transparencia y esquinas"
            aria-expanded={ajustes}
            title="Transparencia y esquinas"
            className={`rounded-md p-0.5 text-tenue opacity-0 transition-opacity group-hover/barra:opacity-100 focus-visible:opacity-100 hover:bg-suave [-webkit-app-region:no-drag] ${ajustes ? "opacity-100" : ""}`}
            onClick={() => setAjustes((x) => !x)}
          >
            <SlidersHorizontal size={14} />
          </button>
          <button
            type="button"
            aria-label="Abrir en Andamia"
            title="Abrir en Andamia"
            className={`rounded-md p-0.5 text-tenue opacity-0 transition-opacity group-hover/barra:opacity-100 focus-visible:opacity-100 hover:bg-suave [-webkit-app-region:no-drag] ${ajustes ? "opacity-100" : ""}`}
            onClick={abrir}
          >
            <ExternalLink size={14} />
          </button>
        </div>
        {ajustes && (
          <div
            role="group"
            aria-label="Aspecto del widget"
            className="absolute top-7 right-2 z-40 w-60 space-y-3 rounded-lg border border-borde bg-[var(--panel-solido)] p-3 text-texto shadow-lg [-webkit-app-region:no-drag]"
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
      <BordesAjustables />
    </div>
  );
}
