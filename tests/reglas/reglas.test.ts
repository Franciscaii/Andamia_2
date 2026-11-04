import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, type Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let entorno: RulesTestEnvironment;

beforeAll(async () => {
  entorno = await initializeTestEnvironment({
    projectId: "demo-andamia",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8181 },
  });
});
afterAll(() => entorno.cleanup());
beforeEach(() => entorno.clearFirestore());

const de = (uid: string) => entorno.authenticatedContext(uid).firestore() as unknown as Firestore;
const anonimo = () => entorno.unauthenticatedContext().firestore() as unknown as Firestore;

const TAREA = { id: "t", listaId: "bandeja", titulo: "T", descripcion: "", estado: "pendiente", prioridad: "alta", orden: 0 };
const VALIDOS: Record<string, Record<string, unknown>> = {
  tasks: TAREA,
  lists: { id: "l", nombre: "L", orden: 0 },
  folders: { id: "f", nombre: "F", orden: 0 },
  tags: { nombre: "e", nombreVisible: "E", color: "#000000", orden: 0 },
  columns: { id: "c", listaId: "l", nombre: "C", orden: 0 },
  habits: { id: "h", nombre: "H", frecuencia: { tipo: "diaria" }, metaDiaria: 1, inicio: "2026-11-04", orden: 0 },
  habitLogs: { id: "h|2026-11-04", habitoId: "h", fecha: "2026-11-04", estado: "hecho", valor: 1 },
  focusSessions: { id: "s", tipo: "pomodoro", inicio: "2026-11-04T10:00:00.000Z", fin: "2026-11-04T10:25:00.000Z", segundos: 1500 },
};

describe("acceso", () => {
  it.each(Object.entries(VALIDOS))("%s: su dueña lee, escribe y borra", async (coleccion, datos) => {
    const r = doc(de("ana"), "users/ana", coleccion, "d");
    await assertSucceeds(setDoc(r, datos));
    await assertSucceeds(getDoc(r));
    await assertSucceeds(deleteDoc(r));
  });

  it.each(Object.entries(VALIDOS))("%s: otra persona no lee, escribe ni borra", async (coleccion, datos) => {
    await entorno.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore() as unknown as Firestore, "users/ana", coleccion, "d"), datos);
    });
    const r = doc(de("luis"), "users/ana", coleccion, "d");
    await assertFails(getDoc(r));
    await assertFails(setDoc(r, datos));
    await assertFails(deleteDoc(r));
    await assertFails(getDocs(collection(de("luis"), "users/ana", coleccion)));
  });

  it.each(Object.entries(VALIDOS))("%s: sin sesión no hay acceso", async (coleccion, datos) => {
    const r = doc(anonimo(), "users/ana", coleccion, "d");
    await assertFails(getDoc(r));
    await assertFails(setDoc(r, datos));
  });

  it("los ajustes son solo de su dueña", async () => {
    await assertSucceeds(setDoc(doc(de("ana"), "users/ana/settings/app"), { tema: "oscuro" }));
    await assertFails(getDoc(doc(de("luis"), "users/ana/settings/app")));
  });

  it("niega todo lo que está fuera de lo previsto", async () => {
    const ana = de("ana");
    await assertFails(setDoc(doc(ana, "secreto/x"), { a: 1 }));
    await assertFails(setDoc(doc(ana, "users/ana"), { a: 1 }));
    await assertFails(getDoc(doc(ana, "users/ana")));
    await assertFails(setDoc(doc(ana, "users/ana/otra/x"), { a: 1 }));
    await assertFails(getDocs(collection(ana, "users")));
    await assertFails(setDoc(doc(ana, "users/ana/tasks/t/sub/x"), { a: 1 }));
  });
});

describe("validación de campos", () => {
  const escribir = (coleccion: string, datos: Record<string, unknown>) => setDoc(doc(de("ana"), "users/ana", coleccion, "d"), datos);

  it.each([
    ["sin título", { ...TAREA, titulo: undefined }],
    ["título que no es texto", { ...TAREA, titulo: 3 }],
    ["título enorme", { ...TAREA, titulo: "x".repeat(5001) }],
    ["estado desconocido", { ...TAREA, estado: "rara" }],
    ["prioridad desconocida", { ...TAREA, prioridad: "maxima" }],
    ["orden que no es número", { ...TAREA, orden: "1" }],
  ])("rechaza una tarea con %s", async (_n, datos) => {
    await assertFails(escribir("tasks", Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined))));
  });

  it("acepta campos extra, para no bloquear versiones futuras", async () => {
    await assertSucceeds(escribir("tasks", { ...TAREA, repeticion: "FREQ=DAILY", vence: null }));
  });

  it.each([
    ["lists", { id: "l", orden: 0 }],
    ["folders", { id: "f", nombre: 1, orden: 0 }],
    ["tags", { nombre: "e", nombreVisible: "E", color: "x".repeat(21), orden: 0 }],
    ["columns", { id: "c", nombre: "C", orden: 0 }],
    ["habits", { id: "h", nombre: "H", frecuencia: "diaria", metaDiaria: 1, inicio: "2026-11-04", orden: 0 }],
    ["habitLogs", { id: "x", habitoId: "h", fecha: "2026-11-04", estado: "quizas", valor: 1 }],
    ["focusSessions", { id: "s", tipo: "otro", inicio: "a", fin: "b", segundos: 1 }],
    ["focusSessions", { id: "s", tipo: "pomodoro", inicio: "a", fin: "b", segundos: -1 }],
  ])("rechaza datos inválidos en %s", async (coleccion, datos) => {
    await assertFails(escribir(coleccion, datos));
  });

  it("la validación también aplica al actualizar", async () => {
    await assertSucceeds(escribir("tasks", TAREA));
    await assertFails(escribir("tasks", { ...TAREA, estado: "rara" }));
  });
});
