import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ExternalLink, GripHorizontal, SlidersHorizontal } from "lucide-react";
import { hashDe, useRuta } from "../logica/ruta";
import { ESCALA_MINIMA, escalaQueCabe, escalaWidget, WIDGETS } from "../logica/widgetEscritorio";
import { leerEleccion, presetDe, temaEfectivo, variablesDe } from "../logica/temas";
import {
  claveAspecto,
  guardarAspecto,
  leerAspecto,
  variablesLetra,
  MAX_ESQUINAS,
  MAX_TRANSPARENCIA,
  opacidades,
  transparenciaTarjetas,
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

/**
 * Cuánto cabe del contenido de la Semana en el widget: 1 si se ve completo; menos de 1 es la
 * proporción a la que habría que achicarlo (mira la cabecera y la zona que se desplaza).
 */
function sobrante(caja: HTMLElement): number {
  const zona = caja.querySelector<HTMLElement>("[data-widget-desplazable]");
  if (!zona) return 1;
  const cabecera = caja.querySelector<HTMLElement>("[data-widget-cabecera]")?.offsetHeight ?? 0;
  const alto = (cabecera + zona.clientHeight) / (cabecera + zona.scrollHeight);
  const ancho = zona.clientWidth / zona.scrollWidth;
  return Math.min(1, alto || 1, ancho || 1);
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

  // Lo que se cambie en el apartado Widgets de la app se ve al tiro en esta ventana.
  useEffect(() => {
    const alCambiar = (e: StorageEvent) => {
      if (e.key === claveAspecto(id)) setAspecto(leerAspecto(id));
    };
    window.addEventListener("storage", alCambiar);
    return () => window.removeEventListener("storage", alCambiar);
  }, [id]);

  // Tema propio del widget (o el de la app) y su tamaño de letra, solo en esta ventana.
  const temaId = aspecto.temaId ?? "";
  const letra = aspecto.letra ?? 100;
  useEffect(() => {
    const t = temaId ? presetDe(temaId) : temaEfectivo(leerEleccion());
    const raiz = document.documentElement;
    for (const [k, v] of Object.entries({ ...variablesDe(t), ...variablesLetra(letra) })) raiz.style.setProperty(k, v);
    raiz.classList.toggle("dark", t.oscuro);
    raiz.dataset.tema = t.id;
  }, [temaId, letra]);

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
  // Abre Andamia en el apartado Widgets, con los ajustes de este widget desplegados.
  const abrirAjustes = () => {
    window.location.href = `${window.location.origin}${window.location.pathname}?abrir#/widgets/${encodeURIComponent(id)}`;
  };
  // El contenido se achica o agranda con la ventana, para ver todo (o casi todo) a cualquier tamaño.
  const marco = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const contenido = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const base = WIDGETS.find((w) => w.id === id);
    const el = marco.current;
    const caja = contenido.current;
    if (!base || !el || !caja) return;
    if (id !== "semana") {
      const medir = () => setEscala(escalaWidget(base, el.clientWidth, el.clientHeight));
      medir();
      const obs = new ResizeObserver(medir);
      obs.observe(el);
      return () => obs.disconnect();
    }
    // Semana: la ventana queda del tamaño que ella le dé, y el contenido se achica lo justo para que
    // se vea completo (hasta la última tarea completada), sin barras de desplazamiento.
    // Siempre parte de la escala del ancho y solo baja: así el resultado es estable y no parpadea.
    let ultima = -1;
    const ajustar = () => {
      const cabe = (x: number) => {
        caja.style.zoom = String(x);
        return sobrante(caja) >= 0.995;
      };
      let e = escalaQueCabe(base, el.clientWidth);
      let noCabe = 0;
      for (let i = 0; i < 12 && e > ESCALA_MINIMA && !cabe(e); i++) {
        noCabe = e;
        const siguiente = Math.max(ESCALA_MINIMA, Math.floor(e * sobrante(caja) * 100) / 100);
        e = siguiente < e ? siguiente : Math.round((e - 0.01) * 100) / 100;
      }
      // Al achicar, las líneas largas se cortan menos: se busca la escala más grande que todavía cabe.
      for (let i = 0; i < 6 && noCabe - e > 0.01; i++) {
        const medio = Math.floor(((e + noCabe) / 2) * 100) / 100;
        if (cabe(medio)) e = medio;
        else noCabe = medio;
      }
      caja.style.zoom = String(e);
      if (e !== ultima) {
        ultima = e;
        setEscala(e);
      }
    };
    let cuadro = 0;
    const pedir = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(ajustar);
    };
    ajustar();
    const obs = new ResizeObserver(pedir);
    obs.observe(el);
    // Cambios en las tareas (agregar, completar, cambiar de día) también reajustan.
    const mut = new MutationObserver(pedir);
    mut.observe(caja, { childList: true, subtree: true, characterData: true });
    return () => {
      obs.disconnect();
      mut.disconnect();
      cancelAnimationFrame(cuadro);
    };
  }, [id]);
  const o = opacidades(aspecto);
  const estilo = {
    borderRadius: aspecto.esquinas,
    "--panel": `color-mix(in srgb, var(--panel-solido) ${Math.round(o.tarjetas * 100)}%, transparent)`,
    // Las columnas de cada día (y demás fondos suaves) siguen la misma transparencia que las tarjetas.
    "--suave": `color-mix(in srgb, var(--app-suave) ${Math.round(o.tarjetas * 100)}%, transparent)`,
    "--acento-suave": `color-mix(in srgb, var(--app-acento-suave) ${Math.round(o.tarjetas * 100)}%, transparent)`,
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
        {/* Franja fina arriba para mover el widget, con una agarradera al centro. Va antes del contenido,
            así no tapa los filtros ni los botones. */}
        <div
          data-testid="barra-widget"
          title={`Arrastra aquí para mover el widget ${nombre}`}
          className="group/agarre relative z-30 flex h-3.5 shrink-0 cursor-grab items-center justify-center [-webkit-app-region:drag]"
        >
          <span data-testid="agarradera-widget" aria-hidden className="flex h-2.5 w-12 items-center justify-center rounded-full bg-[var(--panel-solido)] text-tenue opacity-60 shadow-sm transition-opacity group-hover/agarre:opacity-100">
            <GripHorizontal size={11} />
          </span>
        </div>
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
              etiqueta="Tarjetas"
              valor={transparenciaTarjetas(aspecto)}
              max={MAX_TRANSPARENCIA}
              unidad="%"
              alCambiar={(v) => cambiar({ tarjetas: v })}
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
            <button type="button" className="block text-xs font-medium text-texto underline-offset-2 hover:underline" onClick={abrirAjustes}>
              Ajustes del Widget
            </button>
          </div>
        )}
        <div className="relative flex min-h-0 flex-1 flex-col" data-testid="contenido-widget" ref={contenido} style={{ zoom: escala }}>
          {children}
        </div>
      </div>
      <BordesAjustables />
    </div>
  );
}
