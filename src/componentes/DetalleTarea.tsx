import { useState, type FormEvent } from "react";
import { Check, Flag, RotateCcw, Trash2, X } from "lucide-react";
import { useTienda } from "../datos/tienda";
import { aFechaInput, aHoraInput, componerVence } from "../logica/fechas";
import { irA, type Seccion } from "../logica/ruta";
import { nuevoId } from "../logica/texto";
import { LISTA_BANDEJA, PRIORIDADES, type Subtarea, type Tarea } from "../modelos/tipos";
import { COLOR_PRIORIDAD } from "./FilaTarea";
import { claseBoton, claseCampo } from "./Modal";

function Subtareas({ tarea }: { tarea: Tarea }) {
  const actualizarTarea = useTienda((s) => s.actualizarTarea);
  const [nueva, setNueva] = useState("");
  const guardar = (subtareas: Subtarea[]) => actualizarTarea(tarea.id, { subtareas });
  const cambiar = (id: string, cambios: Partial<Subtarea>) => guardar(tarea.subtareas.map((s) => (s.id === id ? { ...s, ...cambios } : s)));

  const agregar = (e: FormEvent) => {
    e.preventDefault();
    if (!nueva.trim()) return;
    guardar([...tarea.subtareas, { id: nuevoId(), titulo: nueva.trim(), estado: "pendiente", orden: tarea.subtareas.length }]);
    setNueva("");
  };

  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-tenue uppercase">Subtareas</h3>
      <ul className="space-y-1">
        {tarea.subtareas.map((s) => {
          const hecha = s.estado === "completada";
          return (
            <li key={s.id} className="group flex items-center gap-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={hecha}
                aria-label={`Completar subtarea: ${s.titulo}`}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${hecha ? "border-acento bg-acento" : "border-tenue"}`}
                onClick={() => cambiar(s.id, { estado: hecha ? "pendiente" : "completada" })}
              >
                {hecha && <Check size={11} strokeWidth={3} className="text-sobre-acento" />}
              </button>
              <input
                aria-label="Título de la subtarea"
                className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${hecha ? "text-tenue line-through" : ""}`}
                value={s.titulo}
                onChange={(e) => cambiar(s.id, { titulo: e.target.value })}
              />
              <button type="button" aria-label={`Quitar subtarea: ${s.titulo}`} className="text-tenue opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => guardar(tarea.subtareas.filter((x) => x.id !== s.id))}>
                <X size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      <form onSubmit={agregar} className="mt-1.5">
        <input aria-label="Nueva subtarea" className={claseCampo} placeholder="Añadir subtarea y pulsar Enter" value={nueva} onChange={(e) => setNueva(e.target.value)} />
      </form>
    </section>
  );
}

function Etiquetas({ tarea }: { tarea: Tarea }) {
  const etiquetas = useTienda((s) => s.etiquetas);
  const actualizarTarea = useTienda((s) => s.actualizarTarea);
  const agregarEtiquetaATarea = useTienda((s) => s.agregarEtiquetaATarea);
  const [nueva, setNueva] = useState("");

  const agregar = (e: FormEvent) => {
    e.preventDefault();
    const nombre = nueva.replace(/^#/, "").trim();
    if (!nombre) return;
    void agregarEtiquetaATarea(tarea, nombre);
    setNueva("");
  };

  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-tenue uppercase">Etiquetas</h3>
      <div className="mb-1.5 flex flex-wrap gap-1">
        {tarea.etiquetas.map((clave) => {
          const e = etiquetas.find((x) => x.nombre === clave);
          return (
            <span key={clave} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ color: e?.color, background: `color-mix(in srgb, ${e?.color ?? "gray"} 16%, transparent)` }}>
              {e?.nombreVisible ?? clave}
              <button type="button" aria-label={`Quitar etiqueta ${e?.nombreVisible ?? clave}`} onClick={() => actualizarTarea(tarea.id, { etiquetas: tarea.etiquetas.filter((x) => x !== clave) })}>
                <X size={12} />
              </button>
            </span>
          );
        })}
      </div>
      <form onSubmit={agregar}>
        <input aria-label="Nueva etiqueta" list="etiquetas-existentes" className={claseCampo} placeholder="Añadir etiqueta y pulsar Enter" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <datalist id="etiquetas-existentes">
          {etiquetas.filter((e) => !tarea.etiquetas.includes(e.nombre)).map((e) => (
            <option key={e.nombre} value={e.nombreVisible} />
          ))}
        </datalist>
      </form>
    </section>
  );
}

