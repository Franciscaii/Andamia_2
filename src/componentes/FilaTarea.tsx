import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { AlarmClock, Bell, Check, GripVertical, ListChecks, Repeat, StickyNote } from "lucide-react";
import { recordatoriosActivos } from "../config";
import { useTienda } from "../datos/tienda";
import type { Fragmento } from "../logica/busqueda";
import { resaltar } from "../logica/busqueda";
import { diasHasta, etiquetaFecha } from "../logica/fechas";
import { describirRegla } from "../logica/repeticion";
import { LISTA_BANDEJA, type Prioridad, type Tarea } from "../modelos/tipos";

export const COLOR_PRIORIDAD: Record<Prioridad, string> = {
  alta: "var(--prio-alta)",
  media: "var(--prio-media)",
  baja: "var(--prio-baja)",
  ninguna: "var(--prio-ninguna)",
};

/** Casilla de una tarea completada: plomo para todas. */
export const COLOR_HECHA = "var(--casilla-hecha)";

/** Dificultad e importancia en la semana: rojo, amarillo y azul. */
export const COLOR_NIVEL: Record<Prioridad, string> = {
  alta: "var(--nivel-alta)",
  media: "var(--nivel-media)",
  baja: "var(--nivel-baja)",
  ninguna: "var(--prio-ninguna)",
};

function Resaltado({ partes }: { partes: Fragmento[] }) {
  return (
    <>
      {partes.map((p, i) =>
        p.coincide ? (
          <mark key={i} className="rounded-sm bg-marca-busqueda text-inherit">
            {p.texto}
          </mark>
        ) : (
          <span key={i}>{p.texto}</span>
        ),
      )}
    </>
  );
}

interface Props {
  tarea: Tarea;
  abierta: boolean;
  alAbrir: () => void;
  mostrarLista?: boolean;
  consulta?: string;
  acciones?: ReactNode;
  // Arrastre, cuando la fila es ordenable.
  refFila?: (el: HTMLElement | null) => void;
  estilo?: CSSProperties;
  asaProps?: HTMLAttributes<HTMLButtonElement>;
  arrastrando?: boolean;
  /** Clases extra, por ejemplo para mostrarla como tarjeta. */
  clase?: string;
}

export function FilaTarea({ tarea, abierta, alAbrir, mostrarLista, consulta = "", acciones, refFila, estilo, asaProps, arrastrando, clase = "" }: Props) {
  const listas = useTienda((s) => s.listas);
  const etiquetas = useTienda((s) => s.etiquetas);
  const completarTarea = useTienda((s) => s.completarTarea);

  const hecha = tarea.estado === "completada";
  const enPapelera = tarea.eliminadaEn !== null;
  const dias = diasHasta(tarea, new Date());
  const atrasada = !hecha && dias !== null && dias < 0;
  const nombreLista = tarea.listaId === LISTA_BANDEJA ? "Bandeja" : listas.find((l) => l.id === tarea.listaId)?.nombre;
  const color = hecha ? COLOR_HECHA : COLOR_PRIORIDAD[tarea.prioridad];
  const coincideNotas = consulta && resaltar(tarea.descripcion, consulta).some((p) => p.coincide);

  return (
    <li ref={refFila} style={estilo} data-testid="fila-tarea" className={`group flex items-start gap-1 rounded-lg px-1 py-1.5 ${abierta ? "bg-acento-suave" : "hover:bg-suave"} ${arrastrando ? "relative z-10 bg-panel shadow-lg" : ""} ${clase}`}>
      {asaProps ? (
        <button type="button" aria-label={`Mover ${tarea.titulo}`} className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-tenue opacity-0 group-hover:opacity-100 focus-visible:opacity-100" {...asaProps}>
          <GripVertical size={15} />
        </button>
      ) : (
        <span className="w-[19px] shrink-0" />
      )}
      <button
        type="button"
        role="checkbox"
        aria-checked={hecha}
        aria-label={hecha ? `Marcar como pendiente: ${tarea.titulo}` : `Completar: ${tarea.titulo}`}
        disabled={enPapelera}
        onClick={() => void completarTarea(tarea.id, !hecha)}
        style={{ borderColor: color, background: hecha ? color : undefined }}
        className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2"
      >
        {hecha && <Check size={12} strokeWidth={3} className="text-panel" />}
      </button>
      <button type="button" onClick={alAbrir} className="min-w-0 flex-1 pl-1.5 text-left">
        <span className={`block text-sm break-words ${hecha ? "text-tenue line-through" : ""}`}>
          <Resaltado partes={resaltar(tarea.titulo || "Sin título", consulta)} />
        </span>
        {coincideNotas && (
          <span className="mt-0.5 block truncate text-xs text-tenue">
            <Resaltado partes={resaltar(tarea.descripcion, consulta)} />
          </span>
        )}
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-tenue empty:hidden">
          {tarea.vence && (
            <span className={`flex items-center gap-1 ${atrasada ? "font-medium text-peligro" : ""}`}>
              {!tarea.todoElDia && <AlarmClock size={12} />}
              {etiquetaFecha(tarea)}
            </span>
          )}
          {tarea.repeticion && (
            <span className="flex items-center gap-1" title={describirRegla(tarea.repeticion)}>
              <Repeat size={12} />
              <span className="sr-only">{describirRegla(tarea.repeticion)}</span>
            </span>
          )}
          {recordatoriosActivos && tarea.recordatorios.length > 0 && <Bell size={12} aria-label="Tiene recordatorios" />}
          {tarea.subtareas.length > 0 && (
            <span className="flex items-center gap-1">
              <ListChecks size={12} />
              {tarea.subtareas.filter((s) => s.estado === "completada").length}/{tarea.subtareas.length}
            </span>
          )}
          {tarea.descripcion && <StickyNote size={12} aria-label="Tiene notas" />}
          {tarea.etiquetas.map((e) => {
            const etiqueta = etiquetas.find((x) => x.nombre === e);
            return (
              <span key={e} className="rounded-full px-1.5 leading-4 font-medium" style={{ color: etiqueta?.color, background: `color-mix(in srgb, ${etiqueta?.color ?? "gray"} 16%, transparent)` }}>
                {etiqueta?.nombreVisible ?? e}
              </span>
            );
          })}
          {mostrarLista && nombreLista && <span>{nombreLista}</span>}
        </span>
      </button>
      {acciones && <span className="flex shrink-0 items-center gap-1 pr-1">{acciones}</span>}
    </li>
  );
}
