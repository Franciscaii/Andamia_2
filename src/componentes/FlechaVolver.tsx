import { ChevronLeft } from "lucide-react";

/** App de PC: flecha negra "<" junto al título que devuelve a la vista Configuración. */
export function FlechaVolver() {
  return (
    <a href="#/configuracion" aria-label="Volver a Configuración" title="Volver a Configuración" className="mr-1 hidden shrink-0 items-center rounded-lg p-0.5 text-black hover:bg-black/10 lg:inline-flex">
      <ChevronLeft size={22} strokeWidth={2.5} />
    </a>
  );
}
