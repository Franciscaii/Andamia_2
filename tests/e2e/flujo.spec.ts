import { expect, test, type Page } from "@playwright/test";

async function crearLista(page: Page, nombre: string) {
  await page.getByRole("button", { name: "Nueva lista" }).click();
  const dialogo = page.getByRole("dialog", { name: "Nueva lista" });
  await dialogo.getByLabel("Nombre").fill(nombre);
  await dialogo.getByRole("button", { name: "Crear lista" }).click();
  await expect(page.getByRole("heading", { level: 1, name: nombre })).toBeVisible();
}

const entrada = (page: Page) => page.getByRole("textbox", { name: "Añadir tarea" });
const navegar = (page: Page, nombre: string) => page.getByRole("navigation").getByRole("link", { name: new RegExp(`^${nombre}`) }).click();

test("crear lista, añadir tarea en lenguaje natural, verla en Mañana y completarla", async ({ page }) => {
  await page.goto("/");
  await crearLista(page, "Proyecto");

  await entrada(page).fill("Enviar propuesta mañana 9am #trabajo");
  await expect(page.getByTestId("datos-reconocidos")).toContainText("Mañana 09:00");
  await expect(page.getByTestId("datos-reconocidos")).toContainText("trabajo");
  await entrada(page).press("Enter");

  const fila = page.getByTestId("fila-tarea").filter({ hasText: "Enviar propuesta" });
  await expect(fila).toContainText("Mañana 09:00");
  await expect(fila).toContainText("trabajo");
  await expect(fila).not.toContainText("#trabajo");
  await expect(fila).not.toContainText("propuesta mañana");
  await expect(page.getByRole("navigation").getByRole("link", { name: /^trabajo/ })).toBeVisible();

  // Mañana ya no está en el menú, pero su dirección sigue funcionando.
  await page.goto("/#/tareas/manana");
  await expect(page.getByRole("heading", { level: 1, name: "Mañana" })).toBeVisible();
  const enManana = page.getByTestId("fila-tarea").filter({ hasText: "Enviar propuesta" });
  await expect(enManana).toContainText("Proyecto");

  await enManana.getByRole("checkbox", { name: "Completar: Enviar propuesta" }).click();
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Enviar propuesta" })).toHaveCount(0);

  await navegar(page, "Completadas");
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Enviar propuesta" })).toBeVisible();

  // Los datos deben seguir ahí después de recargar: viven en IndexedDB.
  await page.reload();
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Enviar propuesta" })).toBeVisible();
});

test("el menú no muestra Todas, Hoy, Mañana, Bandeja de entrada ni Enfoque", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("progreso-dia")).toContainText("Avance Tareas");
  const menu = page.getByRole("navigation");
  for (const nombre of ["Todas", "Hoy", "Mañana", "Bandeja de entrada", "Enfoque"]) {
    await expect(menu.getByRole("link", { name: new RegExp(`^${nombre}`) })).toHaveCount(0);
  }
  await expect(menu.getByRole("link", { name: /^Semana/ })).toBeVisible();
});

