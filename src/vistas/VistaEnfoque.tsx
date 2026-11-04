import { useMemo, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Pause, Play, Plus, Settings, SkipForward, Square, Trash2, X } from "lucide-react";
import { claseBoton, claseBotonPrincipal, claseCampo, Confirmar, Modal } from "../componentes/Modal";
import { textoTemporizador, useAhora, useEnfoque } from "../datos/enfoque";
import { useTienda } from "../datos/tienda";
import { estadisticasEnfoque, formatoMinutos, transcurridoMs } from "../logica/enfoque";
import { nuevoId } from "../logica/texto";
import { estaPendiente } from "../logica/vistas";

function Anillo({ progreso, children }: { progreso: number; children: React.ReactNode }) {
  const radio = 96;
  const perimetro = 2 * Math.PI * radio;
  return (
    <div className="relative h-56 w-56 sm:h-64 sm:w-64">
      <svg viewBox="0 0 208 208" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="104" cy="104" r={radio} fill="none" stroke="var(--suave)" strokeWidth="8" />
        <circle cx="104" cy="104" r={radio} fill="none" stroke="var(--acento)" strokeWidth="8" strokeLinecap="round" strokeDasharray={perimetro} strokeDashoffset={perimetro * (1 - progreso)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function Mosaico({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-lg border border-borde bg-panel p-3">
      <p className="text-xs text-tenue">{titulo}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{valor}</p>
      {detalle && <p className="text-xs text-tenue">{detalle}</p>}
    </div>
  );
}

/** Una sola serie: un tono, sin leyenda; el título la nombra y la tabla oculta la hace accesible. */
function BarrasSemana({ datos }: { datos: { dia: string; minutos: number }[] }) {
  const [sobre, setSobre] = useState<number | null>(null);
  const maximo = Math.max(...datos.map((d) => d.minutos), 1);
  const nombre = (dia: string) => format(parseISO(dia), "EEE", { locale: es });
  return (
    <figure className="rounded-lg border border-borde bg-panel p-3">
      <figcaption className="mb-2 text-sm font-semibold">Minutos de enfoque, últimos 7 días</figcaption>
      <div aria-hidden="true" className="relative flex h-32 items-end gap-1 border-b border-borde">
        {datos.map((d, i) => (
          <div key={d.dia} data-testid="barra-dia" className="relative flex h-full flex-1 items-end justify-center" onMouseEnter={() => setSobre(i)} onMouseLeave={() => setSobre(null)}>
            {sobre === i && (
              <div className="absolute bottom-full z-10 mb-1 rounded border border-borde bg-panel px-2 py-1 text-xs whitespace-nowrap shadow">
                {format(parseISO(d.dia), "EEE d MMM", { locale: es })}: {formatoMinutos(d.minutos)}
              </div>
            )}
            <div className="w-3 rounded-t bg-acento sm:w-4" style={{ height: `${d.minutos > 0 ? Math.max(4, (d.minutos / maximo) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-1 flex gap-1">
        {datos.map((d) => (
          <div key={d.dia} className="flex-1 text-center text-[11px] text-tenue">
            {nombre(d.dia)}
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Minutos de enfoque por día</caption>
        <tbody>
          {datos.map((d) => (
            <tr key={d.dia}>
              <th scope="row">{format(parseISO(d.dia), "EEEE d 'de' MMMM", { locale: es })}</th>
              <td>{formatoMinutos(d.minutos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Ranking({ titulo, filas }: { titulo: string; filas: { id: string; nombre: string; minutos: number }[] }) {
  if (!filas.length) return null;
  return (
    <section className="rounded-lg border border-borde bg-panel p-3">
      <h2 className="mb-2 text-sm font-semibold">{titulo}</h2>
      <ul className="space-y-1 text-sm">
        {filas.slice(0, 5).map((f) => (
          <li key={f.id} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">{f.nombre}</span>
            <span className="shrink-0 text-tenue tabular-nums">{formatoMinutos(f.minutos)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DialogoConfig({ alCerrar }: { alCerrar: () => void }) {
  const config = useEnfoque((s) => s.config);
  const guardarConfig = useEnfoque((s) => s.guardarConfig);
  const [valores, setValores] = useState({ ...config });
  const campos: { clave: keyof typeof valores; nombre: string }[] = [
    { clave: "enfoqueMin", nombre: "Enfoque (minutos)" },
    { clave: "descansoMin", nombre: "Descanso (minutos)" },
    { clave: "descansoLargoMin", nombre: "Descanso largo (minutos)" },
    { clave: "cadaN", nombre: "Descanso largo cada (pomodoros)" },
  ];
  const validos = campos.every((c) => valores[c.clave] >= 1);
  return (
    <Modal titulo="Ajustes del temporizador" alCerrar={alCerrar}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!validos) return;
          guardarConfig(valores);
          alCerrar();
        }}
      >
        {campos.map((c) => (
          <label key={c.clave} className="flex items-center justify-between gap-3 text-sm">
            {c.nombre}
            <input type="number" min={1} max={600} className={`${claseCampo} w-24`} value={valores[c.clave]} onChange={(e) => setValores({ ...valores, [c.clave]: Number(e.target.value) })} />
          </label>
        ))}
        <p className="text-xs text-tenue">Si hay un temporizador en marcha, conserva su duración actual.</p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={claseBoton} onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className={claseBotonPrincipal} disabled={!validos}>
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DialogoSesionManual({ alCerrar }: { alCerrar: () => void }) {
  const tareas = useTienda((s) => s.tareas);
  const guardarSesion = useTienda((s) => s.guardarSesion);
  const [fecha, setFecha] = useState(format(new Date(), "yyyy-MM-dd"));
  const [hora, setHora] = useState(format(new Date(), "HH:mm"));
  const [minutos, setMinutos] = useState(25);
  const [tareaId, setTareaId] = useState("");
  const [nota, setNota] = useState("");
  const pendientes = tareas.filter(estaPendiente);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (minutos < 1 || !fecha || !hora) return;
    const inicio = parseISO(`${fecha}T${hora}:00`);
    await guardarSesion({
      id: nuevoId(),
      tipo: "pomodoro",
      inicio: inicio.toISOString(),
      fin: new Date(inicio.getTime() + minutos * 60_000).toISOString(),
      segundos: minutos * 60,
      tareaId: tareaId || null,
      nota: nota.trim(),
      manual: true,
    });
    alCerrar();
  };

  return (
    <Modal titulo="Añadir sesión" alCerrar={alCerrar}>
      <form className="space-y-3" onSubmit={enviar}>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-tenue">
            Fecha
            <input type="date" className={`${claseCampo} mt-1`} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="text-xs text-tenue">
            Inicio
            <input type="time" className={`${claseCampo} mt-1`} value={hora} onChange={(e) => setHora(e.target.value)} />
          </label>
          <label className="text-xs text-tenue">
            Minutos
            <input type="number" min={1} className={`${claseCampo} mt-1`} value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} />
          </label>
        </div>
        <label className="block text-xs text-tenue">
          Tarea
          <select aria-label="Tarea de la sesión" className={`${claseCampo} mt-1`} value={tareaId} onChange={(e) => setTareaId(e.target.value)}>
            <option value="">Sin tarea</option>
            {pendientes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.titulo || "Sin título"}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-tenue">
          Nota
          <input aria-label="Nota de la sesión" className={`${claseCampo} mt-1`} value={nota} onChange={(e) => setNota(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={claseBoton} onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className={claseBotonPrincipal} disabled={minutos < 1}>
            Añadir
          </button>
        </div>
      </form>
    </Modal>
  );
}

const NOMBRE_FASE = { enfoque: "Enfoque", descanso: "Descanso", "descanso-largo": "Descanso largo" };

export function VistaEnfoque() {
  const t = useEnfoque((s) => s.temporizador);
  const config = useEnfoque((s) => s.config);
  const acciones = useEnfoque.getState();
  const tareas = useTienda((s) => s.tareas);
  const listas = useTienda((s) => s.listas);
  const sesiones = useTienda((s) => s.sesiones);
  const borrarSesion = useTienda((s) => s.borrarSesion);
  const [dialogo, setDialogo] = useState<"config" | "manual" | "abandonar" | null>(null);
  const ahora = useAhora(t.estado === "corriendo");

  const pendientes = useMemo(() => tareas.filter(estaPendiente).sort((a, b) => a.orden - b.orden), [tareas]);
  const stats = useMemo(() => estadisticasEnfoque(sesiones, tareas, listas, new Date()), [sesiones, tareas, listas]);
  const recientes = useMemo(() => [...sesiones].sort((a, b) => b.inicio.localeCompare(a.inicio)).slice(0, 20), [sesiones]);

  const esCronometro = t.modo === "cronometro";
  const progreso = esCronometro || t.duracionMs === 0 ? (t.estado === "listo" ? 0 : 1) : Math.min(1, transcurridoMs(t, ahora) / t.duracionMs);
  const enCurso = t.estado !== "listo";
  const claseModo = (activo: boolean) => `rounded px-3 py-1 text-sm disabled:opacity-50 ${activo ? "bg-panel font-medium shadow-sm" : "text-tenue hover:text-texto"}`;
  const tareaVinculada = tareas.find((x) => x.id === t.tareaId);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section aria-label="Temporizador" className="flex flex-col items-center gap-4">
          <header className="flex w-full items-center gap-2">
            <h1 className="text-xl font-semibold">Enfoque</h1>
            <button type="button" aria-label="Ajustes del temporizador" title="Ajustes" className="ml-auto rounded-md p-1.5 text-tenue hover:bg-suave" onClick={() => setDialogo("config")}>
              <Settings size={18} />
            </button>
          </header>

          <div role="group" aria-label="Modo" className="flex gap-0.5 rounded-md bg-suave p-0.5">
            <button type="button" disabled={enCurso} aria-pressed={!esCronometro} className={claseModo(!esCronometro)} onClick={() => acciones.cambiarModo("pomodoro")}>
              Pomodoro
            </button>
            <button type="button" disabled={enCurso} aria-pressed={esCronometro} className={claseModo(esCronometro)} onClick={() => acciones.cambiarModo("cronometro")}>
              Cronómetro
            </button>
          </div>

          <Anillo progreso={progreso}>
            <span data-testid="fase" className="text-xs text-tenue">{esCronometro ? "Cronómetro" : NOMBRE_FASE[t.fase]}</span>
            <span data-testid="tiempo" className="text-5xl font-semibold tabular-nums">{textoTemporizador(t, ahora)}</span>
            {!esCronometro && <span className="mt-1 text-xs text-tenue">{t.ciclos} de {config.cadaN} hasta el descanso largo</span>}
          </Anillo>

          <label className="w-full max-w-sm text-xs text-tenue">
            Tarea de esta sesión
            <select aria-label="Tarea de esta sesión" className={`${claseCampo} mt-1`} value={t.tareaId ?? ""} onChange={(e) => acciones.elegirTarea(e.target.value || null)}>
              <option value="">Sin tarea</option>
              {tareaVinculada && !pendientes.includes(tareaVinculada) && <option value={tareaVinculada.id}>{tareaVinculada.titulo}</option>}
              {pendientes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.titulo || "Sin título"}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap justify-center gap-2">
            {t.estado === "listo" && (
              <button type="button" className={`${claseBotonPrincipal} flex items-center gap-1.5 !px-5 !py-2`} onClick={acciones.empezar}>
                <Play size={15} /> Empezar
              </button>
            )}
            {t.estado === "corriendo" && (
              <button type="button" className={`${claseBotonPrincipal} flex items-center gap-1.5 !px-5 !py-2`} onClick={acciones.pausar}>
                <Pause size={15} /> Pausar
              </button>
            )}
            {t.estado === "pausado" && (
              <button type="button" className={`${claseBotonPrincipal} flex items-center gap-1.5 !px-5 !py-2`} onClick={acciones.reanudar}>
                <Play size={15} /> Reanudar
              </button>
            )}
            {enCurso && !esCronometro && (
              <button type="button" className={`${claseBoton} flex items-center gap-1.5`} onClick={acciones.saltar}>
                <SkipForward size={15} /> Saltar
              </button>
            )}
            {enCurso && esCronometro && (
              <button type="button" className={`${claseBoton} flex items-center gap-1.5`} onClick={acciones.detener}>
                <Square size={15} /> Detener y guardar
              </button>
            )}
            {enCurso && (
              <button type="button" className={`${claseBoton} flex items-center gap-1.5 text-peligro`} onClick={() => setDialogo("abandonar")}>
                <X size={15} /> Abandonar
              </button>
            )}
          </div>
        </section>

        <section aria-label="Estadísticas de enfoque" className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Mosaico titulo="Hoy" valor={formatoMinutos(stats.hoyMin)} detalle={stats.hoyPomodoros === 1 ? "1 pomodoro" : `${stats.hoyPomodoros} pomodoros`} />
            <Mosaico titulo="Esta semana" valor={formatoMinutos(stats.semanaMin)} detalle={stats.semanaPomodoros === 1 ? "1 pomodoro" : `${stats.semanaPomodoros} pomodoros`} />
            <Mosaico titulo="Total" valor={formatoMinutos(stats.totalMin)} />
            <Mosaico titulo="Racha" valor={stats.racha === 1 ? "1 día" : `${stats.racha} días`} />
          </div>
          <BarrasSemana datos={stats.ultimos7} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Ranking titulo="Por tarea" filas={stats.porTarea} />
            <Ranking titulo="Por lista" filas={stats.porLista} />
          </div>
          <section className="rounded-lg border border-borde bg-panel p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Sesiones recientes</h2>
              <button type="button" className="flex items-center gap-1 text-xs text-acento hover:underline" onClick={() => setDialogo("manual")}>
                <Plus size={13} /> Añadir sesión
              </button>
            </div>
            {!recientes.length && <p className="py-3 text-center text-xs text-tenue">Aún no hay sesiones registradas.</p>}
            <ul className="space-y-1">
              {recientes.map((s) => {
                const tarea = tareas.find((x) => x.id === s.tareaId);
                return (
                  <li key={s.id} data-testid="sesion" className="group flex items-center gap-2 text-sm">
                    <span className="w-28 shrink-0 text-xs text-tenue tabular-nums">{format(parseISO(s.inicio), "d MMM, HH:mm", { locale: es })}</span>
                    <span className="min-w-0 flex-1 truncate">{tarea?.titulo ?? (s.tareaId ? "Tarea borrada" : "Sin tarea")}{s.nota && <span className="text-tenue"> · {s.nota}</span>}</span>
                    <span className="shrink-0 text-xs text-tenue tabular-nums">{formatoMinutos(s.segundos / 60)}</span>
                    <button type="button" aria-label="Borrar sesión" className="text-tenue opacity-0 group-hover:opacity-100 hover:text-peligro focus-visible:opacity-100" onClick={() => void borrarSesion(s.id)}>
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </section>
      </div>

      {dialogo === "config" && <DialogoConfig alCerrar={() => setDialogo(null)} />}
      {dialogo === "manual" && <DialogoSesionManual alCerrar={() => setDialogo(null)} />}
      {dialogo === "abandonar" && <Confirmar titulo="¿Abandonar esta sesión?" mensaje="El tiempo de esta sesión no se guardará." textoAccion="Abandonar" alCerrar={() => setDialogo(null)} alConfirmar={acciones.abandonar} />}
    </div>
  );
}
