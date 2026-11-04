import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Columns3, List, RotateCcw, Trash2 } from "lucide-react";
import { EntradaRapida } from "../componentes/EntradaRapida";
import { FilaTarea } from "../componentes/FilaTarea";
import { ListaOrdenable } from "../componentes/ListaOrdenable";
import { claseBoton, Confirmar } from "../componentes/Modal";
import { useTienda } from "../datos/tienda";
import { irA, type Seccion } from "../logica/ruta";
import { agruparPorFecha, estaActiva, tareasDeVista, VISTAS_INTELIGENTES, type Grupo } from "../logica/vistas";
import type { Tarea } from "../modelos/tipos";
import { VistaKanban } from "./VistaKanban";

type SeccionTareas = Exclude<Seccion, { tipo: "buscar" | "calendario" }>;

function GrupoPlegable({ nombre, cantidad, inicialAbierto = true, children }: { nombre: string; cantidad: number; inicialAbierto?: boolean; children: ReactNode }) {
  const [abierto, setAbierto] = useState(inicialAbierto);
  return (
    <section className="mb-4">
      <button type="button" aria-expanded={abierto} className="mb-1 flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-sm font-semibold hover:bg-suave" onClick={() => setAbierto(!abierto)}>
        {abierto ? <ChevronDown size={15} className="text-tenue" /> : <ChevronRight size={15} className="text-tenue" />}
        {nombre}
        <span className="font-normal text-tenue">{cantidad}</span>
      </button>
      {abierto && children}
    </section>
  );
}

function Vacio({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="mt-16 text-center">
      <p className="font-medium">{titulo}</p>
      <p className="mt-1 text-sm text-tenue">{detalle}</p>
    </div>
  );
}

const porOrden = (a: Tarea, b: Tarea) => a.orden - b.orden;

