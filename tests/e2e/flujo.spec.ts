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

  await navegar(page, "Mañana");
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

test("detalle, papelera y restaurar", async ({ page }) => {
  await page.goto("/#/tareas/bandeja");
  await entrada(page).fill("Revisar contrato !alta");
  await entrada(page).press("Enter");
  await page.getByRole("button", { name: /^Revisar contrato/ }).click();

  const detalle = page.getByRole("complementary", { name: "Detalle de la tarea" });
  await expect(detalle.getByLabel("Título")).toHaveValue("Revisar contrato");
  await expect(detalle.getByRole("button", { name: "Alta" })).toHaveAttribute("aria-pressed", "true");

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

  await navegar(page, "Bandeja");
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
  await page.waitForTimeout(250);
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
