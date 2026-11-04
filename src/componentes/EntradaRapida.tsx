import { useMemo, useState, type FormEvent } from "react";
import { AlarmClock, CalendarDays, Flag, ListTodo, Plus, Tag } from "lucide-react";
import { useTienda } from "../datos/tienda";
import { interpretarEntrada } from "../logica/entradaRapida";
import { diaRelativo, etiquetaFecha } from "../logica/fechas";
import type { Seccion } from "../logica/ruta";
import { LISTA_BANDEJA } from "../modelos/tipos";
import { COLOR_PRIORIDAD } from "./FilaTarea";

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

export function EntradaRapida({ seccion }: { seccion: Seccion }) {
  const listas = useTienda((s) => s.listas);
  const crearTarea = useTienda((s) => s.crearTarea);
  const [texto, setTexto] = useState("");

  const destino = datosDeLaVista(seccion);
  const lectura = useMemo(() => (texto.trim() ? interpretarEntrada(texto, new Date(), listas) : null), [texto, listas]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!lectura?.titulo) return;
    const vence = lectura.vence ?? destino.vence ?? null;
    const etiquetas = [...lectura.etiquetas, ...(destino.etiqueta ? [destino.etiqueta] : [])];
    setTexto("");
    await crearTarea({
      titulo: lectura.titulo,
      listaId: lectura.listaId ?? destino.listaId ?? LISTA_BANDEJA,
      prioridad: lectura.prioridad ?? "ninguna",
      vence,
      todoElDia: lectura.vence ? lectura.todoElDia : vence !== null,
      etiquetas,
    });
  };

  return (
    <form onSubmit={enviar} className="mb-3">
      <div className="flex items-center gap-2 rounded-lg border border-borde bg-panel px-3 py-2 focus-within:border-acento">
        <Plus size={17} className="shrink-0 text-tenue" />
        <input
          id="entrada-rapida"
          aria-label="Añadir tarea"
          className="w-full bg-transparent text-sm outline-none placeholder:text-tenue"
          placeholder="Añadir tarea: Llamar mañana 9am !alta #trabajo"
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
