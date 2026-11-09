import { useMemo, useState } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { EntradaRapida } from "../componentes/EntradaRapida";
import { COLOR_NIVEL } from "../componentes/FilaTarea";
import { useTienda } from "../datos/tienda";
import { fechaDeTarea } from "../logica/fechas";
import { irA, type Seccion } from "../logica/ruta";
import { contenidoDelDia, dificultadDe, diasDeSemana, hayAlgoElDia, nombreCortoDia, tituloDelDia, type FiltroSemana } from "../logica/semana";
import type { Prioridad, Tarea } from "../modelos/tipos";

const SECCION: Seccion = { tipo: "vista", vista: "semana" };

const NOMBRE_NIVEL: Record<Prioridad, string> = { alta: "Alta", media: "Media", baja: "Baja", ninguna: "" };

const FILTROS: { id: FiltroSemana; nombre: string }[] = [
  { id: "tareas", nombre: "Tareas" },
  { id: "eventos", nombre: "Eventos" },
  { id: "todos", nombre: "Todos" },
];

function hora(t: Tarea): string {
  const fecha = fechaDeTarea(t);
  return fecha && !t.todoElDia ? format(fecha, "HH:mm") : "";
}

function FilaEvento({ evento, abierta }: { evento: Tarea; abierta: boolean }) {
  return (
    <li>
      <button
        type="button"
        data-testid="fila-evento"
        onClick={() => irA(SECCION, evento.id)}
        className={`flex w-full items-center gap-2 rounded-md border-l-4 px-3 py-1.5 text-left text-sm ${abierta ? "ring-2 ring-acento" : ""}`}
        style={{ borderColor: "var(--evento)", background: "var(--evento-suave)" }}
      >
        <span className="min-w-0 flex-1 truncate font-medium">{evento.titulo || "Sin título"}</span>
        {hora(evento) && <span className="shrink-0 text-xs text-tenue tabular-nums">{hora(evento)}</span>}
      </button>
    </li>
  );
}

