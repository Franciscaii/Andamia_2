import type { ReactNode } from "react";
import { CalendarDays, CalendarRange, ChartArea, ChartPie, Flame, Grid2x2, Settings, Tag } from "lucide-react";
import { hashDe, type Seccion } from "../logica/ruta";

/** Menú del celular: una franja abajo con iconos; la tuerca abre la pantalla Configuración. */
export function BarraInferior({ seccion }: { seccion: Seccion }) {
  const esSemana = seccion.tipo === "vista" && seccion.vista === "semana";
  const esPapelera = seccion.tipo === "vista" && seccion.vista === "papelera";
  const enConfiguracion = esPapelera || seccion.tipo === "configuracion" || seccion.tipo === "ajustes" || seccion.tipo === "widgets" || seccion.tipo === "tema";

  const clase = (activa: boolean) => `flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg ${activa ? "bg-acento-suave text-acento" : "text-tenue hover:bg-suave"}`;
  const icono = (nombre: string, destino: Seccion, activa: boolean, dibujo: ReactNode) => (
    <a href={hashDe(destino)} aria-label={nombre} title={nombre} aria-current={activa ? "page" : undefined} className={clase(activa)}>
      {dibujo}
    </a>
  );
  return (
    <nav aria-label="Menú de abajo" data-testid="menu-abajo" className="barra-inferior relative flex shrink-0 items-center gap-0.5 border-t border-borde px-1.5 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden">
      {icono("Configuración", { tipo: "configuracion" }, enConfiguracion, <Settings size={22} />)}
      {icono("Etiquetas", { tipo: "etiquetas" }, seccion.tipo === "etiquetas" || seccion.tipo === "etiqueta", <Tag size={22} />)}
      {icono("Semana", { tipo: "vista", vista: "semana" }, esSemana, <CalendarDays size={22} />)}
      {icono("Calendario", { tipo: "calendario", modo: seccion.tipo === "calendario" ? seccion.modo : "mes" }, seccion.tipo === "calendario", <CalendarRange size={22} />)}
      {icono("Hábitos", { tipo: "habitos" }, seccion.tipo === "habitos", <Flame size={22} />)}
      {icono("Matriz", { tipo: "matriz" }, seccion.tipo === "matriz", <Grid2x2 size={22} />)}
      {icono("Estadística Tareas", { tipo: "estadisticas", de: "tareas" }, seccion.tipo === "estadisticas" && seccion.de === "tareas", <ChartPie size={22} />)}
      {icono("Estadística Hábitos", { tipo: "estadisticas", de: "habitos" }, seccion.tipo === "estadisticas" && seccion.de === "habitos", <ChartArea size={22} />)}
    </nav>
  );
}
