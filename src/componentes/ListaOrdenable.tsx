import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTienda } from "../datos/tienda";
import type { Tarea } from "../modelos/tipos";
import { FilaTarea } from "./FilaTarea";

interface PropsFila {
  tarea: Tarea;
  abierta: boolean;
  alAbrir: () => void;
  mostrarLista: boolean;
}

function FilaOrdenable({ tarea, abierta, alAbrir, mostrarLista }: PropsFila) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tarea.id });
  return (
    <FilaTarea
      tarea={tarea}
      abierta={abierta}
      alAbrir={alAbrir}
      mostrarLista={mostrarLista}
      refFila={setNodeRef}
      estilo={{ transform: CSS.Translate.toString(transform), transition }}
      asaProps={{ ...attributes, ...listeners }}
      filaProps={{
        // Con el ratón también se toma desde cualquier parte de la fila.
        onPointerDown: (e) => {
          if (e.pointerType === "mouse") (listeners?.onPointerDown as ((ev: typeof e) => void) | undefined)?.(e);
        },
      }}
      arrastrando={isDragging}
    />
  );
}

interface Props {
  tareas: Tarea[];
  tareaAbierta: string | null;
  alAbrir: (id: string) => void;
  mostrarLista: boolean;
}

export function ListaOrdenable({ tareas, tareaAbierta, alAbrir, mostrarLista }: Props) {
  const reordenar = useTienda((s) => s.reordenar);
  const sensores = useSensors(
    // La distancia mínima evita que un clic se interprete como arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const alSoltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = tareas.map((t) => t.id);
    const nuevos = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    void reordenar(nuevos, String(active.id));
  };

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCenter}
      onDragEnd={alSoltar}
      accessibility={{
        screenReaderInstructions: { draggable: "Pulsa Espacio para tomar la tarea, usa las flechas para moverla y Espacio para soltarla. Esc cancela." },
        announcements: {
          onDragStart: () => "Tarea tomada.",
          onDragOver: () => "Tarea movida.",
          onDragEnd: () => "Tarea soltada.",
          onDragCancel: () => "Movimiento cancelado.",
        },
      }}
    >
      <SortableContext items={tareas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul>
          {tareas.map((t) => (
            <FilaOrdenable key={t.id} tarea={t} abierta={t.id === tareaAbierta} alAbrir={() => alAbrir(t.id)} mostrarLista={mostrarLista} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
