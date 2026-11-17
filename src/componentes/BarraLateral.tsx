import { useState, type ReactNode } from "react";
import { CalendarClock, ChartArea, ChartPie, CalendarDays, CalendarRange, CheckCheck, Cloud, CloudOff, Flame, Grid2x2, RefreshCw, Settings, ChevronDown, ChevronRight, Folder, FolderPlus, Inbox, LayoutDashboard, Layers, ListTodo, Palette, Pencil, Plus, Sunrise, Tag, Trash2, PanelLeftClose } from "lucide-react";
import { listasActivas } from "../config";
import { useCuenta } from "../datos/cuenta";
import { useTienda } from "../datos/tienda";
import { type VistaInteligente, VISTAS_INTELIGENTES } from "../logica/vistas";
import { hashDe, INICIO, irA, type Seccion } from "../logica/ruta";
import { esAppNativa } from "../logica/plataforma";
import { puenteEscritorio } from "../logica/puenteEscritorio";
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

/** Francisca pidió quitar Todas, Hoy, Mañana y Bandeja de entrada del menú. */
const VISTAS_EN_MENU: VistaInteligente[] = ["semana"];

const claseFila = (activa: boolean) =>
  `group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${activa ? "bg-acento-suave font-medium" : "hover:bg-suave"}`;

