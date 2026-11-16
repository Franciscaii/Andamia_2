import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ListTodo, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { DialogoEtiqueta } from "../componentes/Dialogos";
import { Confirmar } from "../componentes/Modal";
import { useTienda } from "../datos/tienda";
import { hashDe } from "../logica/ruta";
import { estaPendiente } from "../logica/vistas";
import type { Etiqueta } from "../modelos/tipos";

type Dialogo = { tipo: "etiqueta"; etiqueta: Etiqueta | null } | { tipo: "borrar"; etiqueta: Etiqueta };

/** Todas las etiquetas en tarjetas: el único lugar donde se crean, editan y eliminan. */
export function VistaEtiquetas() {
  const etiquetas = useTienda((s) => s.etiquetas);
  const tareas = useTienda((s) => s.tareas);
  const borrarEtiqueta = useTienda((s) => s.borrarEtiqueta);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);

  const pendientes = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tareas) if (estaPendiente(t)) for (const e of t.etiquetas) m.set(e, (m.get(e) ?? 0) + 1);
    return m;
  }, [tareas]);

  const claseAccion = "flex items-center gap-1.5 rounded-md border border-borde bg-panel px-2 py-1 text-xs hover:bg-suave";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="px-4 pt-4 pb-2 sm:px-6">
        <h1 className="text-lg font-semibold">Etiquetas</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
        <div className="mb-3 flex items-center justify-between border-b border-borde pb-1">
          <h2 className="text-base font-semibold">Configuración</h2>
          <button type="button" aria-label="Nueva etiqueta" title="Nueva etiqueta" className="rounded-md border border-borde bg-panel p-1 text-texto hover:bg-suave" onClick={() => setDialogo({ tipo: "etiqueta", etiqueta: null })}>
            <Plus size={18} />
          </button>
        </div>
        {!etiquetas.length && <p className="mt-10 text-center text-sm text-tenue">Aún no tienes etiquetas. Crea una con el +.</p>}
        <ul className="grid grid-cols-2 items-start gap-2">
          {etiquetas.map((e) => {
            const esAbierta = abierta === e.nombre;
            const n = pendientes.get(e.nombre) ?? 0;
            return (
              <li key={e.nombre} data-testid="tarjeta-etiqueta" className={`min-w-0 rounded-xl border bg-panel ${esAbierta ? "border-acento" : "border-borde"}`}>
                <button
                  type="button"
                  aria-expanded={esAbierta}
                  aria-label={`Etiqueta ${e.nombreVisible}`}
                  className="flex w-full min-w-0 items-center gap-2 p-3 text-left"
                  onClick={() => setAbierta(esAbierta ? null : e.nombre)}
                >
                  <Tag size={17} className="shrink-0" style={{ color: e.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.nombreVisible}</span>
                  {n > 0 && <span className="shrink-0 text-xs text-tenue tabular-nums">{n}</span>}
                  {esAbierta ? <ChevronDown size={16} className="shrink-0 text-tenue" /> : <ChevronRight size={16} className="shrink-0 text-tenue" />}
                </button>
                {esAbierta && (
                  <div className="flex flex-wrap gap-1.5 border-t border-borde p-2">
                    <a href={hashDe({ tipo: "etiqueta", nombre: e.nombre })} className={claseAccion}>
                      <ListTodo size={14} /> Ver tareas
                    </a>
                    <button type="button" aria-label={`Editar etiqueta ${e.nombreVisible}`} className={claseAccion} onClick={() => setDialogo({ tipo: "etiqueta", etiqueta: e })}>
                      <Pencil size={14} /> Editar
                    </button>
                    <button type="button" aria-label={`Eliminar etiqueta ${e.nombreVisible}`} className={`${claseAccion} text-peligro`} onClick={() => setDialogo({ tipo: "borrar", etiqueta: e })}>
                      <Trash2 size={14} /> Eliminar
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {dialogo?.tipo === "etiqueta" && (
        <DialogoEtiqueta
          etiqueta={dialogo.etiqueta}
          alEliminar={() => dialogo.etiqueta && setDialogo({ tipo: "borrar", etiqueta: dialogo.etiqueta })}
          alCerrar={() => {
            setDialogo(null);
            // Si cambió de nombre, su tarjeta ya no queda abierta con el nombre viejo.
            setAbierta(null);
          }}
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
