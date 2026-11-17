import { ChevronRight, LayoutDashboard, Palette, Settings, Trash2, UserCog } from "lucide-react";
import type { ReactNode } from "react";
import { Marca } from "../componentes/BarraLateral";
import { esAppNativa } from "../logica/plataforma";
import { puenteEscritorio } from "../logica/puenteEscritorio";
import { hashDe, type Seccion } from "../logica/ruta";

/** Celular: la pantalla de la tuerca, con cada ajuste en su propia fila con borde. */
export function VistaConfiguracion() {
  const fila = (nombre: string, destino: Seccion, dibujo: ReactNode) => (
    <li key={nombre}>
      <a href={hashDe(destino)} className="flex items-center gap-4 rounded-2xl border border-borde bg-panel px-5 py-6 text-base font-medium hover:bg-suave">
        <span className="text-tenue">{dibujo}</span>
        <span className="flex-1">{nombre}</span>
        <ChevronRight size={16} className="text-tenue" />
      </a>
    </li>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* Arriba: el logo y el nombre de la app. */}
      <div className="flex shrink-0 items-center gap-2 px-5 pt-10 lg:hidden">
        <Marca clase="h-8 w-8" />
        <span className="contorno-blanco text-xl font-semibold">Andamia</span>
      </div>
      <div className="my-auto pb-16 pt-6">
      {/* Título y tarjetas van juntos y centrados: el título queda a poca distancia de las tarjetas. */}
      <header className="flex items-center gap-2 px-4 pb-4 sm:px-6">
        <Settings size={22} />
        <h1 className="text-lg font-semibold">Configuración</h1>
      </header>
      <ul className="flex flex-col gap-4 px-4 sm:px-6">
        {fila("Tema", { tipo: "tema" }, <Palette size={24} />)}
        {(esAppNativa() || puenteEscritorio()) && fila("Widgets", { tipo: "widgets" }, <LayoutDashboard size={24} />)}
        {fila("Cuenta y ajustes", { tipo: "ajustes" }, <UserCog size={24} />)}
        {fila("Papelera", { tipo: "vista", vista: "papelera" }, <Trash2 size={24} />)}
      </ul>
      </div>
    </div>
  );
}
