import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const entrada = (page: Page) => page.getByRole("textbox", { name: "Añadir tarea" });

async function agregar(page: Page, texto: string) {
  await entrada(page).fill(texto);
  await entrada(page).press("Enter");
  await expect(entrada(page)).toHaveValue("");
}

async function descargar(page: Page) {
  const espera = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar copia" }).click();
  const d = await espera;
  return { nombre: d.suggestedFilename(), ruta: (await d.path()) as string };
}

test("sin Firebase configurado todo funciona y lo explica", async ({ page }) => {
  await page.goto("/#/ajustes");
  await expect(page.getByTestId("sin-firebase")).toBeVisible();
  await page.goto("/#/tareas/bandeja");
  await agregar(page, "Funciona sin cuenta");
  await page.reload();
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Funciona sin cuenta" })).toBeVisible();
});

test("descargar y restaurar una copia, con confirmación", async ({ page }) => {
  await page.goto("/#/tareas/bandeja");
  await agregar(page, "Tarea original !alta #casa");

  await page.goto("/#/ajustes");
  const { nombre, ruta } = await descargar(page);
  expect(nombre).toMatch(/^andamia-copia-\d{4}-\d{2}-\d{2}\.json$/);
  const copia = JSON.parse(readFileSync(ruta, "utf8"));
  expect(copia.app).toBe("andamia");
  expect(copia.datos.tareas).toHaveLength(1);

  await page.goto("/#/tareas/bandeja");
  await page.getByTestId("fila-tarea").filter({ hasText: "Tarea original" }).getByRole("button", { name: /^Tarea original/ }).click();
  await page.getByRole("button", { name: "Enviar a la papelera" }).click();
  await agregar(page, "Tarea posterior");

  await page.goto("/#/ajustes");
  await page.getByLabel("Archivo de copia").setInputFiles(ruta);
  const dialogo = page.getByRole("dialog", { name: "¿Reemplazar todos tus datos?" });
  await expect(dialogo).toContainText("1 tarea");
  await expect(dialogo).not.toContainText("1 tareas");
  await expect(dialogo).toContainText("1 etiqueta");

  // Cancelar no cambia nada.
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await page.goto("/#/tareas/bandeja");
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Tarea posterior" })).toBeVisible();

  await page.goto("/#/ajustes");
  await page.getByLabel("Archivo de copia").setInputFiles(ruta);
  await page.getByRole("dialog").getByRole("button", { name: "Reemplazar mis datos" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Copia restaurada" })).toBeVisible();

  await page.goto("/#/tareas/bandeja");
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Tarea original" })).toBeVisible();
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Tarea posterior" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Tarea original" })).toBeVisible();
});

test("un archivo dañado no toca los datos", async ({ page }) => {
  await page.goto("/#/tareas/bandeja");
  await agregar(page, "Sigo aquí");
  await page.goto("/#/ajustes");
  await page.getByLabel("Archivo de copia").setInputFiles({ name: "mala.json", mimeType: "application/json", buffer: Buffer.from('{"app":"otra"}') });
  await expect(page.getByRole("alert")).toContainText("No se restauró nada");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/#/tareas/bandeja");
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Sigo aquí" })).toBeVisible();
});
