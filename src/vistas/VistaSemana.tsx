import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, Check, CheckSquare, ChevronLeft, ChevronRight, Flame, Plus } from "lucide-react";
import { datosDesdeEntrada } from "../componentes/EntradaRapida";
import { claseBoton, claseBotonPrincipal, claseCampo, Modal } from "../componentes/Modal";
import { interpretarEntrada } from "../logica/entradaRapida";
import { DialogoHabito } from "./VistaHabitos";
import { COLOR_NIVEL } from "../componentes/FilaTarea";
import { useTienda } from "../datos/tienda";
import { fechaDeTarea } from "../logica/fechas";
import { irA, type Seccion } from "../logica/ruta";
import { contenidoDelDia, dificultadDe, diasDeSemana, hayAlgoElDia, nombreCortoDia, type FiltroSemana } from "../logica/semana";
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

/** Barra de avance del día: "1/4 (25%)". */
function BarraProgreso({ hechas, total, porcentaje }: { hechas: number; total: number; porcentaje: number }) {
  return (
    <div data-testid="progreso-dia" className="mt-2 flex items-center gap-3">
      <div role="progressbar" aria-label="Avance de tareas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje} className="h-2.5 flex-1 overflow-hidden rounded-full bg-suave">
        <div className="h-full rounded-full bg-acento transition-[width]" style={{ width: `${porcentaje}%` }} />
      </div>
      <span className="shrink-0 text-xs text-tenue tabular-nums">
        {hechas}/{total} ({porcentaje}%)
      </span>
    </div>
  );
}

type TipoNuevo = "tarea" | "evento";

