import { ChevronLeft } from "lucide-react";

/** App de PC: flecha blanca "<" junto al título que devuelve a la vista Configuración. */
export function FlechaVolver() {
  return (
    <a href="#/configuracion" aria-label="Volver a Configuración" title="Volver a Configuración" className="mr-1 hidden shrink-0 items-center rounded-lg p-0.5 text-white hover:bg-white/20 lg:inline-flex">
      <ChevronLeft size={30} strokeWidth={2.5} />
    </a>
  );
}
