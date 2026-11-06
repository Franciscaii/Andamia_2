import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

const CLAVE = "clave de prueba larga";
const correoNuevo = () => `prueba-${randomUUID().slice(0, 8)}@ejemplo.cl`;
const ESPERA_SYNC = { timeout: 30_000 };

const entrada = (page: Page) => page.getByRole("textbox", { name: "Añadir tarea" });
const fila = (page: Page, texto: string) => page.getByTestId("fila-tarea").filter({ hasText: texto });

async function agregar(page: Page, texto: string) {
  await entrada(page).fill(texto);
  await entrada(page).press("Enter");
  await expect(entrada(page)).toHaveValue("");
}

async function acceder(page: Page, correo: string, modo: "entrar" | "registrar") {
  await page.goto("/#/ajustes");
  if (modo === "registrar") await page.getByRole("button", { name: "Crear una cuenta nueva" }).click();
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña", { exact: true }).fill(CLAVE);
  await page.getByRole("button", { name: modo === "registrar" ? "Crear cuenta" : "Iniciar sesión" }).click();
  await expect(page.getByTestId("correo-cuenta")).toHaveText(correo, ESPERA_SYNC);
}

async function dispositivo(browser: Browser): Promise<{ contexto: BrowserContext; page: Page }> {
  const contexto = await browser.newContext({ locale: "es-CL", timezoneId: "America/Santiago", baseURL: "http://127.0.0.1:5198" });
  return { contexto, page: await contexto.newPage() };
}

test("crear cuenta, sincronizar entre dos dispositivos en ambos sentidos", async ({ browser }) => {
  const correo = correoNuevo();
  const a = await dispositivo(browser);
  const b = await dispositivo(browser);

  await acceder(a.page, correo, "registrar");
  await a.page.goto("/#/tareas/bandeja");
  await agregar(a.page, "Desde el computador !alta #casa");

  await acceder(b.page, correo, "entrar");
  await b.page.goto("/#/tareas/bandeja");
  await expect(fila(b.page, "Desde el computador")).toBeVisible(ESPERA_SYNC);
  await expect(fila(b.page, "Desde el computador")).toContainText("casa");

  // Y de vuelta, en vivo.
  await agregar(b.page, "Desde el teléfono");
  await expect(fila(a.page, "Desde el teléfono")).toBeVisible(ESPERA_SYNC);

  // Editar y completar también viaja.
  await fila(b.page, "Desde el computador").getByRole("checkbox").click();
  await expect(fila(a.page, "Desde el computador")).toBeVisible(ESPERA_SYNC);
  await a.page.goto("/#/tareas/completadas");
  await expect(fila(a.page, "Desde el computador")).toBeVisible(ESPERA_SYNC);

  // Listas, hábitos y demás colecciones.
  await a.page.goto("/#/habitos");
  await a.page.getByRole("button", { name: "Nuevo hábito" }).click();
  await a.page.getByLabel("Nombre del hábito").fill("Leer");
  await a.page.getByRole("button", { name: "Crear hábito" }).click();
  await b.page.goto("/#/habitos");
  await expect(b.page.getByTestId("habito").filter({ hasText: "Leer" })).toBeVisible(ESPERA_SYNC);

  await a.contexto.close();
  await b.contexto.close();
});

test("sin conexión sigue funcionando y sincroniza al volver", async ({ browser }) => {
  const correo = correoNuevo();
  const a = await dispositivo(browser);
  const b = await dispositivo(browser);
  await acceder(a.page, correo, "registrar");
  await acceder(b.page, correo, "entrar");
  await a.page.goto("/#/tareas/bandeja");
  await b.page.goto("/#/tareas/bandeja");
  await agregar(a.page, "Base compartida");
  await expect(fila(b.page, "Base compartida")).toBeVisible(ESPERA_SYNC);

  await a.contexto.setOffline(true);
  await agregar(a.page, "Escrita sin conexión");
  await expect(fila(a.page, "Escrita sin conexión")).toBeVisible();
  await expect(a.page.getByTestId("estado-sync")).toHaveText("Sin conexión");

  // Lo escrito sin conexión sobrevive a recargar.
  await a.page.reload().catch(() => undefined);
  await a.page.waitForTimeout(500);
  await expect(fila(b.page, "Escrita sin conexión")).toHaveCount(0);

  await a.contexto.setOffline(false);
  if (!(await entrada(a.page).isVisible().catch(() => false))) await a.page.goto("/#/tareas/bandeja");
  await expect(fila(a.page, "Escrita sin conexión")).toBeVisible(ESPERA_SYNC);
  await expect(fila(b.page, "Escrita sin conexión")).toBeVisible(ESPERA_SYNC);

  await a.contexto.close();
  await b.contexto.close();
});