test("semana: eventos arriba, progreso del día y tareas con dificultad e importancia", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  const entradaTarea = page.getByRole("textbox", { name: "Añadir tarea" });
  await entradaTarea.fill("Leer paper !alta #universidad");
  await entradaTarea.press("Enter");
  await entradaTarea.fill("Comprar pan");
  await entradaTarea.press("Enter");
  await expect(page.getByTestId("progreso-dia")).toContainText("0/2 (0%)");

  await page.getByRole("checkbox", { name: "Completar: Comprar pan" }).click();
  await expect(page.getByTestId("progreso-dia")).toContainText("1/2 (50%)");
  // Lo completado baja a la tarjeta "Completada", y el día queda marcado con un punto.
  await expect(page.getByTestId("tarjeta-completada")).toContainText("Comprar pan");
  await expect(page.getByRole("list", { name: "Tareas" })).not.toContainText("Comprar pan");
  await expect(page.getByRole("button", { name: /^lunes|^martes|^miércoles|^jueves|^viernes|^sábado|^domingo/, pressed: true }).getByTestId("punto-dia")).toHaveCount(1);

  const fila = page.getByTestId("fila-tarea").filter({ hasText: "Leer paper" });
  await expect(fila.getByTestId("importancia")).toHaveText("Alta");
  await expect(fila).toContainText("Universidad");
  await fila.getByRole("button", { name: /^Leer paper/ }).click();
  await page.getByRole("group", { name: "Dificultad" }).getByRole("button", { name: "Media" }).click();
  await expect(page.getByRole("checkbox", { name: "Completar: Leer paper" })).toHaveAttribute("title", "Dificultad media");
  await page.keyboard.press("Escape");

  // Un evento va arriba y no cuenta en el progreso.
  await page.getByRole("button", { name: "Eventos" }).click();
  const entradaEvento = page.getByRole("textbox", { name: "Añadir evento" });
  await entradaEvento.fill("Cumpleaños de Ana");
  await entradaEvento.press("Enter");
  await page.getByRole("button", { name: "Todos" }).click();
  await expect(page.getByTestId("fila-evento")).toContainText("Cumpleaños de Ana");
  await expect(page.getByTestId("progreso-dia")).toContainText("1/2 (50%)");

  // Otro día de la semana.
  await page.getByRole("button", { name: "Semana siguiente" }).click();
  await expect(page.getByTestId("progreso-dia")).toContainText("0/0 (0%)");
});

test("detalle, papelera y restaurar", async ({ page }) => {
  await page.goto("/#/tareas/bandeja");
  await entrada(page).fill("Revisar contrato !alta");
  await entrada(page).press("Enter");
  await page.getByRole("button", { name: /^Revisar contrato/ }).click();

  const detalle = page.getByRole("complementary", { name: "Detalle de la tarea" });
  await expect(detalle.getByLabel("Título")).toHaveValue("Revisar contrato");
  await expect(detalle.getByRole("group", { name: "Importancia" }).getByRole("button", { name: "Alta" })).toHaveAttribute("aria-pressed", "true");

  await detalle.getByLabel("Notas").fill("Pedir la versión firmada");
  await detalle.getByLabel("Nueva subtarea").fill("Leer cláusulas");
  await detalle.getByLabel("Nueva subtarea").press("Enter");
  await detalle.getByLabel("Nueva etiqueta").fill("legal");
  await detalle.getByLabel("Nueva etiqueta").press("Enter");
  await expect(page.getByTestId("fila-tarea")).toContainText("0/1");
  await expect(page.getByTestId("fila-tarea")).toContainText("legal");

  await detalle.getByRole("button", { name: "Enviar a la papelera" }).click();
  await expect(page.getByTestId("fila-tarea")).toHaveCount(0);

  await navegar(page, "Papelera");
  await page.getByRole("button", { name: "Restaurar Revisar contrato" }).click();
  await expect(page.getByTestId("fila-tarea")).toHaveCount(0);

  await page.goto("/#/tareas/bandeja");
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Revisar contrato" })).toBeVisible();
});

