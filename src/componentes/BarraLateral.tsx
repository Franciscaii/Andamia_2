import { useMemo, useState, type ReactNode } from "react";
import { CalendarClock, CalendarDays, CalendarRange, CheckCheck, Flame, Grid2x2, Timer, ChevronDown, ChevronRight, Folder, FolderPlus, Inbox, Layers, ListTodo, Moon, Pencil, Plus, Search, Sun, Sunrise, Tag, Trash2 } from "lucide-react";
import { textoTemporizador, useAhora, useEnfoque } from "../datos/enfoque";
import { useTienda } from "../datos/tienda";
import { contarVista, estaPendiente, type VistaInteligente, VISTAS_INTELIGENTES } from "../logica/vistas";
import { hashDe, irA, type Seccion } from "../logica/ruta";
import type { Carpeta, Lista } from "../modelos/tipos";
import { BotonAvisos } from "./Avisos";
import { DialogoCarpeta, DialogoLista } from "./Dialogos";
import { Confirmar } from "./Modal";

const ICONOS: Record<VistaInteligente, ReactNode> = {
  todas: <Layers size={17} />,
  hoy: <CalendarClock size={17} />,
  manana: <Sunrise size={17} />,
  semana: <CalendarDays size={17} />,
  bandeja: <Inbox size={17} />,
  completadas: <CheckCheck size={17} />,
  papelera: <Trash2 size={17} />,
};

const claseFila = (activa: boolean) =>
  `group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${activa ? "bg-acento-suave font-medium" : "hover:bg-suave"}`;

function Fila({ href, activa, icono, nombre, contador, acciones }: { href: string; activa: boolean; icono: ReactNode; nombre: string; contador?: number; acciones?: ReactNode }) {
  return (
    <div className={claseFila(activa)}>
      <a href={href} aria-current={activa ? "page" : undefined} className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-tenue">{icono}</span>
        <span className="truncate">{nombre}</span>
        {contador ? <span className="ml-auto pl-1 text-xs text-tenue group-hover:hidden">{contador}</span> : null}
      </a>
      {acciones && <span className="hidden shrink-0 items-center gap-0.5 group-focus-within:flex group-hover:flex">{acciones}</span>}
    </div>
  );
}

function BotonIcono({ etiqueta, alPulsar, children }: { etiqueta: string; alPulsar: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={etiqueta} title={etiqueta} className="rounded p-0.5 text-tenue hover:bg-borde hover:text-texto" onClick={alPulsar}>
      {children}
    </button>
  );
}

function Punto({ color }: { color: string | null }) {
  return color ? <span className="block h-3 w-3 rounded-full" style={{ background: color }} /> : <ListTodo size={17} />;
}