test("migración única con confirmación, y cerrar sesión oculta los datos", async ({ browser }) => {
  const a = await dispositivo(browser);
  const correo = correoNuevo();
  await a.page.goto("/#/tareas/bandeja");
  await agregar(a.page, "Tarea sin cuenta");

  await acceder(a.page, correo, "registrar");
  const dialogo = a.page.getByRole("dialog", { name: "¿Copiar tus datos a esta cuenta?" });
  await expect(dialogo).toContainText("1 tarea");
  await dialogo.getByRole("button", { name: "Copiar a mi cuenta" }).click();
  await expect(dialogo).toHaveCount(0);

  await a.page.goto("/#/tareas/bandeja");
  await expect(fila(a.page, "Tarea sin cuenta")).toBeVisible();
  await agregar(a.page, "Solo de la cuenta");

  // Otro dispositivo recibe lo migrado.
  const b = await dispositivo(browser);
  await acceder(b.page, correo, "entrar");
  await b.page.goto("/#/tareas/bandeja");
  await expect(fila(b.page, "Tarea sin cuenta")).toBeVisible(ESPERA_SYNC);
  await expect(fila(b.page, "Solo de la cuenta")).toBeVisible(ESPERA_SYNC);

  // Cerrar sesión deja de mostrar la cuenta y vuelve a lo local.
  await a.page.goto("/#/ajustes");
  await a.page.getByRole("button", { name: "Cerrar sesión" }).click();
  await a.page.getByRole("dialog").getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(a.page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  await a.page.goto("/#/tareas/bandeja");
  await expect(fila(a.page, "Solo de la cuenta")).toHaveCount(0);
  await expect(fila(a.page, "Tarea sin cuenta")).toBeVisible();

  // Al volver a entrar, no pregunta otra vez y recupera la cuenta.
  await acceder(a.page, correo, "entrar");
  await expect(dialogo).toHaveCount(0);
  await a.page.goto("/#/tareas/bandeja");
  await expect(fila(a.page, "Solo de la cuenta")).toBeVisible(ESPERA_SYNC);
  await expect(fila(a.page, "Tarea sin cuenta")).toHaveCount(1);

  await a.contexto.close();
  await b.contexto.close();
});

test("con los recordatorios apagados no se muestran ni se crean", async ({ page }) => {
  await page.goto("/#/tareas/bandeja");
  await agregar(page, "Llamar mañana 10:00");
  await page.getByRole("button", { name: /^Llamar/ }).click();
  const detalle = page.getByRole("complementary", { name: "Detalle de la tarea" });
  await expect(detalle.getByLabel("Fecha", { exact: true })).not.toHaveValue("");
  await expect(detalle.getByText("Recordatorios")).toHaveCount(0);
  await expect(detalle.getByLabel("Añadir recordatorio")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Activar avisos del navegador" })).toHaveCount(0);
  await page.goto("/#/ajustes");
  await expect(page.getByRole("region", { name: "Avisos" })).toHaveCount(0);
  await page.goto("/#/habitos");
  await page.getByRole("button", { name: "Nuevo hábito" }).click();
  await expect(page.getByLabel("Hora del recordatorio")).toHaveCount(0);
});

test("dos cuentas no comparten datos, y la contraseña incorrecta se informa", async ({ browser }) => {
  const a = await dispositivo(browser);
  const b = await dispositivo(browser);
  await acceder(a.page, correoNuevo(), "registrar");
  await a.page.goto("/#/tareas/bandeja");
  await agregar(a.page, "Privada de A");

  await acceder(b.page, correoNuevo(), "registrar");
  await b.page.goto("/#/tareas/bandeja");
  await b.page.waitForTimeout(1500);
  await expect(fila(b.page, "Privada de A")).toHaveCount(0);

  const c = await dispositivo(browser);
  await c.page.goto("/#/ajustes");
  await c.page.getByLabel("Correo").fill(correoNuevo());
  await c.page.getByLabel("Contraseña", { exact: true }).fill("incorrecta");
  await c.page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(c.page.getByRole("alert")).toContainText("incorrectos");

  await a.contexto.close();
  await b.contexto.close();
  await c.contexto.close();
});

test("borrar la cuenta elimina el acceso y sus datos", async ({ browser }) => {
  const correo = correoNuevo();
  const a = await dispositivo(browser);
  await acceder(a.page, correo, "registrar");
  await a.page.goto("/#/tareas/bandeja");
  await agregar(a.page, "Se va a borrar");
  await a.page.goto("/#/ajustes");
  await a.page.getByRole("button", { name: "Borrar mi cuenta" }).click();
  await a.page.getByLabel("Confirmar contraseña").fill(CLAVE);
  await a.page.getByRole("button", { name: "Borrar para siempre" }).click();
  await expect(a.page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible(ESPERA_SYNC);
  await a.page.goto("/#/tareas/bandeja");
  await expect(fila(a.page, "Se va a borrar")).toHaveCount(0);

  await a.page.goto("/#/ajustes");
  await a.page.getByLabel("Correo").fill(correo);
  await a.page.getByLabel("Contraseña", { exact: true }).fill(CLAVE);
  await a.page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(a.page.getByRole("alert")).toContainText("incorrectos");
  await a.contexto.close();
});
