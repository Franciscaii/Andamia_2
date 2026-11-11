import { CalendarDays, CalendarRange, ChartArea, ChartPie, Grid2x2, Monitor, type LucideIcon } from "lucide-react";
import { puenteEscritorio, useWidgetsAbiertos } from "../logica/puenteEscritorio";
import { WIDGETS, type TipoWidget } from "../logica/widgetEscritorio";

const DETALLE: Record<TipoWidget, { icono: LucideIcon; texto: string }> = {
  semana: { icono: CalendarRange, texto: "Los 7 días con sus eventos y tareas." },
  calendario: { icono: CalendarDays, texto: "El mes completo, con lo que tienes cada día." },
  matriz: { icono: Grid2x2, texto: "Los 4 cuadrantes de la Matriz de Eisenhower." },
  "estadistica-tareas": { icono: ChartPie, texto: "Cómo vas con tus tareas." },
  "estadistica-habitos": { icono: ChartArea, texto: "Rachas y cumplimiento de tus hábitos." },
};

/** Apartado "Widgets" (solo en la app de PC): poner o quitar widgets del escritorio. */
export function VistaWidgets() {
  const abiertos = useWidgetsAbiertos();
  const puente = puenteEscritorio();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-8">
      <h1 className="text-xl font-semibold">Widgets</h1>
      <p className="mt-1 text-sm text-tenue">Ponlos en el escritorio de Windows. Quedan detrás de las ventanas y vuelven al iniciar.</p>
      {!puente ? (
        <p className="mt-6 flex items-center gap-2 rounded-lg border border-borde bg-panel p-4 text-sm text-tenue">
          <Monitor size={18} /> Los widgets están disponibles en la app de Andamia para Windows.
        </p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2" aria-label="Widgets del escritorio">
          {WIDGETS.map((w) => {
            const { icono: Icono, texto } = DETALLE[w.id];
            const puesto = abiertos.includes(w.id);
            return (
              <li key={w.id} data-testid="widget-disponible" className="flex items-center gap-3 rounded-xl border border-borde bg-panel p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-acento-suave text-acento">
                  <Icono size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{w.nombre}</p>
                  <p className="text-xs text-tenue">{texto}</p>
                </div>
                <button
                  type="button"
                  aria-label={`${puesto ? "Quitar del escritorio" : "Añadir al escritorio"}: ${w.nombre}`}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${puesto ? "border border-borde text-tenue hover:text-texto" : "bg-acento text-sobre-acento hover:opacity-90"}`}
                  onClick={() => (puesto ? puente.cerrarWidget(w.id) : puente.abrirWidget(w.id))}
                >
                  {puesto ? "Quitar del escritorio" : "Añadir al escritorio"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