export function VistaTareas({ seccion, tareaAbierta }: { seccion: SeccionTareas; tareaAbierta: string | null }) {
  const tareas = useTienda((s) => s.tareas);
  const listas = useTienda((s) => s.listas);
  const etiquetas = useTienda((s) => s.etiquetas);
  const restaurarTarea = useTienda((s) => s.restaurarTarea);
  const borrarDefinitivamente = useTienda((s) => s.borrarDefinitivamente);
  const vaciarPapelera = useTienda((s) => s.vaciarPapelera);
  const cambiarModoLista = useTienda((s) => s.cambiarModoLista);
  const [confirmarVaciar, setConfirmarVaciar] = useState(false);
  const [borrando, setBorrando] = useState<Tarea | null>(null);

  const ahora = new Date();
  const abrir = (id: string) => irA(seccion, id);

  const { titulo, color, pendientes, completadas } = useMemo(() => {
    if (seccion.tipo === "vista") {
      const v = VISTAS_INTELIGENTES.find((x) => x.id === seccion.vista);
      const mostrarHechas = seccion.vista === "bandeja" || seccion.vista === "todas";
      const excluidas = new Set(listas.filter((l) => !l.incluirEnTodas).map((l) => l.id));
      const hechas = tareas.filter((t) => estaActiva(t) && t.estado === "completada");
      return {
        titulo: v?.nombre ?? "",
        color: null as string | null,
        pendientes: tareasDeVista(tareas, seccion.vista, listas, ahora),
        completadas: !mostrarHechas ? [] : seccion.vista === "bandeja" ? hechas.filter((t) => t.listaId === "bandeja") : hechas.filter((t) => !excluidas.has(t.listaId)),
      };
    }
    const delGrupo = tareas.filter((t) => estaActiva(t) && (seccion.tipo === "lista" ? t.listaId === seccion.id : t.etiquetas.includes(seccion.nombre)));
    const lista = seccion.tipo === "lista" ? listas.find((l) => l.id === seccion.id) : null;
    return {
      titulo: seccion.tipo === "lista" ? lista?.nombre ?? "Lista no encontrada" : `#${etiquetas.find((e) => e.nombre === seccion.nombre)?.nombreVisible ?? seccion.nombre}`,
      color: lista?.color ?? null,
      pendientes: delGrupo.filter((t) => t.estado === "pendiente").sort(porOrden),
      completadas: delGrupo.filter((t) => t.estado === "completada"),
    };
    // `ahora` cambia en cada render y no debe invalidar el cálculo.
  }, [seccion, tareas, listas, etiquetas]);

  const esPapelera = seccion.tipo === "vista" && seccion.vista === "papelera";
  const esCompletadas = seccion.tipo === "vista" && seccion.vista === "completadas";
  const listaInexistente = seccion.tipo === "lista" && !listas.some((l) => l.id === seccion.id);
  const conEntrada = !esPapelera && !esCompletadas && !listaInexistente;
  const mostrarLista = seccion.tipo !== "lista";
  const agrupar = seccion.tipo === "vista" && ["todas", "hoy", "semana"].includes(seccion.vista);
  const grupos: Grupo[] = agrupar ? agruparPorFecha(pendientes, ahora) : [];
  const listaActual = seccion.tipo === "lista" ? listas.find((l) => l.id === seccion.id) : undefined;
  const enKanban = listaActual?.modo === "kanban";
  const botonModo = (activo: boolean) => `flex items-center gap-1.5 rounded px-2 py-1 text-xs ${activo ? "bg-panel font-medium shadow-sm" : "text-tenue hover:text-texto"}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 px-6 pt-5 pb-3">
        {color && <span className="h-3.5 w-3.5 rounded-full" style={{ background: color }} />}
        <h1 className="truncate text-xl font-semibold">{titulo}</h1>
        {listaActual && (
          <div role="group" aria-label="Modo de la lista" className="ml-auto flex shrink-0 gap-0.5 rounded-md bg-suave p-0.5">
            <button type="button" aria-pressed={!enKanban} className={botonModo(!enKanban)} onClick={() => void cambiarModoLista(listaActual.id, "lista")}>
              <List size={14} /> Lista
            </button>
            <button type="button" aria-pressed={enKanban} className={botonModo(enKanban)} onClick={() => void cambiarModoLista(listaActual.id, "kanban")}>
              <Columns3 size={14} /> Kanban
            </button>
          </div>
        )}
        {esPapelera && pendientes.length > 0 && (
          <button type="button" className={`${claseBoton} ml-auto flex items-center gap-1.5 text-peligro`} onClick={() => setConfirmarVaciar(true)}>
            <Trash2 size={14} /> Vaciar papelera
          </button>
        )}
      </header>

      {listaActual && enKanban ? (
        <VistaKanban key={listaActual.id} listaId={listaActual.id} tareaAbierta={tareaAbierta} alAbrir={abrir} />
      ) : (
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        {conEntrada && <EntradaRapida key={JSON.stringify(seccion)} seccion={seccion} />}

        {esPapelera || esCompletadas ? (
          <ul>
            {pendientes.map((t) => (
              <FilaTarea
                key={t.id}
                tarea={t}
                abierta={t.id === tareaAbierta}
                alAbrir={() => abrir(t.id)}
                mostrarLista
                acciones={
                  esPapelera ? (
                    <>
                      <button type="button" aria-label={`Restaurar ${t.titulo}`} title="Restaurar" className="rounded p-1 text-tenue hover:bg-borde hover:text-texto" onClick={() => void restaurarTarea(t.id)}>
                        <RotateCcw size={15} />
                      </button>
                      <button type="button" aria-label={`Borrar definitivamente ${t.titulo}`} title="Borrar definitivamente" className="rounded p-1 text-tenue hover:bg-borde hover:text-peligro" onClick={() => setBorrando(t)}>
                        <Trash2 size={15} />
                      </button>
                    </>
                  ) : undefined
                }
              />
            ))}
          </ul>
        ) : agrupar ? (
          grupos.map((g) => (
            <GrupoPlegable key={g.id} nombre={g.nombre} cantidad={g.tareas.length}>
              <ListaOrdenable tareas={g.tareas} tareaAbierta={tareaAbierta} alAbrir={abrir} mostrarLista={mostrarLista} />
            </GrupoPlegable>
          ))
        ) : (
          <ListaOrdenable tareas={pendientes} tareaAbierta={tareaAbierta} alAbrir={abrir} mostrarLista={mostrarLista} />
        )}

        {pendientes.length === 0 && completadas.length === 0 && (
          <Vacio
            titulo={listaInexistente ? "Esta lista ya no existe" : esPapelera ? "La papelera está vacía" : esCompletadas ? "Aún no completas tareas" : "Nada por aquí"}
            detalle={listaInexistente ? "Elige otra lista en la barra lateral." : esPapelera ? "Las tareas borradas aparecerán aquí." : esCompletadas ? "Las tareas terminadas aparecerán aquí." : "Escribe arriba para añadir una tarea."}
          />
        )}

        {completadas.length > 0 && (
          <GrupoPlegable nombre="Completadas" cantidad={completadas.length} inicialAbierto={seccion.tipo === "lista"}>
            <ul>
              {[...completadas]
                .sort((a, b) => (b.completadaEn ?? "").localeCompare(a.completadaEn ?? ""))
                .map((t) => (
                  <FilaTarea key={t.id} tarea={t} abierta={t.id === tareaAbierta} alAbrir={() => abrir(t.id)} mostrarLista={mostrarLista} />
                ))}
            </ul>
          </GrupoPlegable>
        )}
      </div>
      )}

      {confirmarVaciar && (
        <Confirmar titulo="¿Vaciar la papelera?" mensaje="Se borrarán para siempre todas las tareas de la papelera. No se puede deshacer." textoAccion="Vaciar papelera" alCerrar={() => setConfirmarVaciar(false)} alConfirmar={() => { void vaciarPapelera(); irA(seccion); }} />
      )}
      {borrando && (
        <Confirmar titulo={`¿Borrar "${borrando.titulo}" para siempre?`} mensaje="Esta acción no se puede deshacer." textoAccion="Borrar para siempre" alCerrar={() => setBorrando(null)} alConfirmar={() => { void borrarDefinitivamente(borrando.id); irA(seccion); }} />
      )}
    </div>
  );
}