export function DetalleTarea({ tareaId, seccion }: { tareaId: string; seccion: Seccion }) {
  const tarea = useTienda((s) => s.tareas.find((t) => t.id === tareaId));
  const listas = useTienda((s) => s.listas);
  const actualizarTarea = useTienda((s) => s.actualizarTarea);
  const completarTarea = useTienda((s) => s.completarTarea);
  const enviarAPapelera = useTienda((s) => s.enviarAPapelera);
  const restaurarTarea = useTienda((s) => s.restaurarTarea);

  const cerrar = () => irA(seccion);
  const clasePanel = "fixed inset-0 z-40 flex flex-col bg-panel md:static md:z-auto md:w-96 md:shrink-0 md:border-l md:border-borde";

  if (!tarea) {
    return (
      <aside aria-label="Detalle de la tarea" className={clasePanel}>
        <div className="flex items-center justify-between p-4 text-sm text-tenue">
          Esta tarea ya no existe.
          <button type="button" aria-label="Cerrar detalle" onClick={cerrar}>
            <X size={18} />
          </button>
        </div>
      </aside>
    );
  }

  const enPapelera = tarea.eliminadaEn !== null;
  const hecha = tarea.estado === "completada";
  const fecha = aFechaInput(tarea);
  const hora = aHoraInput(tarea);

  return (
    <aside aria-label="Detalle de la tarea" className={clasePanel}>
      <header className="flex items-center gap-2 border-b border-borde px-4 py-2.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={hecha}
          aria-label={hecha ? "Marcar como pendiente" : "Completar tarea"}
          disabled={enPapelera}
          onClick={() => void completarTarea(tarea.id, !hecha)}
          style={{ borderColor: COLOR_PRIORIDAD[tarea.prioridad], background: hecha ? COLOR_PRIORIDAD[tarea.prioridad] : undefined }}
          className="flex h-5 w-5 items-center justify-center rounded-full border-2"
        >
          {hecha && <Check size={13} strokeWidth={3} className="text-panel" />}
        </button>
        <span className="text-xs text-tenue">{enPapelera ? "En la papelera" : hecha ? "Completada" : "Pendiente"}</span>
        <button type="button" aria-label="Cerrar detalle" className="ml-auto rounded p-1 text-tenue hover:bg-suave" onClick={cerrar}>
          <X size={18} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <fieldset disabled={enPapelera} className="contents">
          <input
            aria-label="Título"
            className="w-full bg-transparent text-lg font-semibold outline-none"
            placeholder="Sin título"
            value={tarea.titulo}
            onChange={(e) => actualizarTarea(tarea.id, { titulo: e.target.value })}
          />

          <section className="grid grid-cols-2 gap-2">
            <label className="text-xs text-tenue">
              Fecha
              <input type="date" className={`${claseCampo} mt-1`} value={fecha} onChange={(e) => actualizarTarea(tarea.id, componerVence(e.target.value, hora))} />
            </label>
            <label className="text-xs text-tenue">
              Hora
              <input type="time" disabled={!fecha} className={`${claseCampo} mt-1 disabled:opacity-50`} value={hora} onChange={(e) => actualizarTarea(tarea.id, componerVence(fecha, e.target.value))} />
            </label>
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-tenue uppercase">Prioridad</h3>
            <div className="flex gap-1">
              {PRIORIDADES.map((p) => (
                <button
                  key={p.valor}
                  type="button"
                  aria-pressed={tarea.prioridad === p.valor}
                  onClick={() => actualizarTarea(tarea.id, { prioridad: p.valor })}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-xs ${tarea.prioridad === p.valor ? "border-acento bg-acento-suave font-medium" : "border-borde hover:bg-suave"}`}
                >
                  <Flag size={12} style={{ color: COLOR_PRIORIDAD[p.valor] }} />
                  {p.nombre}
                </button>
              ))}
            </div>
          </section>

          <label className="block text-xs text-tenue">
            Lista
            <select className={`${claseCampo} mt-1`} value={tarea.listaId} onChange={(e) => actualizarTarea(tarea.id, { listaId: e.target.value })}>
              <option value={LISTA_BANDEJA}>Bandeja de entrada</option>
              {listas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-tenue">
            Notas
            <textarea rows={5} className={`${claseCampo} mt-1 resize-y`} placeholder="Escribe aquí tus notas" value={tarea.descripcion} onChange={(e) => actualizarTarea(tarea.id, { descripcion: e.target.value })} />
          </label>

          <Subtareas tarea={tarea} />
          <Etiquetas tarea={tarea} />
        </fieldset>
      </div>

      <footer className="flex justify-end border-t border-borde px-4 py-2.5">
        {enPapelera ? (
          <button type="button" className={`${claseBoton} flex items-center gap-1.5`} onClick={() => void restaurarTarea(tarea.id)}>
            <RotateCcw size={14} /> Restaurar
          </button>
        ) : (
          <button
            type="button"
            className={`${claseBoton} flex items-center gap-1.5 text-peligro`}
            onClick={() => {
              void enviarAPapelera(tarea.id);
              cerrar();
            }}
          >
            <Trash2 size={14} /> Enviar a la papelera
          </button>
        )}
      </footer>
    </aside>
  );
}
