import { expect, test, type Locator, type Page } from "@playwright/test";

// Miércoles 4 de noviembre de 2026, 12:00 en Santiago.
const AHORA = new Date("2026-11-04T12:00:00-03:00");

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AHORA);
});

const entrada = (page: Page) => page.getByRole("textbox", { name: "Añadir tarea" });
const navegar = (page: Page, nombre: string) => page.getByRole("navigation").getByRole("link", { name: new RegExp(`^${nombre}`) }).click();
const fila = (page: Page, texto: string) => page.getByTestId("fila-tarea").filter({ hasText: texto });

async function agregar(page: Page, texto: string) {
  await entrada(page).fill(texto);
  await entrada(page).press("Enter");
  await expect(entrada(page)).toHaveValue("");
}

async function crearLista(page: Page, nombre: string) {
  await page.getByRole("button", { name: "Nueva lista" }).click();
  const dialogo = page.getByRole("dialog", { name: "Nueva lista" });
  await dialogo.getByLabel("Nombre").fill(nombre);
  await dialogo.getByRole("button", { name: "Crear lista" }).click();
  await expect(page.getByRole("heading", { level: 1, name: nombre })).toBeVisible();
}

/** Arrastre con ratón real, paso a paso, como lo haría una persona. */
async function arrastrar(page: Page, origen: Locator, destino: Locator, ajuste: { x?: number; y?: number } = {}) {
  const a = await origen.boundingBox();
  await destino.scrollIntoViewIfNeeded();
  const b = await destino.boundingBox();
  if (!a || !b) throw new Error("No se encontró dónde arrastrar");
  const x = b.x + (ajuste.x ?? b.width / 2);
  const y = b.y + (ajuste.y ?? b.height / 2);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 + 8, { steps: 4 });
  await page.mouse.move(x, y, { steps: 18 });
  await page.waitForTimeout(150);
  await page.mouse.move(x + 1, y + 1, { steps: 2 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  // dnd-kit ignora los clics durante un instante tras soltar; una persona no llega tan rápido.
  await page.waitForTimeout(120);
}

test("una tarea 'cada lunes' completada genera la siguiente", async ({ page }) => {
  await page.goto("/#/tareas/bandeja");
  await entrada(page).fill("Reunión de equipo cada lunes");
  await expect(page.getByTestId("datos-reconocidos")).toContainText("Cada lunes");
  await entrada(page).press("Enter");

  const tarea = fila(page, "Reunión de equipo");
  await expect(tarea).toContainText("Lunes");
  await tarea.getByRole("button", { name: /^Reunión de equipo/ }).click();
  const detalle = page.getByRole("complementary", { name: "Detalle de la tarea" });
  await expect(detalle.getByLabel("Fecha", { exact: true })).toHaveValue("2026-11-09");
  await detalle.getByLabel("Nueva subtarea").fill("Preparar agenda");
  await detalle.getByLabel("Nueva subtarea").press("Enter");
  await detalle.getByRole("checkbox", { name: "Completar subtarea: Preparar agenda" }).click();
  await expect(tarea).toContainText("1/1");

  await tarea.getByRole("checkbox", { name: /^Completar: Reunión de equipo/ }).click();

  // Sigue pendiente, una semana después y con la subtarea sin marcar.
  await expect(detalle.getByLabel("Fecha", { exact: true })).toHaveValue("2026-11-16");
  await expect(fila(page, "Reunión de equipo").first()).toContainText("0/1");

  await page.goto("/#/tareas/completadas");
  const hecha = fila(page, "Reunión de equipo");
  await expect(hecha).toHaveCount(1);
  // La copia conserva la fecha original: el lunes 9, a 5 días de hoy.
  await expect(hecha).toContainText("Lunes");
});

test("recordatorio: aviso en la app y notificación del navegador", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await page.addInitScript(() => {
    const avisos: string[] = [];
    (window as unknown as { avisos: string[] }).avisos = avisos;
    class Falsa {
      static permission = "granted";
      static requestPermission = async () => "granted";
      onclick: (() => void) | null = null;
      constructor(titulo: string) {
        avisos.push(titulo);
      }
      close() {}
    }
    (window as unknown as { Notification: unknown }).Notification = Falsa;
  });
  await page.goto("/#/tareas/bandeja");

  // Vence dentro de una hora: aún no debe avisar.
  await agregar(page, "Llamar al banco 13:00");
  await expect(page.getByTestId("aviso")).toHaveCount(0);

  // Con un recordatorio de 1 día antes, el momento ya pasó y avisa enseguida.
  await page.getByRole("button", { name: /^Llamar al banco/ }).click();
  const detalle = page.getByRole("complementary", { name: "Detalle de la tarea" });
  await expect(detalle.getByRole("listitem").filter({ hasText: "A la hora" })).toBeVisible();
  await detalle.getByLabel("Añadir recordatorio").selectOption("1440");
  await expect(detalle.getByRole("listitem").filter({ hasText: "1 día antes" })).toBeVisible();

  const aviso = page.getByTestId("aviso");
  await expect(aviso).toHaveCount(1);
  await expect(aviso).toContainText("Llamar al banco");
  await expect.poll(() => page.evaluate(() => (window as unknown as { avisos: string[] }).avisos)).toEqual(["Llamar al banco"]);

  // No se repite al recargar.
  await page.reload();
  await expect(page.getByRole("button", { name: /^Llamar al banco/ })).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.getByTestId("aviso")).toHaveCount(0);
});

