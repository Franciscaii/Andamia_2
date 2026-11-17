import { useState } from "react";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { DialogoEtiqueta } from "../componentes/Dialogos";
import { Confirmar } from "../componentes/Modal";
import { useTienda } from "../datos/tienda";
import type { Etiqueta } from "../modelos/tipos";

type Dialogo = { tipo: "etiqueta"; etiqueta: Etiqueta | null } | { tipo: "borrar"; etiqueta: Etiqueta };

/** Todas las etiquetas en tarjetas: el único lugar donde se crean, editan y eliminan. */
export function VistaEtiquetas() {
  const etiquetas = useTienda((s) => s.etiquetas);
  const borrarEtiqueta = useTienda((s) => s.borrarEtiqueta);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);

  const claseAccion = "flex items-center gap-1.5 rounded-md border border-borde bg-panel px-2 py-1 text-xs hover:bg-suave";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Celular: un solo encabezado, "Etiquetas" con el + azul como el de Semana. */}
      <header className="flex items-center justify-between px-4 pt-4 pb-2 sm:px-6 lg:hidden">
        <h1 className="text-lg font-semibold">Etiquetas</h1>
        <button type="button" aria-label="Nueva etiqueta" title="Nueva etiqueta" className="flex h-8 w-8 items-center justify-center rounded-full bg-acento text-sobre-acento hover:opacity-90" onClick={() => setDialogo({ tipo: "etiqueta", etiqueta: null })}>
          <Plus size={18} />
        </button>
      </header>
      <header className="hidden px-4 pt-4 pb-2 sm:px-6 lg:block">
        <h1 className="text-lg font-semibold">Etiquetas</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
        <div className="mb-3 hidden items-center justify-between border-b border-borde pb-1 lg:flex">
          <h2 className="text-base font-semibold">Configuración</h2>
          <button type="button" aria-label="Nueva etiqueta" title="Nueva etiqueta" className="rounded-md border border-borde bg-panel p-1 text-texto hover:bg-suave" onClick={() => setDialogo({ tipo: "etiqueta", etiqueta: null })}>
            <Plus size={18} />
          </button>
        </div>
        {!etiquetas.length && <p className="mt-10 text-center text-sm text-tenue">Aún no tienes etiquetas. Crea una con el +.</p>}
        <ul className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
          {etiquetas.map((e) => {
            return (
              <li key={e.nombre} data-testid="tarjeta-etiqueta" className="flex min-w-0 items-center gap-2 rounded-xl border border-borde bg-panel p-2.5 pl-3">
                <Tag size={17} className="shrink-0" style={{ color: e.color }} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium" title={e.nombreVisible}>{e.nombreVisible}</span>
                <button type="button" aria-label={`Editar etiqueta ${e.nombreVisible}`} title="Editar" className={claseAccion} onClick={() => setDialogo({ tipo: "etiqueta", etiqueta: e })}>
                  <Pencil size={14} /> <span>Editar</span>
                </button>
                <button type="button" aria-label={`Eliminar etiqueta ${e.nombreVisible}`} title="Eliminar" className={`${claseAccion} text-peligro`} onClick={() => setDialogo({ tipo: "borrar", etiqueta: e })}>
                  <Trash2 size={14} /> <span>Eliminar</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {dialogo?.tipo === "etiqueta" && (
        <DialogoEtiqueta
          etiqueta={dialogo.etiqueta}
          alEliminar={() => dialogo.etiqueta && setDialogo({ tipo: "borrar", etiqueta: dialogo.etiqueta })}
          alCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === "borrar" && (
        <Confirmar
          titulo={`¿Borrar la etiqueta "${dialogo.etiqueta.nombreVisible}"?`}
          mensaje="Se quitará de todas las tareas. Las tareas no se borran."
          textoAccion="Borrar etiqueta"
          alCerrar={() => setDialogo(null)}
          alConfirmar={() => void borrarEtiqueta(dialogo.etiqueta.nombre)}
        />
      )}
    </div>
  );
}
