import { useMemo, useState, type FormEvent } from "react";
import { AlarmClock, CalendarDays, Flag, ListTodo, Plus, Repeat, Tag } from "lucide-react";
import { recordatoriosActivos } from "../config";
import type { DatosNuevaTarea } from "../datos/repositorio";
import { useTienda } from "../datos/tienda";
import { interpretarEntrada, type EntradaInterpretada } from "../logica/entradaRapida";
import { diaRelativo, etiquetaFecha } from "../logica/fechas";
import { describirRegla } from "../logica/repeticion";
import type { Seccion } from "../logica/ruta";
import { LISTA_BANDEJA, type Prioridad } from "../modelos/tipos";
import { COLOR_PRIORIDAD } from "./FilaTarea";

/** Lo escrito manda; lo demás lo aporta el lugar donde se crea la tarea. */
export function datosDesdeEntrada(
  lectura: EntradaInterpretada,
  destino: { listaId?: string; etiqueta?: string; vence?: string; todoElDia?: boolean; columnaId?: string; prioridad?: Prioridad; esEvento?: boolean },
): DatosNuevaTarea {
  const vence = lectura.vence ?? destino.vence ?? null;
  const todoElDia = lectura.vence ? lectura.todoElDia : vence !== null && (destino.todoElDia ?? true);
  return {
    titulo: lectura.titulo,
    listaId: lectura.listaId ?? destino.listaId ?? LISTA_BANDEJA,
    prioridad: lectura.prioridad ?? destino.prioridad ?? "ninguna",
    esEvento: destino.esEvento ?? false,
    vence,
    todoElDia,
    etiquetas: [...lectura.etiquetas, ...(destino.etiqueta ? [destino.etiqueta] : [])],
    repeticion: lectura.repeticion,
    // Una tarea con hora avisa a esa hora; se puede quitar en el detalle.
    minutosRecordatorios: recordatoriosActivos && vence !== null && !todoElDia ? [0] : [],
    columnaId: lectura.listaId && lectura.listaId !== destino.listaId ? null : destino.columnaId ?? null,
  };
}

/** Datos que aporta la vista actual si el texto no dice otra cosa. */
function datosDeLaVista(seccion: Seccion) {
  if (seccion.tipo === "lista") return { listaId: seccion.id };
  if (seccion.tipo === "etiqueta") return { etiqueta: seccion.nombre };
  if (seccion.tipo === "vista" && seccion.vista === "hoy") return { vence: diaRelativo(0) };
  if (seccion.tipo === "vista" && seccion.vista === "semana") return { vence: diaRelativo(0) };
  if (seccion.tipo === "vista" && seccion.vista === "manana") return { vence: diaRelativo(1) };
  return {};
}

function Dato({ icono, texto, color }: { icono: React.ReactNode; texto: string; color?: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-suave px-2 py-0.5 text-xs" style={{ color }}>
      {icono}
      {texto}
    </span>
  );
}

interface PropsEntrada {
  seccion: Seccion;
  /** Reemplaza lo que aporta la vista, por ejemplo el día elegido en la semana. */
  destinoFijo?: { vence?: string; esEvento?: boolean };
  /** Se llama después de crear, por ejemplo para cerrar el campo. */
  alCrear?: () => void;
  autoFocus?: boolean;
}

export function EntradaRapida({ seccion, destinoFijo, alCrear, autoFocus }: PropsEntrada) {
  const listas = useTienda((s) => s.listas);
  const crearTarea = useTienda((s) => s.crearTarea);
  const [texto, setTexto] = useState("");

  const destino = destinoFijo ?? datosDeLaVista(seccion);
  const lectura = useMemo(() => (texto.trim() ? interpretarEntrada(texto, new Date(), listas) : null), [texto, listas]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!lectura?.titulo) return;
    setTexto("");
    await crearTarea(datosDesdeEntrada(lectura, destino));
    alCrear?.();
  };

  return (
    <form onSubmit={enviar} className="mb-3">
      <div className="flex items-center gap-2 rounded-lg border border-borde bg-panel px-3 py-2 focus-within:border-acento">
        <Plus size={17} className="shrink-0 text-tenue" />
        <input
          id="entrada-rapida"
          aria-label={destinoFijo?.esEvento ? "Añadir evento" : "Añadir tarea"}
          autoFocus={autoFocus}
          className="w-full bg-transparent text-sm outline-none placeholder:text-tenue"
          placeholder={destinoFijo?.esEvento ? "Añadir evento: Reunión 15:00" : "Añadir tarea: Llamar mañana 9am !alta #trabajo"}
          autoComplete="off"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      {lectura && (lectura.vence || lectura.prioridad || lectura.etiquetas.length > 0 || lectura.listaNombre) && (
        <div data-testid="datos-reconocidos" aria-live="polite" className="mt-1.5 flex flex-wrap gap-1.5 px-1">
          {lectura.vence && (
            <Dato
              icono={lectura.todoElDia ? <CalendarDays size={12} /> : <AlarmClock size={12} />}
              texto={etiquetaFecha({ vence: lectura.vence, todoElDia: lectura.todoElDia })}
            />
          )}
          {lectura.repeticion && <Dato icono={<Repeat size={12} />} texto={describirRegla(lectura.repeticion)} />}
          {lectura.prioridad && <Dato icono={<Flag size={12} />} texto={`Prioridad ${lectura.prioridad}`} color={COLOR_PRIORIDAD[lectura.prioridad]} />}
          {lectura.etiquetas.map((e) => (
            <Dato key={e} icono={<Tag size={12} />} texto={e} />
          ))}
          {lectura.listaNombre && <Dato icono={<ListTodo size={12} />} texto={lectura.listaNombre} />}
        </div>
      )}
    </form>
  );
}