test("el permiso se pide con un botón, no al cargar", async ({ page }) => {
  await page.addInitScript(() => {
    const estado = { pedidos: 0 };
    (window as unknown as { estado: typeof estado }).estado = estado;
    class Falsa {
      static permission = "default";
      static requestPermission = async () => {
        estado.pedidos += 1;
        Falsa.permission = "granted";
        return "granted";
      };
    }
    (window as unknown as { Notification: unknown }).Notification = Falsa;
  });
  await page.goto("/");
  const boton = page.getByRole("button", { name: "Activar avisos del navegador" });
  await expect(boton).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { estado: { pedidos: number } }).estado.pedidos)).toBe(0);
  await boton.click();
  await expect(page.getByText("Avisos del navegador activados")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { estado: { pedidos: number } }).estado.pedidos)).toBe(1);
});

test("Lista: reordenar con el ratón y persistir", async ({ page }) => {
  await page.goto("/");
  await crearLista(page, "Compras");
  for (const t of ["Tercera", "Segunda", "Primera"]) await agregar(page, t);
  const titulos = async () => (await page.getByTestId("fila-tarea").allInnerTexts()).map((x) => x.trim());
  await expect.poll(titulos).toEqual(["Primera", "Segunda", "Tercera"]);

  const primera = fila(page, "Primera");
  await primera.hover();
  await arrastrar(page, primera.getByRole("button", { name: "Mover Primera" }), fila(page, "Tercera"));
  await expect.poll(titulos).toEqual(["Segunda", "Tercera", "Primera"]);

  await page.reload();
  await expect.poll(titulos).toEqual(["Segunda", "Tercera", "Primera"]);
});

