import { ChevronRight, LayoutDashboard, Palette, Settings, Trash2, UserCog } from "lucide-react";
import type { ReactNode } from "react";
import { esAppNativa } from "../logica/plataforma";
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
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 px-4 pt-4 pb-3 sm:px-6">
        <Settings size={22} />
        <h1 className="text-lg font-semibold">Configuración</h1>
      </header>
      <ul className="flex min-h-0 flex-1 flex-col justify-center gap-4 overflow-y-auto px-4 pb-16 sm:px-6">
        {fila("Tema", { tipo: "tema" }, <Palette size={24} />)}
        {esAppNativa() && fila("Widgets", { tipo: "widgets" }, <LayoutDashboard size={24} />)}
        {fila("Cuenta y ajustes", { tipo: "ajustes" }, <UserCog size={24} />)}
        {fila("Papelera", { tipo: "vista", vista: "papelera" }, <Trash2 size={24} />)}
      </ul>
    </div>
  );
}
