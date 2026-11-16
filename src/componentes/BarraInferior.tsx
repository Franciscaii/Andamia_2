import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, CalendarRange, ChartArea, ChartPie, Flame, LayoutDashboard, Palette, Settings, Tag, Trash2, UserCog } from "lucide-react";
import { esAppNativa } from "../logica/plataforma";
import { hashDe, type Seccion } from "../logica/ruta";

/** Menú del celular: una franja abajo con 7 iconos; el engranaje abre lo demás. */
export function BarraInferior({ seccion }: { seccion: Seccion }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => setAbierto(false), [seccion]);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    window.addEventListener("pointerdown", fuera);
    return () => window.removeEventListener("pointerdown", fuera);
  }, [abierto]);

  const esSemana = seccion.tipo === "vista" && seccion.vista === "semana";
  const esPapelera = seccion.tipo === "vista" && seccion.vista === "papelera";
  const enMas = esPapelera || seccion.tipo === "ajustes" || seccion.tipo === "widgets" || seccion.tipo === "tema";

  const clase = (activa: boolean) => `flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg ${activa ? "bg-acento-suave text-acento" : "text-tenue hover:bg-suave"}`;
  const icono = (nombre: string, destino: Seccion, activa: boolean, dibujo: ReactNode) => (
    <a href={hashDe(destino)} aria-label={nombre} title={nombre} aria-current={activa ? "page" : undefined} className={clase(activa)}>
      {dibujo}
    </a>
  );
  const fila = (nombre: string, destino: Seccion, activa: boolean, dibujo: ReactNode) => (
    <a href={hashDe(destino)} role="menuitem" aria-current={activa ? "page" : undefined} className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm ${activa ? "bg-acento-suave font-medium" : "hover:bg-suave"}`}>
      <span className="text-tenue">{dibujo}</span>
      {nombre}
    </a>
  );

  return (
    <nav aria-label="Menú de abajo" data-testid="menu-abajo" className="barra-inferior relative flex shrink-0 items-center gap-0.5 border-t border-borde px-1.5 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden">
      {icono("Semana", { tipo: "vista", vista: "semana" }, esSemana, <CalendarDays size={22} />)}
      {icono("Calendario", { tipo: "calendario", modo: seccion.tipo === "calendario" ? seccion.modo : "mes" }, seccion.tipo === "calendario", <CalendarRange size={22} />)}
      {icono("Estadística Tareas", { tipo: "estadisticas", de: "tareas" }, seccion.tipo === "estadisticas" && seccion.de === "tareas", <ChartPie size={22} />)}
      {icono("Hábitos", { tipo: "habitos" }, seccion.tipo === "habitos", <Flame size={22} />)}
      {icono("Estadística Hábitos", { tipo: "estadisticas", de: "habitos" }, seccion.tipo === "estadisticas" && seccion.de === "habitos", <ChartArea size={22} />)}
      {icono("Etiquetas", { tipo: "etiquetas" }, seccion.tipo === "etiquetas" || seccion.tipo === "etiqueta", <Tag size={22} />)}
      <div ref={caja} className="flex min-w-0 flex-1">
        <button type="button" aria-label="Más opciones" title="Más opciones" aria-haspopup="menu" aria-expanded={abierto} className={clase(enMas || abierto)} onClick={() => setAbierto(!abierto)}>
          <Settings size={22} />
        </button>
        {abierto && (
          <div role="menu" aria-label="Más opciones" className="absolute right-1.5 bottom-full z-30 mb-1.5 w-56 rounded-xl border border-borde bg-panel p-1 shadow-lg">
            {fila("Papelera", { tipo: "vista", vista: "papelera" }, esPapelera, <Trash2 size={18} />)}
            {fila("Cuenta y ajustes", { tipo: "ajustes" }, seccion.tipo === "ajustes", <UserCog size={18} />)}
            {esAppNativa() && fila("Widgets", { tipo: "widgets" }, seccion.tipo === "widgets", <LayoutDashboard size={18} />)}
            {fila("Tema", { tipo: "tema" }, seccion.tipo === "tema", <Palette size={18} />)}
          </div>
        )}
      </div>
    </nav>
  );
}