/** Crear una tarea o un evento para el día elegido. Entiende "9am", "!alta" y "#etiqueta". */
function DialogoNuevo({ tipo, dia, alCerrar }: { tipo: TipoNuevo; dia: Date; alCerrar: () => void }) {
  const listas = useTienda((s) => s.listas);
  const crearTarea = useTienda((s) => s.crearTarea);
  const [texto, setTexto] = useState("");
  const lectura = useMemo(() => (texto.trim() ? interpretarEntrada(texto, dia, listas) : null), [texto, dia, listas]);
  const esEvento = tipo === "evento";

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!lectura?.titulo) return;
    await crearTarea(datosDesdeEntrada(lectura, { vence: format(dia, "yyyy-MM-dd"), esEvento }));
    alCerrar();
  };

  return (
    <Modal titulo={esEvento ? "Nuevo evento" : "Nueva tarea"} alCerrar={alCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-tenue">{esEvento ? "Evento" : "Tarea"}</span>
          <input
            id="entrada-rapida"
            autoFocus
            autoComplete="off"
            aria-label={esEvento ? "Añadir evento" : "Añadir tarea"}
            className={claseCampo}
            placeholder={esEvento ? "Entrevista 15:00" : "Leer paper 9am !alta #universidad"}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </label>
        <p className="text-xs text-tenue">
          Para el {format(lectura?.vence ? fechaDeTarea({ vence: lectura.vence })! : dia, "EEEE d 'de' MMMM", { locale: es })}
          {lectura?.vence && !lectura.todoElDia ? ` a las ${format(fechaDeTarea({ vence: lectura.vence })!, "HH:mm")}` : ""}. La dificultad y la importancia se eligen al abrirla.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className={claseBoton} onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className={claseBotonPrincipal} disabled={!lectura?.titulo}>
            {esEvento ? "Crear evento" : "Crear tarea"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** El + de la semana: tarea, evento o hábito. */
function MenuNuevo({ alElegir }: { alElegir: (tipo: TipoNuevo | "habito") => void }) {
  const [abierto, setAbierto] = useState(false);
  const opciones: { tipo: TipoNuevo | "habito"; nombre: string; icono: ReactNode }[] = [
    { tipo: "tarea", nombre: "Tarea", icono: <CheckSquare size={16} /> },
    { tipo: "evento", nombre: "Evento", icono: <CalendarClock size={16} /> },
    { tipo: "habito", nombre: "Hábito", icono: <Flame size={16} /> },
  ];
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        data-nueva-tarea
        aria-label="Añadir"
        aria-haspopup="menu"
        aria-expanded={abierto}
        title="Añadir tarea, evento o hábito"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-acento text-sobre-acento hover:opacity-90"
        onClick={() => setAbierto((a) => !a)}
      >
        <Plus size={18} />
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div role="menu" aria-label="Añadir" className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-borde bg-panel p-1 shadow-lg">
            {opciones.map((o) => (
              <button
                key={o.tipo}
                type="button"
                role="menuitem"
                data-crear={o.tipo}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-suave"
                onClick={() => {
                  setAbierto(false);
                  alElegir(o.tipo);
                }}
              >
                <span className="text-tenue">{o.icono}</span>
                {o.nombre}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function VistaSemana({ tareaAbierta }: { tareaAbierta: string | null }) {
  const tareas = useTienda((s) => s.tareas);
  const listas = useTienda((s) => s.listas);
  const ahora = new Date();
  const [elegido, setElegido] = useState(() => new Date());
  const [filtro, setFiltro] = useState<FiltroSemana>("todos");
  const [creando, setCreando] = useState<TipoNuevo | "habito" | null>(null);

  const dias = diasDeSemana(elegido);
  const contenido = useMemo(() => contenidoDelDia(tareas, listas, elegido, new Date()), [tareas, listas, elegido]);
  const pendientes = contenido.tareas.filter((t) => t.estado === "pendiente");
  const hechas = contenido.tareas.filter((t) => t.estado === "completada");
  const verEventos = filtro !== "tareas";
  const verTareas = filtro !== "eventos";
  const mesCorto = format(elegido, "MMM", { locale: es }).replace(".", "");
  const mes = (mesCorto.charAt(0).toUpperCase() + mesCorto.slice(1)) + (elegido.getFullYear() !== ahora.getFullYear() ? ` ${elegido.getFullYear()}` : "");
  const esHoyElegido = isSameDay(elegido, ahora);

  const moverSemana = (semanas: number) => setElegido((d) => addDays(d, semanas * 7));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="px-4 pt-4 pb-2 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 items-center">
            <button type="button" aria-label="Semana anterior" className="rounded-md p-1 text-tenue hover:bg-suave" onClick={() => moverSemana(-1)}>
              <ChevronLeft size={18} />
            </button>
            <h1 className="px-0.5 text-center text-lg font-semibold" title={format(elegido, "MMMM yyyy", { locale: es })}>
              {mes}
            </h1>
            <button type="button" aria-label="Semana siguiente" className="rounded-md p-1 text-tenue hover:bg-suave" onClick={() => moverSemana(1)}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div role="group" aria-label="Mostrar" className="ml-auto flex min-w-0 gap-0.5 rounded-md bg-suave p-0.5">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className={`rounded px-2 py-1 text-xs sm:px-2.5 ${filtro === f.id ? "bg-panel font-medium shadow-sm" : "text-tenue hover:text-texto"}`}
              >
                {f.nombre}
              </button>
            ))}
          </div>
          <MenuNuevo alElegir={setCreando} />
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
                <span data-testid={conAlgo ? "punto-dia" : undefined} className={`h-1.5 w-1.5 rounded-full ${conAlgo ? "bg-acento" : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
        {verEventos && contenido.eventos.length > 0 && (
          <ul aria-label="Eventos" className="mb-3 space-y-1">
            {contenido.eventos.map((e) => (
              <FilaEvento key={e.id} evento={e} abierta={e.id === tareaAbierta} />
            ))}
          </ul>
        )}
        {!verTareas && contenido.eventos.length === 0 && <p className="mt-8 text-center text-sm text-tenue">No hay eventos este día. Toca + para añadir.</p>}

        {verTareas && (
          <div data-testid="tarjeta-tareas" className="overflow-hidden rounded-xl border border-borde bg-panel">
            <section aria-label="Tareas del día" className="px-2 pt-3 pb-2">
              <div className="px-2">
                <h2 className="text-sm font-semibold">{esHoyElegido ? "Tareas hoy" : "Tareas del día"}</h2>
                <BarraProgreso {...contenido.progreso} />
              </div>
              {pendientes.length > 0 ? (
                <ul aria-label="Tareas" className="mt-2">
                  {pendientes.map((t) => (
                    <FilaTareaSemana key={t.id} tarea={t} abierta={t.id === tareaAbierta} hoy={ahora} />
                  ))}
                </ul>
              ) : (
                <p className="px-2 py-4 text-sm text-tenue">{hechas.length ? "¡Todo listo por hoy!" : "No hay tareas este día. Toca + para añadir."}</p>
              )}
            </section>
            <section aria-label="Completadas" data-testid="tarjeta-completada" className="border-t border-borde px-2 pt-3 pb-2">
              <h2 className="px-2 text-sm font-semibold text-tenue">Completadas</h2>
              {hechas.length > 0 ? (
                <ul className="mt-1">
                  {hechas.map((t) => (
                    <FilaTareaSemana key={t.id} tarea={t} abierta={t.id === tareaAbierta} hoy={ahora} />
                  ))}
                </ul>
              ) : (
                <p className="px-2 py-3 text-sm text-tenue">Aún no completas tareas este día.</p>
              )}
            </section>
          </div>
        )}
      </div>

      {(creando === "tarea" || creando === "evento") && <DialogoNuevo tipo={creando} dia={elegido} alCerrar={() => setCreando(null)} />}
      {creando === "habito" && <DialogoHabito habito={null} alCerrar={() => setCreando(null)} />}
    </div>
  );
}
