import { expect, test } from "@playwright/test";

test("cumple los requisitos de instalación", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifiesto = await (await request.get(href as string)).json();
  expect(manifiesto).toMatchObject({ name: "Andamia", short_name: "Andamia", display: "standalone", start_url: "/", lang: "es" });
  expect(manifiesto.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(manifiesto.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  for (const icono of manifiesto.icons) {
    const r = await request.get(icono.src);
    expect(r.ok(), icono.src).toBe(true);
    expect(r.headers()["content-type"]).toContain("image/png");
  }
  const activo = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    return r.active?.state;
  });
  expect(["activating", "activated"]).toContain(activo);
});

test("abre, guarda y conserva datos sin conexión", async ({ page, context }) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto("/#/tareas/bandeja");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  const entrada = page.getByRole("textbox", { name: "Añadir tarea" });
  await entrada.fill("Creada sin conexión");
  await entrada.press("Enter");
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Creada sin conexión" })).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Creada sin conexión" })).toBeVisible();

  // Una ruta de la app también abre sin conexión.
  await page.goto("/#/calendario/mes");
  await expect(page.getByTestId("titulo-calendario")).toBeVisible();

  await context.setOffline(false);
  expect(errores).toEqual([]);
});
