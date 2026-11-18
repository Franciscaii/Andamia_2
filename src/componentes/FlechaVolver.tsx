import { ChevronLeft } from "lucide-react";

/** Flecha negra "<" junto al título que devuelve a la vista Configuración. */
export function FlechaVolver() {
  return (
    <a href="#/configuracion" aria-label="Volver a Configuración" title="Volver a Configuración" className="mr-1 inline-flex translate-y-[2px] shrink-0 items-center rounded-lg p-0.5 text-black hover:bg-black/10">
      <ChevronLeft size={22} strokeWidth={2.5} />
    </a>
  );
}