test("Kanban: columnas y arrastrar tareas con el ratón", async ({ page }) => {
  await page.goto("/");
  await crearLista(page, "Proyecto");
  await agregar(page, "Diseñar logo");
  await agregar(page, "Escribir textos");

  await page.getByRole("button", { name: "Kanban" }).click();
  const columna = (nombre: string) => page.getByRole("region", { name: `Columna ${nombre}` });
  await expect(columna("Sin sección")).toContainText("Diseñar logo");

  for (const nombre of ["En curso", "Hecho"]) {
    await page.getByLabel("Nueva columna").fill(nombre);
    await page.getByLabel("Nueva columna").press("Enter");
    await expect(columna(nombre)).toBeVisible();
  }

  // Mover con ratón entre columnas, también a una vacía.
  const tarjeta = columna("Sin sección").getByTestId("fila-tarea").filter({ hasText: "Diseñar logo" });
  await tarjeta.hover();
  await arrastrar(page, tarjeta.getByRole("button", { name: "Mover Diseñar logo" }), columna("En curso"));
  await expect(columna("En curso")).toContainText("Diseñar logo");
  await expect(columna("Sin sección")).not.toContainText("Diseñar logo");

  // Persiste tras recargar.
  await page.reload();
  await expect(columna("En curso")).toContainText("Diseñar logo");

  // Reordenar dentro de una columna con ratón.
  await page.getByRole("button", { name: "Añadir tarea en En curso" }).click();
  await page.getByLabel("Nueva tarea en En curso").fill("Revisar marca");
  await page.getByLabel("Nueva tarea en En curso").press("Enter");
  const titulos = () => columna("En curso").getByTestId("fila-tarea").allInnerTexts();
  await expect.poll(async () => (await titulos()).map((x) => x.trim())).toEqual(["Revisar marca", "Diseñar logo"]);
  const primera = columna("En curso").getByTestId("fila-tarea").first();
  const segunda = columna("En curso").getByTestId("fila-tarea").nth(1);
  await primera.hover();
  await arrastrar(page, primera.getByRole("button", { name: "Mover Revisar marca" }), segunda, { y: 40 });
  await expect.poll(async () => (await titulos()).map((x) => x.trim())).toEqual(["Diseñar logo", "Revisar marca"]);

  // Renombrar.
  await page.getByRole("button", { name: "Renombrar Hecho" }).click();
  await page.getByLabel("Nombre de la columna").fill("Terminado");
  await page.getByLabel("Nombre de la columna").press("Enter");
  await expect(columna("Terminado")).toBeVisible();

  // Reordenar columnas con ratón.
  const nombres = () => page.getByTestId("columna").locator("h2").allInnerTexts();
  await arrastrar(page, page.getByRole("button", { name: "Mover columna Terminado" }), columna("Sin sección"));
  await expect.poll(nombres).toEqual(["Terminado", "Sin sección", "En curso"]);

  // Borrar moviendo las tareas a otra.
  await page.getByRole("button", { name: "Borrar columna En curso" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Mover las tareas a").selectOption({ label: "Terminado" });
  await dialogo.getByRole("button", { name: "Borrar columna" }).click();
  await expect(columna("En curso")).toHaveCount(0);
  await expect(columna("Terminado")).toContainText("Diseñar logo");
  await expect(columna("Terminado")).toContainText("Revisar marca");

  // Volver a Lista conserva las tareas.
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(fila(page, "Diseñar logo")).toBeVisible();
  await expect(fila(page, "Escribir textos")).toBeVisible();
  await page.reload();
  await expect(fila(page, "Diseñar logo")).toBeVisible();
  await expect(page.getByTestId("columna")).toHaveCount(0);
});

test("Calendario: arrastrar cambia la fecha, clic crea y panel sin fecha", async ({ page }) => {
  await page.goto("/#/tareas/bandeja");
  await agregar(page, "Dentista el viernes");
  await agregar(page, "Ordenar fotos");

  await navegar(page, "Calendario");
  await expect(page.getByTestId("titulo-calendario")).toHaveText("Nov");
  const dia = (clave: string) => page.locator(`[data-zona="dia:${clave}"]`);
  const chip = (texto: string) => page.getByTestId("chip-tarea").filter({ hasText: texto });

  await expect(dia("2026-11-06")).toContainText("Dentista");

  // Con ratón, a otro día.
  await arrastrar(page, chip("Dentista"), dia("2026-11-18"), { y: 60 });
  await expect(dia("2026-11-18")).toContainText("Dentista");
  await expect(dia("2026-11-06")).not.toContainText("Dentista");

  // Desde el panel sin fecha.
  await expect(page.locator('[data-zona="sin-fecha"]')).toContainText("Ordenar fotos");
  await arrastrar(page, chip("Ordenar fotos"), dia("2026-11-20"), { y: 60 });
  await expect(dia("2026-11-20")).toContainText("Ordenar fotos");
  await expect(page.locator('[data-zona="sin-fecha"]')).not.toContainText("Ordenar fotos");

  // Clic en un día vacío crea con esa fecha.
  await dia("2026-11-25").click({ position: { x: 40, y: 50 } });
  await page.getByRole("dialog").getByLabel("Título de la nueva tarea").fill("Comprar regalo");
  await page.getByRole("dialog").getByRole("button", { name: "Crear tarea" }).click();
  await expect(dia("2026-11-25")).toContainText("Comprar regalo");

  // Clic en una tarea abre su detalle y muestra la fecha nueva.
  await chip("Dentista").click();
  const detalle = page.getByRole("complementary", { name: "Detalle de la tarea" });
  await expect(detalle.getByLabel("Fecha", { exact: true })).toHaveValue("2026-11-18");
  await detalle.getByRole("button", { name: "Cerrar detalle" }).click();

  // Volver al panel quita la fecha.
  await arrastrar(page, chip("Comprar regalo"), page.locator('[data-zona="sin-fecha"]'));
  await expect(page.locator('[data-zona="sin-fecha"]')).toContainText("Comprar regalo");

  // Persiste tras recargar.
  await page.reload();
  await expect(dia("2026-11-18")).toContainText("Dentista");
});

test("Calendario semanal: hora, cambio de semana y ocurrencias", async ({ page }) => {
  await page.goto("/#/tareas/bandeja");
  await agregar(page, "Yoga cada viernes 18:30");
  await agregar(page, "Informe");

  await page.goto("/#/calendario/semana");
  await expect(page.getByTestId("titulo-calendario")).toHaveText(/2 nov – 8 nov 2026/);
  const hora = (d: string, h: number) => page.locator(`[data-zona="hora:|${d}|${h}"]`);
  const chip = (texto: string) => page.getByTestId("chip-tarea").filter({ hasText: texto });

  await expect(hora("2026-11-06", 18)).toContainText("Yoga");

  // Arrastrar a una hora fija la tarea en esa hora.
  await arrastrar(page, chip("Informe"), hora("2026-11-05", 10));
  await expect(hora("2026-11-05", 10)).toContainText("10:00");

  // La semana siguiente muestra la próxima ocurrencia.
  await page.getByRole("button", { name: "Periodo siguiente" }).click();
  await expect(page.getByTestId("titulo-calendario")).toHaveText(/9 nov – 15 nov 2026/);
  await expect(hora("2026-11-13", 18)).toContainText("Yoga");

  await page.getByRole("button", { name: "Hoy", exact: true }).click();
  await expect(page.getByTestId("titulo-calendario")).toHaveText(/2 nov – 8 nov 2026/);
});

test("los datos de la fase 2 sobreviven a la actualización", async ({ page }) => {
  await page.goto("/");
  // Espera a que la app termine de agregar las etiquetas iniciales antes de borrar su base.
  await expect(page.getByRole("navigation").getByRole("link", { name: /^Otro/ })).toBeVisible();
  // Reemplaza la base por una de la versión anterior antes de que la app la abra.
  await page.evaluate(async () => {
    await new Promise<void>((ok, mal) => {
      const r = indexedDB.deleteDatabase("andamia");
      r.onsuccess = () => ok();
      r.onerror = () => mal(r.error);
      r.onblocked = () => ok();
    });
  });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("sembrado")) return;
    sessionStorage.setItem("sembrado", "1");
    // Dexie guarda la versión multiplicada por 10.
    const r = indexedDB.open("andamia", 10);
    r.onupgradeneeded = () => {
      const db = r.result;
      const t = db.createObjectStore("tareas", { keyPath: "id" });
      db.createObjectStore("listas", { keyPath: "id" }).put({ id: "l1", nombre: "Antigua", color: null, carpetaId: null, incluirEnTodas: true, orden: 0 });
      db.createObjectStore("carpetas", { keyPath: "id" });
      db.createObjectStore("etiquetas", { keyPath: "nombre" });
      for (const i of ["listaId", "estado", "eliminadaEn", "vence", "orden"]) t.createIndex(i, i);
      db.transaction;
      t.put({ id: "t1", listaId: "l1", titulo: "Tarea de la fase 2", descripcion: "Notas viejas", estado: "pendiente", prioridad: "alta", vence: null, todoElDia: false, zonaHoraria: "America/Santiago", etiquetas: [], subtareas: [], orden: 0, completadaEn: null, eliminadaEn: null, creadaEn: "2026-11-01", modificadaEn: "2026-11-01" });
    };
    r.onsuccess = () => r.result.close();
  });
  await page.reload();
  await page.getByRole("navigation").getByRole("link", { name: /^Antigua/ }).click();
  await page.getByRole("button", { name: /^Tarea de la fase 2/ }).click();
  await expect(page.getByLabel("Notas", { exact: true })).toHaveValue("Notas viejas");
  await page.getByRole("button", { name: "Kanban" }).click();
  await expect(page.getByRole("region", { name: "Columna Sin sección" })).toContainText("Tarea de la fase 2");
});
