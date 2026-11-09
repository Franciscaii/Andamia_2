import { beforeEach, describe, expect, it } from "vitest";
import { bd } from "../../src/datos/bd";
import * as repo from "../../src/datos/repositorio";

beforeEach(async () => {
  await bd.delete();
  await bd.open();
});

describe("tareas", () => {
  it("crea en la bandeja por defecto y la nueva queda arriba", async () => {
    const { tarea: a } = await repo.crearTarea({ titulo: " Primera " });
    const { tarea: b } = await repo.crearTarea({ titulo: "Segunda" });
    expect(a.titulo).toBe("Primera");
    expect(a.listaId).toBe("bandeja");
    expect(b.orden).toBeLessThan(a.orden);
  });

  it("persiste los datos", async () => {
    const { tarea } = await repo.crearTarea({ titulo: "Guardada", prioridad: "alta", vence: "2026-11-05", todoElDia: true });
    bd.close();
    await bd.open();
    const leida = (await repo.cargarTodo()).tareas.find((t) => t.id === tarea.id);
    expect(leida).toMatchObject({ titulo: "Guardada", prioridad: "alta", vence: "2026-11-05", todoElDia: true });
  });

  it("crea etiquetas al usarlas, sin duplicar por mayúsculas", async () => {
    const { tarea, etiquetasNuevas } = await repo.crearTarea({ titulo: "T", etiquetas: ["Trabajo", "trabajo"] });
    expect(tarea.etiquetas).toEqual(["trabajo"]);
    expect(etiquetasNuevas.map((e) => e.nombreVisible)).toEqual(["Trabajo"]);
    expect(await bd.etiquetas.count()).toBe(1);
  });

  it("completa y descompleta", async () => {
    const { tarea } = await repo.crearTarea({ titulo: "T" });
    const [hecha] = await repo.completarTarea(tarea.id, true);
    expect(hecha.estado).toBe("completada");
    expect(hecha.completadaEn).not.toBeNull();
    const [deshecha] = await repo.completarTarea(tarea.id, false);
    expect(deshecha.estado).toBe("pendiente");
    expect(deshecha.completadaEn).toBeNull();
  });

  it("falla al actualizar una tarea que no existe", async () => {
    await expect(repo.actualizarTarea("nada", { titulo: "x" })).rejects.toThrow();
  });

  it("agrega subtareas", async () => {
    const { tarea } = await repo.crearTarea({ titulo: "T" });
    const con = await repo.agregarSubtarea(tarea, " Paso uno ");
    expect(con.subtareas).toHaveLength(1);
    expect(con.subtareas[0]).toMatchObject({ titulo: "Paso uno", estado: "pendiente" });
  });
});

describe("papelera", () => {
  it("el borrado es suave y se puede restaurar", async () => {
    const { tarea } = await repo.crearTarea({ titulo: "T" });
    const borrada = await repo.enviarAPapelera(tarea.id);
    expect(borrada.eliminadaEn).not.toBeNull();
    expect(await bd.tareas.get(tarea.id)).toBeDefined();
    const restaurada = await repo.restaurarTarea(tarea.id);
    expect(restaurada.eliminadaEn).toBeNull();
  });

  it("vaciar elimina solo lo que está en la papelera", async () => {
    const { tarea: a } = await repo.crearTarea({ titulo: "A" });
    const { tarea: b } = await repo.crearTarea({ titulo: "B" });
    await repo.enviarAPapelera(a.id);
    await repo.vaciarPapelera();
    expect(await bd.tareas.get(a.id)).toBeUndefined();
    expect(await bd.tareas.get(b.id)).toBeDefined();
  });
});

describe("listas y carpetas", () => {
  it("borrar una lista envía sus tareas a la papelera, incluidas las completadas", async () => {
    const lista = await repo.crearLista({ nombre: "Compras" });
    const { tarea: a } = await repo.crearTarea({ titulo: "A", listaId: lista.id });
    const { tarea: b } = await repo.crearTarea({ titulo: "B", listaId: lista.id });
    const { tarea: otra } = await repo.crearTarea({ titulo: "Otra" });
    await repo.completarTarea(b.id, true);
    await repo.borrarLista(lista.id);
    expect(await bd.listas.get(lista.id)).toBeUndefined();
    expect((await bd.tareas.get(a.id))?.eliminadaEn).not.toBeNull();
    expect((await bd.tareas.get(b.id))?.eliminadaEn).not.toBeNull();
    expect((await bd.tareas.get(otra.id))?.eliminadaEn).toBeNull();
  });

  it("restaurar una tarea de una lista borrada la lleva a la bandeja", async () => {
    const lista = await repo.crearLista({ nombre: "Compras" });
    const { tarea } = await repo.crearTarea({ titulo: "A", listaId: lista.id });
    await repo.borrarLista(lista.id);
    expect((await repo.restaurarTarea(tarea.id)).listaId).toBe("bandeja");
  });

  it("recorta el nombre de la lista a 64 caracteres", async () => {
    expect((await repo.crearLista({ nombre: "x".repeat(80) })).nombre).toHaveLength(64);
  });

  it("borrar una carpeta deja sus listas sueltas", async () => {
    const carpeta = await repo.crearCarpeta("Personal");
    const lista = await repo.crearLista({ nombre: "Compras", carpetaId: carpeta.id });
    await repo.borrarCarpeta(carpeta.id);
    expect((await bd.listas.get(lista.id))?.carpetaId).toBeNull();
    expect(await bd.carpetas.count()).toBe(0);
  });
});