function Marca() {
  return (
    <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--acento)" />
      <path d="M9 6v20M23 6v20M9 12h14M9 20h14M9 20l14-8" stroke="var(--sobre-acento)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Muestra el tiempo que queda desde cualquier pantalla. */
function FilaEnfoque({ activa }: { activa: boolean }) {
  const t = useEnfoque((s) => s.temporizador);
  const ahora = useAhora(t.estado === "corriendo");
  return (
    <div className={claseFila(activa)}>
      <a href={hashDe({ tipo: "enfoque" })} aria-current={activa ? "page" : undefined} className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-tenue">
          <Timer size={17} />
        </span>
        <span className="truncate">Enfoque</span>
        {t.estado !== "listo" && <span data-testid="tiempo-lateral" className="ml-auto pl-1 text-xs font-medium text-acento tabular-nums">{textoTemporizador(t, ahora)}</span>}
      </a>
    </div>
  );
}

type Dialogo =
  | { tipo: "lista"; lista: Lista | null; }
  | { tipo: "carpeta"; carpeta: Carpeta | null }
  | { tipo: "borrar-lista"; lista: Lista }
  | { tipo: "borrar-carpeta"; carpeta: Carpeta }
  | { tipo: "borrar-etiqueta"; nombre: string; visible: string };

export function BarraLateral({ seccion }: { seccion: Seccion }) {
  const tareas = useTienda((s) => s.tareas);
  const listas = useTienda((s) => s.listas);
  const carpetas = useTienda((s) => s.carpetas);
  const etiquetas = useTienda((s) => s.etiquetas);
  const tema = useTienda((s) => s.tema);
  const alternarTema = useTienda((s) => s.alternarTema);
  const borrarLista = useTienda((s) => s.borrarLista);
  const borrarCarpeta = useTienda((s) => s.borrarCarpeta);
  const borrarEtiqueta = useTienda((s) => s.borrarEtiqueta);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set());

  const pendientesPorLista = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tareas) if (estaPendiente(t)) m.set(t.listaId, (m.get(t.listaId) ?? 0) + 1);
    return m;
  }, [tareas]);

  const pendientesPorEtiqueta = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tareas) if (estaPendiente(t)) for (const e of t.etiquetas) m.set(e, (m.get(e) ?? 0) + 1);
    return m;
  }, [tareas]);

  const filaLista = (l: Lista) => (
    <Fila
      key={l.id}
      href={hashDe({ tipo: "lista", id: l.id })}
      activa={seccion.tipo === "lista" && seccion.id === l.id}
      icono={<Punto color={l.color} />}
      nombre={l.nombre}
      contador={pendientesPorLista.get(l.id)}
      acciones={
        <>
          <BotonIcono etiqueta={`Editar ${l.nombre}`} alPulsar={() => setDialogo({ tipo: "lista", lista: l })}>
            <Pencil size={14} />
          </BotonIcono>
          <BotonIcono etiqueta={`Borrar ${l.nombre}`} alPulsar={() => setDialogo({ tipo: "borrar-lista", lista: l })}>
            <Trash2 size={14} />
          </BotonIcono>
        </>
      }
    />
  );

  const alternarCarpeta = (id: string) =>
    setPlegadas((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const titulo = (texto: string, acciones?: ReactNode) => (
    <div className="mt-5 mb-1 flex items-center justify-between px-2 text-xs font-semibold tracking-wide text-tenue uppercase">
      <span>{texto}</span>
      {acciones && <span className="flex gap-0.5">{acciones}</span>}
    </div>
  );

  return (
    <aside className="flex h-full flex-col border-r border-borde bg-lateral">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Marca />
        <span className="text-base font-semibold">Andamia</span>
        <button type="button" aria-label={tema === "oscuro" ? "Usar tema claro" : "Usar tema oscuro"} title={tema === "oscuro" ? "Usar tema claro" : "Usar tema oscuro"} className="ml-auto rounded-md p-1.5 text-tenue hover:bg-suave" onClick={alternarTema}>
          {tema === "oscuro" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>

      <nav aria-label="Navegación" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <Fila href={hashDe({ tipo: "buscar" })} activa={seccion.tipo === "buscar"} icono={<Search size={17} />} nombre="Buscar" />
        {VISTAS_INTELIGENTES.filter((v) => !["completadas", "papelera"].includes(v.id)).map((v) => (
          <Fila
            key={v.id}
            href={hashDe({ tipo: "vista", vista: v.id })}
            activa={seccion.tipo === "vista" && seccion.vista === v.id}
            icono={ICONOS[v.id]}
            nombre={v.nombre}
            contador={contarVista(tareas, v.id, listas)}
          />
        ))}
        <Fila href={hashDe({ tipo: "calendario", modo: seccion.tipo === "calendario" ? seccion.modo : "mes" })} activa={seccion.tipo === "calendario"} icono={<CalendarRange size={17} />} nombre="Calendario" />
        <Fila href={hashDe({ tipo: "matriz" })} activa={seccion.tipo === "matriz"} icono={<Grid2x2 size={17} />} nombre="Matriz" />
        <FilaEnfoque activa={seccion.tipo === "enfoque"} />
        <Fila href={hashDe({ tipo: "habitos" })} activa={seccion.tipo === "habitos"} icono={<Flame size={17} />} nombre="Hábitos" />

        {titulo(
          "Listas",
          <>
            <BotonIcono etiqueta="Nueva carpeta" alPulsar={() => setDialogo({ tipo: "carpeta", carpeta: null })}>
              <FolderPlus size={15} />
            </BotonIcono>
            <BotonIcono etiqueta="Nueva lista" alPulsar={() => setDialogo({ tipo: "lista", lista: null })}>
              <Plus size={15} />
            </BotonIcono>
          </>,
        )}
        {!listas.length && !carpetas.length && <p className="px-2 text-xs text-tenue">Crea listas para ordenar tus tareas por tema.</p>}
        {carpetas.map((c) => {
          const plegada = plegadas.has(c.id);
          return (
            <div key={c.id}>
              <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-suave">
                <button type="button" aria-expanded={!plegada} className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => alternarCarpeta(c.id)}>
                  {plegada ? <ChevronRight size={15} className="shrink-0 text-tenue" /> : <ChevronDown size={15} className="shrink-0 text-tenue" />}
                  <Folder size={16} className="shrink-0 text-tenue" />
                  <span className="truncate">{c.nombre}</span>
                </button>
                <span className="hidden shrink-0 gap-0.5 group-focus-within:flex group-hover:flex">
                  <BotonIcono etiqueta={`Renombrar ${c.nombre}`} alPulsar={() => setDialogo({ tipo: "carpeta", carpeta: c })}>
                    <Pencil size={14} />
                  </BotonIcono>
                  <BotonIcono etiqueta={`Borrar carpeta ${c.nombre}`} alPulsar={() => setDialogo({ tipo: "borrar-carpeta", carpeta: c })}>
                    <Trash2 size={14} />
                  </BotonIcono>
                </span>
              </div>
              {!plegada && <div className="ml-4 border-l border-borde pl-1">{listas.filter((l) => l.carpetaId === c.id).map(filaLista)}</div>}
            </div>
          );
        })}
        {listas.filter((l) => !l.carpetaId || !carpetas.some((c) => c.id === l.carpetaId)).map(filaLista)}

        {titulo("Etiquetas")}
        {!etiquetas.length && <p className="px-2 text-xs text-tenue">Escribe #etiqueta al crear una tarea.</p>}
        {etiquetas.map((e) => (
          <Fila
            key={e.nombre}
            href={hashDe({ tipo: "etiqueta", nombre: e.nombre })}
            activa={seccion.tipo === "etiqueta" && seccion.nombre === e.nombre}
            icono={<Tag size={16} style={{ color: e.color }} />}
            nombre={e.nombreVisible}
            contador={pendientesPorEtiqueta.get(e.nombre)}
            acciones={
              <BotonIcono etiqueta={`Borrar etiqueta ${e.nombreVisible}`} alPulsar={() => setDialogo({ tipo: "borrar-etiqueta", nombre: e.nombre, visible: e.nombreVisible })}>
                <Trash2 size={14} />
              </BotonIcono>
            }
          />
        ))}

        <div className="mt-5 border-t border-borde pt-2">
          {VISTAS_INTELIGENTES.filter((v) => ["completadas", "papelera"].includes(v.id)).map((v) => (
            <Fila key={v.id} href={hashDe({ tipo: "vista", vista: v.id })} activa={seccion.tipo === "vista" && seccion.vista === v.id} icono={ICONOS[v.id]} nombre={v.nombre} />
          ))}
          <BotonAvisos />
        </div>
      </nav>

      {dialogo?.tipo === "lista" && <DialogoLista lista={dialogo.lista} alCerrar={() => setDialogo(null)} />}
      {dialogo?.tipo === "carpeta" && <DialogoCarpeta carpeta={dialogo.carpeta} alCerrar={() => setDialogo(null)} />}
      {dialogo?.tipo === "borrar-lista" && (
        <Confirmar
          titulo={`¿Borrar la lista "${dialogo.lista.nombre}"?`}
          mensaje="Sus tareas pasarán a la papelera y podrás restaurarlas en la bandeja de entrada."
          textoAccion="Borrar lista"
          alCerrar={() => setDialogo(null)}
          alConfirmar={() => {
            void borrarLista(dialogo.lista.id);
            if (seccion.tipo === "lista" && seccion.id === dialogo.lista.id) irA({ tipo: "vista", vista: "hoy" });
          }}
        />
      )}
      {dialogo?.tipo === "borrar-carpeta" && (
        <Confirmar
          titulo={`¿Borrar la carpeta "${dialogo.carpeta.nombre}"?`}
          mensaje="Sus listas y tareas no se borran: las listas quedarán fuera de la carpeta."
          textoAccion="Borrar carpeta"
          alCerrar={() => setDialogo(null)}
          alConfirmar={() => void borrarCarpeta(dialogo.carpeta.id)}
        />
      )}
      {dialogo?.tipo === "borrar-etiqueta" && (
        <Confirmar
          titulo={`¿Borrar la etiqueta "${dialogo.visible}"?`}
          mensaje="Se quitará de todas las tareas. Las tareas no se borran."
          textoAccion="Borrar etiqueta"
          alCerrar={() => setDialogo(null)}
          alConfirmar={() => {
            void borrarEtiqueta(dialogo.nombre);
            if (seccion.tipo === "etiqueta" && seccion.nombre === dialogo.nombre) irA({ tipo: "vista", vista: "hoy" });
          }}
        />
      )}
    </aside>
  );
}
