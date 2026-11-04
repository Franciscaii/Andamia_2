import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { FilaTarea } from "../componentes/FilaTarea";
import { claseCampo } from "../componentes/Modal";
import { useTienda } from "../datos/tienda";
import { buscarTareas, FILTROS_VACIOS, hayFiltros, type FiltroFecha, type Filtros } from "../logica/busqueda";
import { irA, useRuta } from "../logica/ruta";
import { LISTA_BANDEJA, PRIORIDADES, type EstadoTarea, type Prioridad } from "../modelos/tipos";

export function VistaBusqueda() {
  const ruta = useRuta();
  const tareas = useTienda((s) => s.tareas);
  const listas = useTienda((s) => s.listas);
  const etiquetas = useTienda((s) => s.etiquetas);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);

  const resultados = useMemo(() => (hayFiltros(filtros) ? buscarTareas(tareas, filtros) : []), [tareas, filtros]);
  const cambiar = (cambios: Partial<Filtros>) => setFiltros((f) => ({ ...f, ...cambios }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="px-6 pt-5 pb-3">
        <h1 className="mb-3 text-xl font-semibold">Buscar</h1>
        <div className="flex items-center gap-2 rounded-lg border border-borde bg-panel px-3 py-2 focus-within:border-acento">
          <Search size={17} className="shrink-0 text-tenue" />
          <input
            autoFocus
            type="search"
            aria-label="Buscar tareas"
            placeholder="Buscar en títulos, notas y subtareas"
            className="w-full bg-transparent text-sm outline-none placeholder:text-tenue"
            value={filtros.consulta}
            onChange={(e) => cambiar({ consulta: e.target.value })}
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          <select aria-label="Filtrar por lista" className={claseCampo} value={filtros.listaId ?? ""} onChange={(e) => cambiar({ listaId: e.target.value || null })}>
            <option value="">Todas las listas</option>
            <option value={LISTA_BANDEJA}>Bandeja de entrada</option>
            {listas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
          <select aria-label="Filtrar por etiqueta" className={claseCampo} value={filtros.etiqueta ?? ""} onChange={(e) => cambiar({ etiqueta: e.target.value || null })}>
            <option value="">Todas las etiquetas</option>
            {etiquetas.map((e) => (
              <option key={e.nombre} value={e.nombre}>
                {e.nombreVisible}
              </option>
            ))}
          </select>
          <select aria-label="Filtrar por fecha" className={claseCampo} value={filtros.fecha} onChange={(e) => cambiar({ fecha: e.target.value as FiltroFecha })}>
            <option value="cualquiera">Cualquier fecha</option>
            <option value="hoy">Hoy</option>
            <option value="semana">Próximos 7 días</option>
            <option value="atrasadas">Atrasadas</option>
            <option value="con-fecha">Con fecha</option>
            <option value="sin-fecha">Sin fecha</option>
          </select>
          <select aria-label="Filtrar por prioridad" className={claseCampo} value={filtros.prioridad ?? ""} onChange={(e) => cambiar({ prioridad: (e.target.value || null) as Prioridad | null })}>
            <option value="">Cualquier prioridad</option>
            {PRIORIDADES.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.nombre}
              </option>
            ))}
          </select>
          <select aria-label="Filtrar por estado" className={claseCampo} value={filtros.estado ?? ""} onChange={(e) => cambiar({ estado: (e.target.value || null) as EstadoTarea | null })}>
            <option value="">Cualquier estado</option>
            <option value="pendiente">Pendientes</option>
            <option value="completada">Completadas</option>
          </select>
        </div>
        {hayFiltros(filtros) && (
          <button type="button" className="mt-2 flex items-center gap-1 text-xs text-tenue hover:text-texto" onClick={() => setFiltros(FILTROS_VACIOS)}>
            <X size={13} /> Quitar filtros
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        {!hayFiltros(filtros) && <p className="mt-16 text-center text-sm text-tenue">Escribe algo o elige un filtro.</p>}
        {hayFiltros(filtros) && !resultados.length && <p className="mt-16 text-center text-sm text-tenue">No hay tareas que coincidan.</p>}
        {resultados.length > 0 && (
          <>
            <p className="mb-1 px-2 text-xs text-tenue" aria-live="polite">
              {resultados.length === 1 ? "1 resultado" : `${resultados.length} resultados`}
            </p>
            <ul>
              {resultados.map((t) => (
                <FilaTarea key={t.id} tarea={t} abierta={t.id === ruta.tareaId} alAbrir={() => irA({ tipo: "buscar" }, t.id)} mostrarLista consulta={filtros.consulta} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