describe("etiquetas", () => {
  it("borrar una etiqueta la quita de las tareas", async () => {
    const { tarea } = await repo.crearTarea({ titulo: "T", etiquetas: ["uno", "dos"] });
    await repo.borrarEtiqueta("uno");
    expect((await bd.tareas.get(tarea.id))?.etiquetas).toEqual(["dos"]);
    expect(await bd.etiquetas.get("uno")).toBeUndefined();
  });

  it("agrega las etiquetas iniciales sin pisar las que ya existen", async () => {
    await repo.guardarEtiqueta(null, { nombreVisible: "Universidad", color: "#000000" });
    const creadas = await repo.sembrarEtiquetasIniciales();
    expect(creadas.map((e) => e.nombreVisible)).toEqual(["Otro", "Vinculos", "NecesidadBiologica", "CuidadoPersonal", "DisfrutePersonal", "VidaCotidiana", "DesarrolloProfesional"]);
    expect((await bd.etiquetas.get("universidad"))?.color).toBe("#000000");
    expect(await repo.sembrarEtiquetasIniciales()).toEqual([]);
  });

  it("editar el nombre cambia la etiqueta en las tareas y no permite repetir", async () => {
    const { tarea } = await repo.crearTarea({ titulo: "T", etiquetas: ["uni", "casa"] });
    const editada = await repo.guardarEtiqueta("uni", { nombreVisible: "Universidad", color: "#14c9a0" });
    expect(editada).toMatchObject({ nombre: "universidad", nombreVisible: "Universidad", color: "#14c9a0", orden: 0 });
    expect((await bd.tareas.get(tarea.id))?.etiquetas).toEqual(["universidad", "casa"]);
    expect(await bd.etiquetas.get("uni")).toBeUndefined();
    await expect(repo.guardarEtiqueta("casa", { nombreVisible: "universidad", color: "#000000" })).rejects.toBeInstanceOf(repo.EtiquetaRepetida);
    // Solo cambiar mayúsculas o color mantiene la misma etiqueta.
    await repo.guardarEtiqueta("universidad", { nombreVisible: "UNIVERSIDAD", color: "#111111" });
    expect((await bd.etiquetas.get("universidad"))?.nombreVisible).toBe("UNIVERSIDAD");
  });
});

describe("reordenar", () => {
  it("mueve entre vecinas cambiando solo la tarea movida", async () => {
    const { tarea: c } = await repo.crearTarea({ titulo: "C" });
    const { tarea: b } = await repo.crearTarea({ titulo: "B" });
    const { tarea: a } = await repo.crearTarea({ titulo: "A" });
    const cambiadas = await repo.reordenarTarea([b.id, a.id, c.id], a.id);
    expect(cambiadas).toHaveLength(1);
    const orden = (await bd.tareas.orderBy("orden").toArray()).map((t) => t.titulo);
    expect(orden).toEqual(["B", "A", "C"]);
  });

  it("renumera cuando no hay hueco", async () => {
    const { tarea: a } = await repo.crearTarea({ titulo: "A" });
    const { tarea: b } = await repo.crearTarea({ titulo: "B" });
    const { tarea: c } = await repo.crearTarea({ titulo: "C" });
    await repo.actualizarTarea(a.id, { orden: 5 });
    await repo.actualizarTarea(b.id, { orden: 5 });
    await repo.actualizarTarea(c.id, { orden: 5 });
    await repo.reordenarTarea([a.id, c.id, b.id], c.id);
    const orden = (await bd.tareas.orderBy("orden").toArray()).map((t) => t.titulo);
    expect(orden).toEqual(["A", "C", "B"]);
  });
});
