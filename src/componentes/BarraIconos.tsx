import type { ReactNode } from "react";
import { CalendarDays, CalendarRange, ChartArea, ChartPie, Flame, Grid2x2, PanelLeftOpen, Settings, Tag } from "lucide-react";
import { hashDe, type Seccion } from "../logica/ruta";

/** App de PC con el menú retraído: solo los iconos (el logo arriba, el botón para traer el menú y la tuerca abajo). */
export function BarraIconos({ seccion, alMostrar }: { seccion: Seccion; alMostrar: () => void }) {
  const esSemana = seccion.tipo === "vista" && seccion.vista === "semana";
  const enConfiguracion = (seccion.tipo === "vista" && seccion.vista === "papelera") || seccion.tipo === "configuracion" || seccion.tipo === "ajustes" || seccion.tipo === "widgets" || seccion.tipo === "tema";
  const clase = (activa: boolean) => `flex h-10 w-10 items-center justify-center rounded-lg ${activa ? "bg-acento-suave" : "text-tenue hover:bg-suave"}`;
  const icono = (nombre: string, destino: Seccion, activa: boolean, dibujo: ReactNode) => (
    <a key={nombre} href={hashDe(destino)} aria-label={nombre} title={nombre} aria-current={activa ? "page" : undefined} className={clase(activa)}>
      {dibujo}
    </a>
  );
  return (
    <nav aria-label="Menú retraído" data-testid="menu-iconos" className="barra-lateral hidden shrink-0 flex-col items-center gap-1 border-r border-borde px-2 pt-4 pb-3 lg:flex">
      <div className="[-webkit-app-region:drag] flex flex-col items-center gap-2 pb-2 [&_button]:[-webkit-app-region:no-drag]">
        <button type="button" aria-label="Mostrar menú" title="Mostrar menú" className="rounded-md p-1.5 text-tenue hover:bg-suave" onClick={alMostrar}>
          <PanelLeftOpen size={18} />
        </button>
      </div>
      {icono("Semana", { tipo: "vista", vista: "semana" }, esSemana, <CalendarDays size={20} />)}
      {icono("Calendario", { tipo: "calendario", modo: seccion.tipo === "calendario" ? seccion.modo : "mes" }, seccion.tipo === "calendario", <CalendarRange size={20} />)}
      {icono("Hábitos", { tipo: "habitos" }, seccion.tipo === "habitos", <Flame size={20} />)}
      {icono("Matriz", { tipo: "matriz" }, seccion.tipo === "matriz", <Grid2x2 size={20} />)}
      {icono("Estadística Tareas", { tipo: "estadisticas", de: "tareas" }, seccion.tipo === "estadisticas" && seccion.de === "tareas", <ChartPie size={20} />)}
      {icono("Estadística Hábitos", { tipo: "estadisticas", de: "habitos" }, seccion.tipo === "estadisticas" && seccion.de === "habitos", <ChartArea size={20} />)}
      {icono("Etiquetas", { tipo: "etiquetas" }, seccion.tipo === "etiquetas" || seccion.tipo === "etiqueta", <Tag size={20} />)}
      <div className="mt-auto">{icono("Configuración", { tipo: "configuracion" }, enConfiguracion, <Settings size={20} />)}</div>
    </nav>
  );
}