function FilaTareaSemana({ tarea, abierta, hoy }: { tarea: Tarea; abierta: boolean; hoy: Date }) {
  const completarTarea = useTienda((s) => s.completarTarea);
  const etiquetas = useTienda((s) => s.etiquetas);
  const hecha = tarea.estado === "completada";
  const dificultad = dificultadDe(tarea);
  const colorCasilla = COLOR_NIVEL[dificultad];
  const fecha = fechaDeTarea(tarea);
  const atrasada = !hecha && fecha !== null && fecha < hoy && !isSameDay(fecha, hoy);
  const etiqueta = tarea.etiquetas[0] ? etiquetas.find((e) => e.nombre === tarea.etiquetas[0]) : undefined;

  return (
    <li data-testid="fila-tarea" className={`flex items-center gap-2.5 rounded-lg px-2 py-2 ${abierta ? "bg-acento-suave" : "hover:bg-suave"}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={hecha}
        aria-label={hecha ? `Marcar como pendiente: ${tarea.titulo}` : `Completar: ${tarea.titulo}`}
        title={dificultad !== "ninguna" ? `Dificultad ${NOMBRE_NIVEL[dificultad].toLowerCase()}` : "Sin dificultad"}
        onClick={() => void completarTarea(tarea.id, !hecha)}
        style={{ borderColor: colorCasilla, background: hecha ? colorCasilla : undefined }}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2"
      >
        {hecha && <Check size={13} strokeWidth={3} className="text-white" />}
      </button>
      <button type="button" onClick={() => irA(SECCION, tarea.id)} className="min-w-0 flex-1 text-left">
        <span className={`block text-sm break-words ${hecha ? "text-tenue line-through" : ""}`}>{tarea.titulo || "Sin título"}</span>
        {(tarea.prioridad !== "ninguna" || hora(tarea) || atrasada) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            {tarea.prioridad !== "ninguna" && (
              <span
                data-testid="importancia"
                className="rounded-sm border-l-[3px] px-1.5 leading-4 font-medium"
                style={{ borderColor: COLOR_NIVEL[tarea.prioridad], background: `color-mix(in srgb, ${COLOR_NIVEL[tarea.prioridad]} 22%, transparent)` }}
              >
                {NOMBRE_NIVEL[tarea.prioridad]}
              </span>
            )}
            {hora(tarea) && <span className="text-tenue tabular-nums">{hora(tarea)}</span>}
            {atrasada && <span className="font-medium text-peligro">Atrasada</span>}
          </span>
        )}
      </button>
      {etiqueta && (
        <span
          className="max-w-[40%] shrink-0 truncate rounded-full border px-2 py-0.5 text-xs font-medium"
          style={{ color: etiqueta.color, borderColor: etiqueta.color, background: `color-mix(in srgb, ${etiqueta.color} 14%, transparent)` }}
        >
          {etiqueta.nombreVisible}
        </span>
      )}
    </li>
  );
}

export function BarraProgreso({ titulo, hechas, total, porcentaje }: { titulo: string; hechas: number; total: number; porcentaje: number }) {
  return (
    <section data-testid="progreso-dia" className="rounded-xl border border-borde bg-panel px-4 py-3">
      <p className="text-sm font-semibold">{titulo}</p>
      <div className="mt-2 flex items-center gap-3">
        <div role="progressbar" aria-label="Progreso del día" aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje} className="h-2.5 flex-1 overflow-hidden rounded-full bg-suave">
          <div className="h-full rounded-full bg-acento transition-[width]" style={{ width: `${porcentaje}%` }} />
        </div>
        <span className="shrink-0 text-xs text-tenue tabular-nums">
          {hechas}/{total} ({porcentaje}%)
        </span>
      </div>
    </section>
  );
}

export function VistaSemana({ tareaAbierta }: { tareaAbierta: string | null }) {
  const tareas = useTienda((s) => s.tareas);
  const listas = useTienda((s) => s.listas);
  const ahora = new Date();
  const [elegido, setElegido] = useState(() => new Date());
  const [filtro, setFiltro] = useState<FiltroSemana>("todos");
  const [creando, setCreando] = useState(false);

  const dias = diasDeSemana(elegido);
  const contenido = useMemo(() => contenidoDelDia(tareas, listas, elegido, new Date()), [tareas, listas, elegido]);
  const verEventos = filtro !== "tareas";
  const verTareas = filtro !== "eventos";
  const mes = format(elegido, "MMMM yyyy", { locale: es });

  const moverSemana = (semanas: number) => setElegido((d) => addDays(d, semanas * 7));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="px-4 pt-4 pb-2 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Semana anterior" className="rounded-md p-1 text-tenue hover:bg-suave" onClick={() => moverSemana(-1)}>
              <ChevronLeft size={18} />
            </button>
            <h1 className="min-w-[8.5rem] text-center text-lg font-semibold capitalize">{mes}</h1>
            <button type="button" aria-label="Semana siguiente" className="rounded-md p-1 text-tenue hover:bg-suave" onClick={() => moverSemana(1)}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div role="group" aria-label="Mostrar" className="ml-auto flex gap-0.5 rounded-md bg-suave p-0.5">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className={`rounded px-2.5 py-1 text-xs ${filtro === f.id ? "bg-panel font-medium shadow-sm" : "text-tenue hover:text-texto"}`}
              >
                {f.nombre}
              </button>
            ))}
          </div>
          <button
            type="button"
            data-nueva-tarea
            aria-label={filtro === "eventos" ? "Nuevo evento" : "Nueva tarea"}
            aria-expanded={creando}
            title="Añadir"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-acento text-sobre-acento hover:opacity-90"
            onClick={() => setCreando((c) => !c)}
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1" role="group" aria-label="Días de la semana">
          {dias.map((d) => {
            const activo = isSameDay(d, elegido);
            const esHoy = isSameDay(d, ahora);
            const conAlgo = hayAlgoElDia(tareas, listas, d, ahora);
            return (
              <button
                key={d.toISOString()}
                type="button"
                aria-pressed={activo}
                aria-label={format(d, "EEEE d 'de' MMMM", { locale: es })}
                onClick={() => setElegido(d)}
                className="flex flex-col items-center gap-0.5 rounded-lg py-1 hover:bg-suave"
              >
                <span className={`text-xs ${esHoy ? "font-semibold text-acento" : "text-tenue"}`}>{nombreCortoDia(d)}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm tabular-nums ${activo ? "bg-acento font-semibold text-sobre-acento" : esHoy ? "border-2 border-acento font-semibold" : ""}`}>
                  {format(d, "d")}
                </span>
                <span className={`h-1 w-1 rounded-full ${conAlgo ? "bg-tenue" : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
        {creando && (
          <EntradaRapida
            seccion={SECCION}
            destinoFijo={{ vence: format(elegido, "yyyy-MM-dd"), esEvento: filtro === "eventos" }}
            autoFocus
          />
        )}

        {verEventos && contenido.eventos.length > 0 && (
          <ul aria-label="Eventos" className="mb-3 space-y-1">
            {contenido.eventos.map((e) => (
              <FilaEvento key={e.id} evento={e} abierta={e.id === tareaAbierta} />
            ))}
          </ul>
        )}

        {verTareas && (
          <>
            <BarraProgreso titulo={tituloDelDia(elegido, ahora)} {...contenido.progreso} />
            <ul aria-label="Tareas" className="mt-2">
              {contenido.tareas.map((t) => (
                <FilaTareaSemana key={t.id} tarea={t} abierta={t.id === tareaAbierta} hoy={ahora} />
              ))}
            </ul>
          </>
        )}

        {((verTareas && contenido.tareas.length === 0) || (!verTareas && contenido.eventos.length === 0)) && (
          <p className="mt-8 text-center text-sm text-tenue">
            {filtro === "eventos" ? "No hay eventos este día." : "No hay tareas este día."} Toca + para añadir.
          </p>
        )}
      </div>
    </div>
  );
}