test("búsqueda sin acentos, filtros y tema oscuro", async ({ page }) => {
  await page.goto("/#/tareas/bandeja");
  await entrada(page).fill("Reunión con María #trabajo");
  await entrada(page).press("Enter");
  await entrada(page).fill("Comprar pan");
  await entrada(page).press("Enter");

  await navegar(page, "Buscar");
  await page.getByLabel("Buscar tareas").fill("maria");
  await expect(page.getByTestId("fila-tarea")).toHaveCount(1);
  await expect(page.locator("mark")).toHaveText("María");

  await page.getByLabel("Buscar tareas").fill("");
  await page.getByLabel("Filtrar por etiqueta").selectOption("trabajo");
  await expect(page.getByTestId("fila-tarea")).toHaveCount(1);

  await page.getByRole("button", { name: "Usar tema oscuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("reordenar con el teclado y borrar una lista con sus tareas", async ({ page }) => {
  await page.goto("/");
  await crearLista(page, "Compras");
  for (const t of ["Tercera", "Segunda", "Primera"]) {
    await entrada(page).fill(t);
    await entrada(page).press("Enter");
    await expect(page.getByTestId("fila-tarea").first()).toContainText(t);
  }
  const textos = () => page.getByTestId("fila-tarea").allInnerTexts();
  expect((await textos()).map((x) => x.trim())).toEqual(["Primera", "Segunda", "Tercera"]);

  const asa = page.getByRole("button", { name: "Mover Primera" });
  await asa.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  // dnd-kit anima el movimiento; soltar antes lo cancela.
  await page.waitForTimeout(600);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await textos()).map((x) => x.trim())).toEqual(["Segunda", "Primera", "Tercera"]);

  await page.reload();
  await expect.poll(async () => (await textos()).map((x) => x.trim())).toEqual(["Segunda", "Primera", "Tercera"]);

  await page.getByRole("link", { name: /^Compras/ }).hover();
  await page.getByRole("button", { name: "Borrar Compras" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Borrar lista" }).click();
  await expect(page.getByRole("navigation").getByRole("link", { name: /^Compras/ })).toHaveCount(0);

  await navegar(page, "Papelera");
  await expect(page.getByTestId("fila-tarea")).toHaveCount(3);
});

test("etiquetas iniciales del ámbito: vienen por defecto y se pueden crear, editar y borrar", async ({ page }) => {
  await page.goto("/");
  const menu = page.getByRole("navigation");
  for (const nombre of ["Otro", "Vinculos", "Universidad", "NecesidadBiologica", "CuidadoPersonal", "DisfrutePersonal", "VidaCotidiana", "DesarrolloProfesional"]) {
    await expect(menu.getByRole("link", { name: new RegExp(`^${nombre}`) })).toBeVisible();
  }

  await page.getByRole("button", { name: "Nueva etiqueta" }).click();
  const dialogo = page.getByRole("dialog", { name: "Nueva etiqueta" });
  await dialogo.getByLabel("Nombre").fill("Deporte");
  await dialogo.getByRole("button", { name: "Crear etiqueta" }).click();
  await expect(menu.getByRole("link", { name: /^Deporte/ })).toBeVisible();

  // Renombrar mantiene la etiqueta en las tareas.
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  await page.getByRole("textbox", { name: "Añadir tarea" }).fill("Correr #deporte");
  await page.getByRole("textbox", { name: "Añadir tarea" }).press("Enter");
  await menu.getByRole("link", { name: /^Deporte/ }).hover();
  await page.getByRole("button", { name: "Editar etiqueta Deporte" }).click();
  const edicion = page.getByRole("dialog", { name: "Editar etiqueta" });
  await edicion.getByLabel("Nombre").fill("Universidad");
  await edicion.getByRole("button", { name: "Guardar" }).click();
  await expect(edicion.getByRole("alert")).toContainText("Ya existe");
  await edicion.getByLabel("Nombre").fill("Ejercicio");
  await edicion.getByRole("button", { name: "Guardar" }).click();
  await expect(menu.getByRole("link", { name: /^Ejercicio/ })).toBeVisible();
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Correr" })).toContainText("Ejercicio");

  await menu.getByRole("link", { name: /^Otro/ }).hover();
  await page.getByRole("button", { name: "Borrar etiqueta Otro" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Borrar etiqueta" }).click();
  await expect(menu.getByRole("link", { name: /^Otro/ })).toHaveCount(0);
  // Al recargar no vuelve.
  await page.reload();
  await expect(menu.getByRole("link", { name: /^Universidad/ })).toBeVisible();
  await expect(menu.getByRole("link", { name: /^Otro/ })).toHaveCount(0);
});
