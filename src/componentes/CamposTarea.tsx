import { useState, type KeyboardEvent } from "react";
import { Check, Flag, X } from "lucide-react";
import { useTienda } from "../datos/tienda";
import { nuevoId } from "../logica/texto";
import { PRIORIDADES, type Prioridad, type Subtarea } from "../modelos/tipos";
import { COLOR_NIVEL } from "./FilaTarea";
import { claseCampo } from "./Modal";

/**
 * Campos de una tarea o un evento, en el orden que pidió Francisca:
 * título, fecha, (importancia y dificultad, solo tareas), índole, notas y subtareas.
 * Los usan la ventana de "nueva tarea/evento" y el detalle.
 */

export const claseTituloCampo = "mb-1 text-xs font-semibold tracking-wide text-tenue uppercase";

/** Alta, media, baja o ninguna, con el color de la semana (rojo, amarillo, azul). */
export function SelectorNivel({ titulo, ayuda, valor, alElegir }: { titulo: string; ayuda: string; valor: Prioridad; alElegir: (v: Prioridad) => void }) {
  return (
    <section role="group" aria-label={titulo}>
      <h3 className={claseTituloCampo}>
        {titulo} <span className="font-normal normal-case tracking-normal">· {ayuda}</span>
      </h3>
      <div className="flex gap-1">
        {PRIORIDADES.map((p) => (
          <button
            key={p.valor}
            type="button"
            aria-pressed={valor === p.valor}
            onClick={() => alElegir(p.valor)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-xs ${valor === p.valor ? "border-acento bg-acento-suave font-medium" : "border-borde hover:bg-suave"}`}
          >
            <Flag size={12} style={{ color: COLOR_NIVEL[p.valor] }} />
            {p.nombre}
          </button>
        ))}
      </div>
    </section>
  );
}

/** La etiqueta de la índole (el ámbito): se elige una; tocarla otra vez la quita. */
export function SelectorIndole({ valor, alElegir }: { valor: string | null; alElegir: (clave: string | null) => void }) {
  const etiquetas = useTienda((s) => s.etiquetas);
  return (
    <section role="group" aria-label="Índole">
      <h3 className={claseTituloCampo}>Índole</h3>
      {etiquetas.length === 0 ? (
        <p className="text-xs text-tenue">Crea etiquetas desde el menú, en Etiquetas.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {etiquetas.map((e) => {
            const elegida = valor === e.nombre;
            return (
              <button
                key={e.nombre}
                type="button"
                aria-pressed={elegida}
                onClick={() => alElegir(elegida ? null : e.nombre)}
                className="rounded-full border px-2.5 py-1 text-xs font-medium"
                style={{
                  color: e.color,
                  borderColor: elegida ? e.color : `color-mix(in srgb, ${e.color} 35%, transparent)`,
                  background: elegida ? `color-mix(in srgb, ${e.color} 18%, transparent)` : "transparent",
                }}
              >
                {e.nombreVisible}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function CampoNotas({ valor, alCambiar }: { valor: string; alCambiar: (v: string) => void }) {
  return (
    <label className="block text-xs text-tenue">
      <span className={`${claseTituloCampo} block`}>Notas</span>
      <textarea aria-label="Notas" rows={4} className={`${claseCampo} resize-y`} placeholder="Escribe aquí tus notas" value={valor} onChange={(e) => alCambiar(e.target.value)} />
    </label>
  );
}

export function EditorSubtareas({ subtareas, alCambiar }: { subtareas: Subtarea[]; alCambiar: (s: Subtarea[]) => void }) {
  const [nueva, setNueva] = useState("");
  const cambiar = (id: string, cambios: Partial<Subtarea>) => alCambiar(subtareas.map((s) => (s.id === id ? { ...s, ...cambios } : s)));

  // Enter añade la subtarea sin enviar el formulario que la contiene.
  const alPulsar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!nueva.trim()) return;
    alCambiar([...subtareas, { id: nuevoId(), titulo: nueva.trim(), estado: "pendiente", orden: subtareas.length }]);
    setNueva("");
  };

  return (
    <section>
      <h3 className={claseTituloCampo}>Subtareas</h3>
      <ul className="space-y-1">
        {subtareas.map((s) => {
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
              <button type="button" aria-label={`Quitar subtarea: ${s.titulo}`} className="text-tenue opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => alCambiar(subtareas.filter((x) => x.id !== s.id))}>
                <X size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      <input aria-label="Nueva subtarea" className={`${claseCampo} mt-1.5`} placeholder="Añadir subtarea y pulsar Enter" value={nueva} onChange={(e) => setNueva(e.target.value)} onKeyDown={alPulsar} />
    </section>
  );
}