function Fila({ href, activa, icono, nombre, acciones }: { href: string; activa: boolean; icono: ReactNode; nombre: string; acciones?: ReactNode }) {
  return (
    <div className={claseFila(activa)}>
      <a href={href} aria-current={activa ? "page" : undefined} className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-tenue">{icono}</span>
        <span className="truncate">{nombre}</span>
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

/** Logo de Andamia (hexágono con check), el mismo ícono de la app. */
export function Marca({ clase = "h-7 w-7" }: { clase?: string }) {
  return <img src={`${import.meta.env.BASE_URL}iconos/icono-64.png`} alt="" aria-hidden="true" className={`${clase} shrink-0`} />;
}

function FilaAjustes({ activa }: { activa: boolean }) {
  const usuario = useCuenta((s) => s.usuario);
  const enLinea = useCuenta((s) => s.enLinea);
  const sinConfirmar = useCuenta((s) => s.sinConfirmar);
  let icono = <Settings size={17} />;
  let estado = "";
  if (usuario) {
    if (!enLinea) {
      icono = <CloudOff size={17} />;
      estado = "Sin conexión";
    } else if (sinConfirmar) {
      icono = <RefreshCw size={17} className="animate-spin" />;
      estado = "Sincronizando";
    } else {
      icono = <Cloud size={17} />;
      estado = "Sincronizado";
    }
  }
  return (
    <div className={claseFila(activa)}>
      <a href={hashDe({ tipo: "ajustes" })} aria-current={activa ? "page" : undefined} className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-tenue">{icono}</span>
        <span className="truncate">Cuenta y ajustes</span>
        {estado && <span data-testid="estado-sync" className="ml-auto pl-1 text-xs text-tenue">{estado}</span>}
      </a>
    </div>
  );
}

type Dialogo =
  | { tipo: "lista"; lista: Lista | null; }
  | { tipo: "carpeta"; carpeta: Carpeta | null }
  | { tipo: "borrar-lista"; lista: Lista }
  | { tipo: "borrar-carpeta"; carpeta: Carpeta };

export function BarraLateral({ seccion, alOcultar }: { seccion: Seccion; alOcultar?: () => void }) {
  const listas = useTienda((s) => s.listas);
  const carpetas = useTienda((s) => s.carpetas);
  const etiquetas = useTienda((s) => s.etiquetas);
  const borrarLista = useTienda((s) => s.borrarLista);
  const borrarCarpeta = useTienda((s) => s.borrarCarpeta);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set());
  // Las etiquetas del menú parten plegadas; se recuerda si se dejaron a la vista.
  const [etiquetasAbiertas, setEtiquetasAbiertasEstado] = useState(() => {
    try {
      return localStorage.getItem("andamia-menu-etiquetas") === "si";
    } catch {
      return false;
    }
  });
  const setEtiquetasAbiertas = (abiertas: boolean) => {
    setEtiquetasAbiertasEstado(abiertas);
    try {
      localStorage.setItem("andamia-menu-etiquetas", abiertas ? "si" : "no");
    } catch {
      // Sin almacenamiento: se recuerda mientras la página siga abierta.
    }
  };

  // Sin listas creadas y con la opción apagada, la sección entera desaparece.
  const mostrarListas = listasActivas || listas.length > 0 || carpetas.length > 0;

  const filaLista = (l: Lista) => (
    <Fila
      key={l.id}
      href={hashDe({ tipo: "lista", id: l.id })}
      activa={seccion.tipo === "lista" && seccion.id === l.id}
      icono={<Punto color={l.color} />}
      nombre={l.nombre}
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
    <aside className="barra-lateral flex h-full flex-col border-r border-borde">
      {/* En la app de PC esta fila también sirve para mover la ventana (no tiene barra de título). */}
      <div className="flex min-w-0 items-center gap-2 px-4 pt-4 pb-3 [-webkit-app-region:drag] [&_button]:[-webkit-app-region:no-drag]">
        <span className="shrink-0">
          <Marca />
        </span>
        <span className="contorno-blanco min-w-0 flex-1 text-base font-semibold">Andamia</span>
        {/* Donde estaba la luna: la paleta, que lleva a elegir el tema. */}
        <button type="button" aria-label="Elegir tema" title="Elegir tema" className="shrink-0 rounded-md p-1.5 text-tenue hover:bg-suave" onClick={() => irA({ tipo: "tema" })}>
          <Palette size={17} />
        </button>
        {alOcultar && (
          <button type="button" aria-label="Ocultar menú" title="Ocultar menú" className="shrink-0 rounded-md p-1.5 text-tenue hover:bg-suave" onClick={alOcultar}>
            <PanelLeftClose size={17} />
          </button>
        )}
      </div>

      <nav aria-label="Navegación" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {VISTAS_INTELIGENTES.filter((v) => VISTAS_EN_MENU.includes(v.id)).map((v) => (
          <Fila
            key={v.id}
            href={hashDe({ tipo: "vista", vista: v.id })}
            activa={seccion.tipo === "vista" && seccion.vista === v.id}
            icono={ICONOS[v.id]}
            nombre={v.nombre}
          />
        ))}
        <Fila href={hashDe({ tipo: "calendario", modo: seccion.tipo === "calendario" ? seccion.modo : "mes" })} activa={seccion.tipo === "calendario"} icono={<CalendarRange size={17} />} nombre="Calendario" />
        <Fila href={hashDe({ tipo: "estadisticas", de: "tareas" })} activa={seccion.tipo === "estadisticas" && seccion.de === "tareas"} icono={<ChartPie size={17} />} nombre="Estadística Tareas" />
        <Fila href={hashDe({ tipo: "habitos" })} activa={seccion.tipo === "habitos"} icono={<Flame size={17} />} nombre="Hábitos" />
        <Fila href={hashDe({ tipo: "estadisticas", de: "habitos" })} activa={seccion.tipo === "estadisticas" && seccion.de === "habitos"} icono={<ChartArea size={17} />} nombre="Estadística Hábitos" />
        <Fila href={hashDe({ tipo: "matriz" })} activa={seccion.tipo === "matriz"} icono={<Grid2x2 size={17} />} nombre="Matriz" />

        {/* Etiquetas: el nombre abre su vista (donde se editan); la flecha solo las despliega para verlas. */}
        <div className={claseFila(seccion.tipo === "etiquetas")}>
          <a href={hashDe({ tipo: "etiquetas" })} aria-current={seccion.tipo === "etiquetas" ? "page" : undefined} className="flex min-w-0 flex-1 items-center gap-2">
            <span className="shrink-0 text-tenue"><Tag size={17} /></span>
            <span className="truncate">Etiquetas</span>
          </a>
          <button
            type="button"
            aria-expanded={etiquetasAbiertas}
            aria-label={etiquetasAbiertas ? "Ocultar etiquetas" : "Ver etiquetas"}
            title={etiquetasAbiertas ? "Ocultar etiquetas" : "Ver etiquetas"}
            className="shrink-0 rounded p-0.5 text-tenue hover:bg-borde hover:text-texto"
            onClick={() => setEtiquetasAbiertas(!etiquetasAbiertas)}
          >
            {etiquetasAbiertas ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
        {etiquetasAbiertas && (
          <div className="ml-4 border-l border-borde pl-1">
            {!etiquetas.length && <p className="px-2 py-1 text-xs text-tenue">Aún no hay etiquetas.</p>}
            {/* Solo se ven: editarlas y borrarlas se hace en la vista Etiquetas. */}
            {etiquetas.map((e) => (
              <div key={e.nombre} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                <span className="shrink-0 text-tenue"><Tag size={16} style={{ color: e.color }} /></span>
                <span className="truncate">{e.nombreVisible}</span>
              </div>
            ))}
          </div>
        )}

        {mostrarListas && titulo(
          "Listas",
          listasActivas && <>
            <BotonIcono etiqueta="Nueva carpeta" alPulsar={() => setDialogo({ tipo: "carpeta", carpeta: null })}>
              <FolderPlus size={15} />
            </BotonIcono>
            <BotonIcono etiqueta="Nueva lista" alPulsar={() => setDialogo({ tipo: "lista", lista: null })}>
              <Plus size={15} />
            </BotonIcono>
          </>,
        )}
        {listasActivas && !listas.length && !carpetas.length && <p className="px-2 text-xs text-tenue">Crea listas para ordenar tus tareas por tema.</p>}
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

        <div className="mt-4">
          {/* El tema se elige con la paleta de arriba, junto al nombre de la app. */}
          {/* En la app de PC (escritorio de Windows) y en la del celular (pantalla de inicio). */}
          {(puenteEscritorio() || esAppNativa()) && <Fila href={hashDe({ tipo: "widgets" })} activa={seccion.tipo === "widgets"} icono={<LayoutDashboard size={17} />} nombre="Widgets" />}
        </div>

        <div className="mt-5 border-t border-borde pt-2">
          {/* "Completadas" salió del menú a pedido de Francisca; su dirección (#/tareas/completadas) sigue funcionando. */}
          {VISTAS_INTELIGENTES.filter((v) => v.id === "papelera").map((v) => (
            <Fila key={v.id} href={hashDe({ tipo: "vista", vista: v.id })} activa={seccion.tipo === "vista" && seccion.vista === v.id} icono={ICONOS[v.id]} nombre={v.nombre} />
          ))}
          <BotonAvisos />
          <FilaAjustes activa={seccion.tipo === "ajustes"} />
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
            if (seccion.tipo === "lista" && seccion.id === dialogo.lista.id) irA(INICIO);
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
    </aside>
  );
}
