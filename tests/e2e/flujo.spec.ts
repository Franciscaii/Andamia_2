import { expect, test, type Page } from "@playwright/test";

/** Hoy en la zona horaria del navegador de las pruebas (America/Santiago), no la del servidor. */
const hoyEnSantiago = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Santiago" });

async function crearLista(page: Page, nombre: string) {
  await page.getByRole("button", { name: "Nueva lista" }).click();
  const dialogo = page.getByRole("dialog", { name: "Nueva lista" });
  await dialogo.getByLabel("Nombre").fill(nombre);
  await dialogo.getByRole("button", { name: "Crear lista" }).click();
  await expect(page.getByRole("heading", { level: 1, name: nombre })).toBeVisible();
}

const entrada = (page: Page) => page.getByRole("textbox", { name: "Añadir tarea" });
/** En la semana: + → Tarea o Evento, llenar la ventana y crear. */
async function crearEnSemana(page: Page, tipo: "Tarea" | "Evento", texto: string, opciones: { importancia?: string; dificultad?: string; indole?: string } = {}) {
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("menuitem", { name: tipo }).click();
  const dialogo = page.getByRole("dialog");
  const campo = dialogo.getByRole("textbox", { name: tipo === "Tarea" ? "Añadir tarea" : "Añadir evento" });
  await campo.fill(texto);
  if (opciones.importancia) await dialogo.getByRole("group", { name: "Importancia" }).getByRole("button", { name: opciones.importancia }).click();
  if (opciones.dificultad) await dialogo.getByRole("group", { name: "Dificultad" }).getByRole("button", { name: opciones.dificultad }).click();
  if (opciones.indole) await dialogo.getByRole("group", { name: "Índole" }).getByRole("button", { name: opciones.indole, exact: true }).click();
  await campo.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

const irAHash = (page: Page, hash: string) => page.evaluate((h) => { location.hash = h; }, hash);
const navegar = (page: Page, nombre: string) => nombre === "Papelera" ? irAHash(page, "#/tareas/papelera") : page.getByRole("navigation").getByRole("link", { name: new RegExp(`^${nombre}`) }).click();

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
  await page.getByRole("button", { name: "Ver etiquetas" }).click();
  await expect(page.getByRole("navigation").getByText("trabajo", { exact: true })).toBeVisible();

  // Mañana ya no está en el menú, pero su dirección sigue funcionando.
  await page.goto("/#/tareas/manana");
  await expect(page.getByRole("heading", { level: 1, name: "Mañana" })).toBeVisible();
  const enManana = page.getByTestId("fila-tarea").filter({ hasText: "Enviar propuesta" });
  await expect(enManana).toContainText("Proyecto");

  await enManana.getByRole("checkbox", { name: "Completar: Enviar propuesta" }).click();
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Enviar propuesta" })).toHaveCount(0);

  await page.goto("/#/tareas/completadas");
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Enviar propuesta" })).toBeVisible();

  // Los datos deben seguir ahí después de recargar: viven en IndexedDB.
  await page.reload();
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Enviar propuesta" })).toBeVisible();
});

test("el menú no muestra Todas, Hoy, Mañana, Bandeja de entrada ni Enfoque", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tareas hoy" })).toBeVisible();
  await expect(page.getByTestId("progreso-dia")).toBeVisible();
  // Ya no hay campo para añadir tareas a la vista: se usa el +.
  await expect(page.getByRole("textbox", { name: "Añadir tarea" })).toHaveCount(0);
  const menu = page.getByRole("navigation");
  for (const nombre of ["Todas", "Hoy", "Mañana", "Bandeja de entrada", "Enfoque"]) {
    await expect(menu.getByRole("link", { name: new RegExp(`^${nombre}`) })).toHaveCount(0);
  }
  await expect(menu.getByRole("link", { name: /^Semana/ })).toBeVisible();
});

test("semana: eventos arriba, progreso del día y tareas con dificultad e importancia", async ({ page }) => {
  await page.goto("/");
  await crearEnSemana(page, "Tarea", "Leer paper", { importancia: "Alta", indole: "Universidad" });
  await crearEnSemana(page, "Tarea", "Comprar pan");
  await expect(page.getByTestId("progreso-dia")).toContainText("0/2 (0%)");

  await page.getByRole("checkbox", { name: "Completar: Comprar pan" }).click();
  await expect(page.getByTestId("progreso-dia")).toContainText("1/2 (50%)");
  // Lo completado baja a la tarjeta "Completada", y el día queda marcado con un punto.
  await expect(page.getByTestId("tarjeta-completada")).toContainText("Comprar pan");
  await expect(page.getByRole("list", { name: "Tareas" })).not.toContainText("Comprar pan");
  await expect(page.getByRole("button", { name: /^lunes|^martes|^miércoles|^jueves|^viernes|^sábado|^domingo/, pressed: true }).getByTestId("punto-dia")).toHaveCount(1);

  const fila = page.getByTestId("fila-tarea").filter({ hasText: "Leer paper" });
  // La casilla lleva el color de la importancia; la insignia de abajo es la dificultad.
  await expect(page.getByRole("checkbox", { name: "Completar: Leer paper" })).toHaveAttribute("title", "Importancia alta");
  await expect(fila.getByTestId("dificultad")).toHaveCount(0);
  await expect(fila).toContainText("Universidad");
  await fila.getByRole("button", { name: /^Leer paper/ }).click();
  const detalle = page.getByRole("complementary", { name: "Detalle de la tarea" });
  // El detalle no muestra hora, repetir, tipo ni enfocar.
  for (const oculto of ["Hora", "Repetir"]) await expect(detalle.getByLabel(oculto, { exact: true })).toHaveCount(0);
  await expect(detalle.getByRole("button", { name: "Enfocar" })).toHaveCount(0);
  await expect(detalle.getByRole("button", { name: "Evento" })).toHaveCount(0);
  await detalle.getByRole("group", { name: "Dificultad" }).getByRole("button", { name: "Media" }).click();
  await expect(fila.getByTestId("dificultad")).toHaveText("Media");
  await page.keyboard.press("Escape");

  // Un evento va arriba y no cuenta en el progreso.
  await crearEnSemana(page, "Evento", "Cumpleaños de Ana");
  await expect(page.getByTestId("fila-evento")).toContainText("Cumpleaños de Ana");
  await expect(page.getByTestId("progreso-dia")).toContainText("1/2 (50%)");

  // Otro día de la semana.
  await page.getByRole("button", { name: "Semana siguiente" }).click();
  await expect(page.getByTestId("progreso-dia")).toContainText("0/0 (0%)");
  await expect(page.getByRole("heading", { name: "Tareas del día" })).toBeVisible();

  // Desde el + también se crea un hábito.
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("menuitem", { name: "Hábito" }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo hábito" })).toBeVisible();
});

/** Pincha el interruptor de un hábito en una fracción de su largo (0 = izquierda, 1 = derecha). */
/** En el computador los hábitos de la Semana van en un desplegable: lo abre si está cerrado. */
async function abrirHabitos(page: Page) {
  const botones = page.locator("button[aria-expanded][aria-label='Hábitos']");
  await expect(botones.first()).toBeVisible();
  await expect(async () => {
    for (let i = 0; i < (await botones.count()); i++) {
      const b = botones.nth(i);
      if ((await b.getAttribute("aria-expanded", { timeout: 500 })) === "false") await b.click();
    }
    for (let i = 0; i < (await botones.count()); i++) await expect(botones.nth(i)).toHaveAttribute("aria-expanded", "true", { timeout: 500 });
  }).toPass({ timeout: 5000 });
}

async function deslizarHabito(page: Page, interruptor: import("@playwright/test").Locator, hasta: number) {
  // El círculo termina de moverse antes del siguiente toque.
  await page.waitForTimeout(250);
  const riel = (await interruptor.boundingBox())!;
  await page.mouse.click(riel.x + riel.width * hasta, riel.y + riel.height / 2);
}

test("semana: los hábitos del día se marcan con su interruptor y tienen su propio filtro", async ({ page }) => {
  await page.goto("/#/habitos");
  await page.getByRole("button", { name: "Nuevo hábito" }).click();
  await page.getByLabel("Nombre del hábito").fill("Estirar");
  await page.getByRole("button", { name: "Crear hábito" }).click();
  await expect(page.getByTestId("habito")).toHaveCount(1);

  await page.goto("/#/semana");
  await abrirHabitos(page);
  const marca = page.getByRole("switch", { name: "Hábito Estirar" }).first();
  await expect(marca).toHaveAttribute("aria-checked", "false");
  // Pinchar la parte vacía de la izquierda no lo marca; pinchar a la derecha sí.
  await deslizarHabito(page, marca, 0.4);
  await expect(marca).toHaveAttribute("aria-checked", "false");
  await deslizarHabito(page, marca, 0.97);
  await expect(marca).toHaveAttribute("aria-checked", "true");

  // En las columnas de 7 días la barra cabe en su fila y el nombre se sigue viendo.
  await crearEnSemana(page, "Tarea", "Tarea para ensanchar el día");
  await page.getByRole("group", { name: "Ver" }).getByRole("button", { name: "7 Días" }).click();
  await abrirHabitos(page);
  const fila = page.getByTestId("habito-semana").filter({ hasText: "Estirar" }).last();
  const cajaFila = (await fila.boundingBox())!;
  const cajaBarra = (await fila.getByRole("switch").boundingBox())!;
  const cajaNombre = (await fila.getByText("Estirar").boundingBox())!;
  expect(cajaBarra.x + cajaBarra.width).toBeLessThanOrEqual(cajaFila.x + cajaFila.width);
  expect(cajaNombre.width).toBeGreaterThan(30);
  await page.getByRole("group", { name: "Ver" }).getByRole("button", { name: "Día", exact: true }).click();
  await abrirHabitos(page);

  // Con "Hábitos" solo quedan los hábitos; con "Tareas" no se ven.
  const mostrar = page.getByRole("group", { name: "Mostrar" });
  await mostrar.getByRole("button", { name: "Hábitos" }).click();
  await abrirHabitos(page);
  await expect(page.getByTestId("habito-semana").first()).toBeVisible();
  await expect(page.getByTestId("tarjeta-tareas")).toHaveCount(0);
  await mostrar.getByRole("button", { name: "Tareas" }).click();
  await expect(page.getByTestId("habito-semana")).toHaveCount(0);

  // La marca queda guardada.
  await page.reload();
  await mostrar.getByRole("button", { name: "Todos" }).click();
  await abrirHabitos(page);
  await expect(marca).toHaveAttribute("aria-checked", "true");

  // En el Calendario, "Hábitos" muestra solo los hábitos cumplidos, como barritas de su color.
  await page.getByRole("navigation").getByRole("link", { name: "Calendario" }).click();
  const hoy = page.locator(`[data-zona="dia:${hoyEnSantiago()}"]`);
  await page.getByRole("group", { name: "Mostrar" }).getByRole("button", { name: "Hábitos" }).click();
  await expect(hoy.getByTestId("barra-habito")).toHaveText("Estirar");
  await expect(page.getByTestId("barra-habito")).toHaveCount(1);
  await page.getByRole("group", { name: "Mostrar" }).getByRole("button", { name: "Tareas" }).click();
  await expect(page.getByTestId("barra-habito")).toHaveCount(0);

  // Al quitar la marca en Semana, deja de salir en el mes.
  await page.getByRole("navigation").getByRole("link", { name: "Semana" }).click();
  await abrirHabitos(page);
  await deslizarHabito(page, marca, 0.03);
  await expect(marca).toHaveAttribute("aria-checked", "false");
  await page.getByRole("navigation").getByRole("link", { name: "Calendario" }).click();
  await page.getByRole("group", { name: "Mostrar" }).getByRole("button", { name: "Hábitos" }).click();
  await expect(hoy).toBeVisible();
  await expect(page.getByTestId("barra-habito")).toHaveCount(0);
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
  await detalle.getByRole("group", { name: "Índole" }).getByRole("button", { name: "Vinculos" }).click();
  await expect(page.getByTestId("fila-tarea")).toContainText("0/1");
  await expect(page.getByTestId("fila-tarea")).toContainText("Vinculos");

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

  // El buscador ya no está en el menú; su dirección sigue funcionando.
  await expect(page.getByRole("navigation").getByRole("link", { name: /^Buscar/ })).toHaveCount(0);
  await page.goto("/#/buscar");
  await page.getByLabel("Buscar tareas").fill("maria");
  await expect(page.getByTestId("fila-tarea")).toHaveCount(1);
  await expect(page.locator("mark")).toHaveText("María");

  await page.getByLabel("Buscar tareas").fill("");
  await page.getByLabel("Filtrar por etiqueta").selectOption("trabajo");
  await expect(page.getByTestId("fila-tarea")).toHaveCount(1);

  // El tema se elige desde Configuración.
  await page.getByRole("navigation", { name: "Navegación" }).getByRole("link", { name: "Configuración" }).click();
  await page.getByRole("link", { name: "Tema" }).click();
  await expect(page).toHaveURL(/#\/tema$/);
  await page.getByRole("radiogroup", { name: "Tema de la app" }).getByRole("radio", { name: "Noche", exact: true }).click();
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
  const menu = page.getByRole("navigation", { name: "Navegación" });
  // En el menú parten plegadas: la flecha las despliega solo para verlas (sin enlace, sin números, sin lápiz ni +).
  await expect(menu.getByText("Otro", { exact: true })).toHaveCount(0);
  await menu.getByRole("button", { name: "Ver etiquetas" }).click();
  for (const nombre of ["Otro", "Vinculos", "Universidad", "NecesidadBiologica", "CuidadoPersonal", "DisfrutePersonal", "VidaCotidiana", "DesarrolloProfesional"]) {
    await expect(menu.getByText(nombre, { exact: true })).toBeVisible();
  }
  await expect(menu.getByRole("link", { name: /^Otro/ })).toHaveCount(0);
  await menu.getByText("Otro", { exact: true }).hover();
  await expect(page.getByRole("button", { name: "Editar etiqueta Otro" })).toHaveCount(0);
  await expect(menu.getByRole("button", { name: "Nueva etiqueta" })).toHaveCount(0);

  await crearEnSemana(page, "Tarea", "Correr", { indole: "Otro" });

  // "Etiquetas" abre su vista: tarjetas de a dos, donde sí se crean, editan y eliminan.
  await menu.getByRole("link", { name: "Etiquetas", exact: true }).click();
  await expect(page).toHaveURL(/#\/etiquetas$/);
  const tarjetas = page.getByTestId("tarjeta-etiqueta");
  await expect(tarjetas).toHaveCount(8);
  const c0 = (await tarjetas.nth(0).boundingBox())!;
  const c1 = (await tarjetas.nth(1).boundingBox())!;
  expect(Math.abs(c0.y - c1.y)).toBeLessThan(2);
  expect(c1.x).toBeGreaterThan(c0.x + c0.width - 1);

  await page.getByRole("button", { name: "Nueva etiqueta" }).click();
  const dialogo = page.getByRole("dialog", { name: "Nueva etiqueta" });
  await dialogo.getByLabel("Nombre").fill("Deporte");
  await dialogo.getByRole("button", { name: "Crear etiqueta" }).click();
  await expect(tarjetas).toHaveCount(9);
  await expect(menu.getByText("Deporte", { exact: true })).toBeVisible();

  // Renombrar mantiene la etiqueta en las tareas.
  await expect(page.getByRole("link", { name: "Ver tareas" })).toHaveCount(0);
  await page.getByRole("button", { name: "Editar etiqueta Otro" }).click();
  const edicion = page.getByRole("dialog", { name: "Editar etiqueta" });
  await edicion.getByLabel("Nombre").fill("Universidad");
  await edicion.getByRole("button", { name: "Guardar" }).click();
  await expect(edicion.getByRole("alert")).toContainText("Ya existe");
  await edicion.getByLabel("Nombre").fill("Ejercicio");
  await edicion.getByRole("button", { name: "Guardar" }).click();
  await expect(menu.getByText("Ejercicio", { exact: true })).toBeVisible();
  // El nombre nuevo se ve también en la tarea.
  await page.goto("/#/tareas/semana");
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Correr" })).toContainText("Ejercicio");
  await menu.getByRole("link", { name: "Etiquetas", exact: true }).click();

  // Se elimina desde su tarjeta, o desde Editar, que trae Eliminar, Cancelar y Guardar.
  await menu.getByRole("link", { name: "Etiquetas", exact: true }).click();
  await page.getByRole("button", { name: "Editar etiqueta Deporte" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Cancelar" })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Guardar" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Borrar etiqueta" }).click();
  await expect(menu.getByText("Deporte", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Eliminar etiqueta Vinculos" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Borrar etiqueta" }).click();
  await expect(tarjetas).toHaveCount(7);
  // Al recargar no vuelven, y el menú recuerda que las etiquetas quedaron a la vista.
  await page.reload();
  await expect(menu.getByText("Universidad", { exact: true })).toBeVisible();
  await expect(menu.getByText("Vinculos", { exact: true })).toHaveCount(0);
});

test("widget Semana del PC: un solo + junto a los filtros que añade en el día marcado", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 600 });
  await page.goto("/?widget=semana");
  const dias = page.getByTestId("dia-semana");
  await expect(dias).toHaveCount(7);
  // Un solo +, arriba; parte marcado el día de hoy.
  await expect(page.locator("[data-nueva-tarea]")).toHaveCount(1);
  await expect(page.locator("[data-testid=dia-semana][data-elegida]")).toHaveCount(1);
  // Se marca otro día tocando su tarjeta, y queda resaltado.
  const hoy = await dias.evaluateAll((els) => els.findIndex((e) => e.hasAttribute("data-elegida")));
  const otro = hoy === 6 ? 5 : hoy + 1;
  await dias.nth(otro).click({ position: { x: 20, y: 200 } });
  await expect(dias.nth(otro)).toHaveAttribute("data-elegida", "");
  await expect(dias.nth(hoy)).not.toHaveAttribute("data-elegida", "");
  await page.getByRole("group", { name: "Mostrar" }).getByRole("button", { name: "Tareas" }).click();
  await page.locator("[data-nueva-tarea]").click();
  const dialogo = page.getByRole("dialog");
  const campo = dialogo.getByRole("textbox", { name: "Añadir tarea" });
  await campo.fill("En el día marcado");
  await campo.press("Enter");
  await expect(dias.nth(otro)).toContainText("En el día marcado");
});

test("celular: el menú va abajo con 8 iconos y la tuerca abre la pantalla Configuración", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Abrir menú" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Navegación" })).toBeHidden();
  const barra = page.getByTestId("menu-abajo");
  await expect(barra.locator(":scope > a")).toHaveCount(8);
  await expect(barra.locator(":scope > a")).toHaveText(["", "", "", "", "", "", "", ""]);
  const nombres = await barra.locator(":scope > a").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(nombres).toEqual(["Configuración", "Etiquetas", "Semana", "Calendario", "Hábitos", "Matriz", "Estadística Tareas", "Estadística Hábitos"]);
  const caja = (await barra.boundingBox())!;
  expect(caja.y + caja.height).toBeGreaterThan(779);
  await expect(barra.getByRole("link", { name: "Semana" })).toHaveAttribute("aria-current", "page");
  // El título del mes lleva el año y la cabecera no se desborda.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^[A-Z][a-z]{2} \d{4}$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  for (const [nombre, direccion] of [["Calendario", /#\/calendario/], ["Matriz", /#\/matriz/], ["Estadística Tareas", /#\/estadisticas\/tareas/], ["Hábitos", /#\/habitos/], ["Estadística Hábitos", /#\/estadisticas\/habitos/], ["Etiquetas", /#\/etiquetas$/]] as const) {
    await barra.getByRole("link", { name: nombre, exact: true }).click();
    await expect(page).toHaveURL(direccion);
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde, `desborde en ${nombre}`).toBeLessThanOrEqual(0);
  }
  // Etiquetas: una por fila, con Editar y Eliminar a la vista.
  const tarjetas = page.getByTestId("tarjeta-etiqueta");
  await expect(tarjetas).toHaveCount(8);
  await expect(page.getByRole("heading", { name: "Etiquetas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Configuración" })).toHaveCount(0);
  const a = (await tarjetas.nth(0).boundingBox())!;
  const b = (await tarjetas.nth(1).boundingBox())!;
  expect(b.y).toBeGreaterThan(a.y + a.height - 1);
  await expect(tarjetas.nth(0).getByRole("button", { name: /^Editar etiqueta/ })).toBeVisible();
  await expect(tarjetas.nth(0).getByRole("button", { name: /^Eliminar etiqueta/ })).toBeVisible();
  // La tuerca muestra la pantalla Configuración.
  await barra.getByRole("link", { name: "Configuración" }).click();
  await expect(page).toHaveURL(/#\/configuracion$/);
  await expect(page.getByRole("heading", { name: "Configuración" })).toBeVisible();
  const filas = page.locator("main ul a");
  await expect(filas).toHaveText(["Tema", "Cuenta y ajustes", "Papelera"]);
  await filas.filter({ hasText: "Tema" }).click();
  await expect(page).toHaveURL(/#\/tema$/);
});

test("estadística de tareas: por etiqueta, circular y en el tiempo; tocar una etiqueta atenúa las demás", async ({ page }) => {
  await page.goto("/");
  await crearEnSemana(page, "Tarea", "Leer paper", { indole: "Universidad" });
  await crearEnSemana(page, "Tarea", "Cocinar", { indole: "VidaCotidiana" });
  await crearEnSemana(page, "Tarea", "Lavar ropa", { indole: "VidaCotidiana" });
  for (const t of ["Leer paper", "Cocinar", "Lavar ropa"]) await page.getByRole("checkbox", { name: `Completar: ${t}` }).click();

  await page.getByRole("navigation").getByRole("link", { name: "Estadística Tareas" }).click();
  await expect(page.getByRole("heading", { name: "Mis tareas completadas" })).toBeVisible();
  const filas = page.getByTestId("fila-grupo");
  await expect(filas).toHaveCount(2);
  await expect(filas.first()).toContainText("VidaCotidiana");
  await expect(filas.first()).toContainText("2 · 67%");
  await expect(page.getByTestId("grafico-circular")).toContainText("3");

  await filas.nth(1).click();
  await expect(filas.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("grafico-circular")).toContainText("33%");
  await expect(page.getByTestId("lista-hechos")).toHaveCount(0);
  await expect(page.locator('[data-testid="grafico-circular"] path[data-clave="vidacotidiana"]')).toHaveAttribute("opacity", "0.22");
  await expect(page.locator('[data-testid="grafico-areas"] path[data-clave="universidad"]').first()).toHaveAttribute("fill-opacity", "0.9");

  // Otro período sin datos.
  await page.getByRole("button", { name: "Período anterior" }).click();
  await expect(page.getByText("No completaste tareas en este período.")).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: "Estadística Hábitos" }).click();
  await expect(page.getByRole("heading", { name: "Mis hábitos cumplidos" })).toBeVisible();
});

test("calendario mes: eventos y tareas con casilla en cada día, filtros y +", async ({ page }) => {
  await page.goto("/");
  await crearEnSemana(page, "Tarea", "Estudiar cálculo");
  await crearEnSemana(page, "Evento", "Doctor");
  await page.getByRole("navigation").getByRole("link", { name: "Calendario" }).click();
  await page.getByRole("group", { name: "Mostrar" }).getByRole("button", { name: "Todos" }).click();

  const hoy = page.locator(`[data-zona="dia:${hoyEnSantiago()}"]`);
  await expect(hoy).toContainText("Estudiar cálculo");
  await expect(hoy).toContainText("Doctor");
  // El evento va primero y no tiene casilla.
  await expect(hoy.getByTestId("chip-tarea").first()).toContainText("Doctor");
  await expect(hoy.getByRole("checkbox", { name: "Completar: Doctor" })).toHaveCount(0);

  await hoy.getByRole("checkbox", { name: "Completar: Estudiar cálculo" }).click();
  await expect(hoy.getByRole("checkbox", { name: /Estudiar cálculo/ })).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: "Eventos" }).click();
  await expect(hoy).not.toContainText("Estudiar cálculo");
  await expect(hoy).toContainText("Doctor");
  await page.getByRole("button", { name: "Tareas" }).click();
  await expect(hoy).not.toContainText("Doctor");

  // Con el filtro "Eventos", el + abre directo el formulario del evento.
  await page.getByRole("button", { name: "Eventos" }).click();
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("textbox", { name: "Añadir evento" }).fill("Cumpleaños");
  await page.getByRole("textbox", { name: "Añadir evento" }).press("Enter");
  await page.getByRole("button", { name: "Todos" }).click();
  await expect(hoy).toContainText("Cumpleaños");
});

test("nueva tarea en ventana: fecha, importancia, dificultad, índole, notas y subtareas", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("menuitem", { name: "Tarea" }).click();
  const dialogo = page.getByRole("dialog", { name: "Nueva tarea" });
  await dialogo.getByRole("textbox", { name: "Añadir tarea" }).fill("Preparar informe");
  await expect(dialogo.getByLabel("Fecha", { exact: true })).toHaveValue(hoyEnSantiago());
  // Sin fecha no se puede crear.
  await dialogo.getByLabel("Fecha", { exact: true }).fill("");
  await expect(dialogo.getByRole("button", { name: "Crear tarea" })).toBeDisabled();
  await dialogo.getByLabel("Fecha", { exact: true }).fill(hoyEnSantiago());
  await dialogo.getByRole("group", { name: "Importancia" }).getByRole("button", { name: "Media" }).click();
  await dialogo.getByRole("group", { name: "Dificultad" }).getByRole("button", { name: "Alta" }).click();
  await dialogo.getByRole("group", { name: "Índole" }).getByRole("button", { name: "Universidad" }).click();
  await dialogo.getByLabel("Notas").fill("Con gráficos");
  await dialogo.getByLabel("Nueva subtarea").fill("Buscar datos");
  // Enter en la subtarea la añade sin crear la tarea todavía.
  await dialogo.getByLabel("Nueva subtarea").press("Enter");
  await expect(dialogo.getByLabel("Título de la subtarea")).toHaveValue("Buscar datos");
  await dialogo.getByRole("button", { name: "Crear tarea" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const fila = page.getByTestId("fila-tarea").filter({ hasText: "Preparar informe" });
  await expect(fila.getByTestId("dificultad")).toHaveText("Alta");
  await expect(fila).toContainText("Universidad");
  await expect(page.getByRole("checkbox", { name: "Completar: Preparar informe" })).toHaveAttribute("title", "Importancia media");
  await fila.getByRole("button", { name: /^Preparar informe/ }).click();
  const detalle = page.getByRole("complementary", { name: "Detalle de la tarea" });
  await expect(detalle.getByLabel("Notas")).toHaveValue("Con gráficos");
  await expect(detalle.getByLabel("Título de la subtarea")).toHaveValue("Buscar datos");

  // Un evento no pide importancia ni dificultad.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("menuitem", { name: "Evento" }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo evento" }).getByRole("group", { name: "Importancia" })).toHaveCount(0);
});

test("tareas hoy: subir o bajar una tarea arrastrando su asa", async ({ page }) => {
  await page.goto("/");
  for (const t of ["Tercera", "Segunda", "Primera"]) await crearEnSemana(page, "Tarea", t);
  const lista = page.getByRole("list", { name: "Tareas" });
  const titulos = async () => (await lista.getByTestId("fila-tarea").allInnerTexts()).map((x) => x.trim().split("\n")[0].trim());
  await expect.poll(titulos).toEqual(["Primera", "Segunda", "Tercera"]);

  // Con el teclado: Espacio toma, flecha baja, Espacio suelta.
  await page.getByRole("button", { name: "Mover Primera" }).focus();
  await page.keyboard.press("Space");
  // dnd-kit mide las filas al tomar la tarea; moverla antes no la mueve.
  await expect(page.getByRole("list", { name: "Tareas" }).getByTestId("fila-tarea").first()).toHaveClass(/shadow-lg/);
  // Con la página ocupada, dnd-kit puede ignorar la flecha si llega mientras mide las filas:
  // se repite solo mientras la fila siga en su lugar. Se suelta cuando ya bajó.
  const primera = lista.getByTestId("fila-tarea").first();
  await expect(async () => {
    if (!/translate3d\(0px, [1-9]/.test((await primera.getAttribute("style")) ?? "")) await page.keyboard.press("ArrowDown");
    await expect(primera).toHaveAttribute("style", /translate3d\(0px, [1-9]/, { timeout: 700 });
  }).toPass({ timeout: 8000 });
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  await expect.poll(titulos).toEqual(["Segunda", "Primera", "Tercera"]);

  // Con el ratón: Tercera sube arriba de todo.
  const asa = page.getByRole("button", { name: "Mover Tercera" });
  const destino = lista.getByTestId("fila-tarea").first();
  const a = (await asa.boundingBox())!;
  const d = (await destino.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y - 10, { steps: 5 });
  await page.mouse.move(a.x + a.width / 2, d.y + 4, { steps: 10 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await expect.poll(titulos).toEqual(["Tercera", "Segunda", "Primera"]);

  await page.reload();
  await expect.poll(titulos).toEqual(["Tercera", "Segunda", "Primera"]);
});

test("tareas hoy: con el ratón se arrastra desde cualquier parte de la fila y el clic sigue abriendo", async ({ page }) => {
  await page.goto("/");
  for (const t of ["Tercera", "Segunda", "Primera"]) await crearEnSemana(page, "Tarea", t);
  const lista = page.getByRole("list", { name: "Tareas" });
  const titulos = async () => (await lista.getByTestId("fila-tarea").allInnerTexts()).map((x) => x.trim().split("\n")[0].trim());
  await expect.poll(titulos).toEqual(["Primera", "Segunda", "Tercera"]);

  // Se toma por el texto de la tarea (no por los seis puntos) y sube arriba de todo.
  const texto = lista.getByTestId("fila-tarea").nth(2).getByText("Tercera", { exact: true });
  const a = (await texto.boundingBox())!;
  const d = (await lista.getByTestId("fila-tarea").first().boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y - 10, { steps: 5 });
  await page.mouse.move(a.x + a.width / 2, d.y + 4, { steps: 10 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await expect.poll(titulos).toEqual(["Tercera", "Primera", "Segunda"]);
  // Soltar no abre el detalle, pero un clic sin mover sí.
  await expect(page.getByRole("button", { name: "Cancelar" })).toHaveCount(0);
  await lista.getByTestId("fila-tarea").first().getByText("Tercera", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancelar" })).toBeVisible();
});

test("idioma: Cuenta y ajustes cambia toda la app a inglés y vuelve a español", async ({ page }) => {
  await page.goto("/#/ajustes");
  await expect(page.getByRole("heading", { name: "Cuenta y ajustes" })).toBeVisible();
  await page.getByRole("radio", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Account and settings" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");
  // Se recuerda al recargar y llega al resto de la app.
  await page.goto("/#/calendario");
  await page.reload();
  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Week" }).or(page.getByRole("button", { name: "Week" })).first()).toBeVisible();
  await page.goto("/#/ajustes");
  await page.getByRole("radio", { name: "Español" }).click();
  await expect(page.getByRole("heading", { name: "Cuenta y ajustes" })).toBeVisible();
});

test("semana: ver un día o los 7 días de una vez", async ({ page }) => {
  await page.goto("/");
  await crearEnSemana(page, "Tarea", "Tarea de hoy");
  // Una tarea para otro día de la semana.
  // "Hoy" es el del navegador (Santiago), que de noche no coincide con el del servidor.
  const hoy = new Date(`${hoyEnSantiago()}T12:00:00`);
  const otro = new Date(hoy);
  otro.setDate(hoy.getDate() + (hoy.getDay() === 0 ? -1 : 1));
  // El domingo el "otro día" es ayer: la tarea queda atrasada y sale también en hoy.
  const atrasada = hoy.getDay() === 0 ? 1 : 0;
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("menuitem", { name: "Tarea" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByRole("textbox", { name: "Añadir tarea" }).fill("Tarea de otro día");
  await dialogo.getByLabel("Fecha", { exact: true }).fill(otro.toLocaleDateString("sv-SE"));
  await dialogo.getByRole("button", { name: "Crear tarea" }).click();

  await expect(page.getByTestId("fila-tarea")).toHaveCount(1 + atrasada);
  await page.getByRole("group", { name: "Ver" }).getByRole("button", { name: "7 Días" }).click();
  await expect(page.getByTestId("dia-semana")).toHaveCount(7);
  await expect(page.getByTestId("fila-tarea")).toHaveCount(2 + atrasada);
  await expect(page.getByTestId("dia-semana").filter({ hasText: "Tarea de otro día" })).toHaveCount(1 + atrasada);
  // Con 7 días hay un solo +: crea en el día marcado, que se marca tocando su tarjeta.
  await expect(page.getByRole("button", { name: "Añadir", exact: true })).toHaveCount(1);
  const domingo = page.getByTestId("dia-semana").last();
  await domingo.click({ position: { x: 10, y: 10 } });
  await expect(domingo).toHaveAttribute("data-elegida", "");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("menuitem", { name: "Evento" }).click();
  await page.getByRole("dialog").getByRole("textbox", { name: "Añadir evento" }).fill("Asado familiar");
  await page.getByRole("dialog").getByRole("button", { name: "Crear evento" }).click();
  await expect(domingo).toContainText("Asado familiar");
  // Se recuerda al volver.
  await page.reload();
  await expect(page.getByTestId("dia-semana")).toHaveCount(7);
  // En una pantalla de celular no se ofrece: siempre un día.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("group", { name: "Ver" })).toHaveCount(0);
  await expect(page.getByTestId("dia-semana")).toHaveCount(0);
  await expect(page.getByTestId("fila-tarea")).toHaveCount(1 + atrasada);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("group", { name: "Ver" }).getByRole("button", { name: "Día", exact: true }).click();
  await expect(page.getByTestId("fila-tarea")).toHaveCount(1 + atrasada);
});

test("en el computador el menú se oculta y se vuelve a mostrar", async ({ page }) => {
  await page.goto("/");
  const menu = page.getByRole("navigation", { name: "Navegación" });
  await expect(menu).toBeVisible();
  await page.getByRole("button", { name: "Ocultar menú" }).click();
  await expect(menu).toBeHidden();
  await page.reload();
  await expect(menu).toBeHidden();
  // Retraído: quedan solo los iconos (sin texto), el botón para traer el menú y la tuerca.
  const iconos = page.getByTestId("menu-iconos");
  await expect(iconos).toBeVisible();
  await expect(iconos.getByRole("link")).toHaveCount(8);
  await expect(iconos.getByRole("link").first()).toHaveAttribute("aria-label", "Semana");
  await expect(iconos.getByRole("link", { name: "Matriz" })).toHaveText("");
  await iconos.getByRole("link", { name: "Configuración" }).click();
  await expect(page.getByRole("heading", { name: "Configuración" })).toBeVisible();
  // "Completadas" ya no está en el menú.
  await page.getByRole("button", { name: "Mostrar menú" }).click();
  await expect(menu.getByRole("link", { name: /^Completadas/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Ocultar menú" }).click();
  await page.getByRole("button", { name: "Mostrar menú" }).click();
  await expect(menu).toBeVisible();
});

test("calendario mes: 'n más' lleva a la Semana en Hoy con ese día elegido", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/");
  // Quedó elegida la vista de 7 días: el enlace debe volver a "Hoy".
  await page.getByRole("group", { name: "Ver" }).getByRole("button", { name: "7 Días" }).click();
  const dia = new Date();
  dia.setDate(dia.getDate() + (dia.getDay() === 0 ? -1 : 1));
  const clave = dia.toLocaleDateString("sv-SE");
  for (let i = 1; i <= 8; i++) {
    await page.getByTestId("dia-semana").first().click({ position: { x: 10, y: 10 } });
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    await page.getByRole("menuitem", { name: "Tarea" }).click();
    const d = page.getByRole("dialog");
    await d.getByRole("textbox", { name: "Añadir tarea" }).fill(`Tarea ${i}`);
    await d.getByLabel("Fecha", { exact: true }).fill(clave);
    await d.getByRole("button", { name: "Crear tarea" }).click();
  }
  await page.getByRole("navigation").getByRole("link", { name: "Calendario" }).click();
  await page.getByRole("group", { name: "Mostrar" }).getByRole("button", { name: "Todos" }).click();
  const celda = page.locator(`[data-zona="dia:${clave}"]`);
  await celda.getByRole("link", { name: /más$/ }).click();
  await expect(page.getByRole("group", { name: "Ver" }).getByRole("button", { name: "Día", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: new RegExp(`^${dia.toLocaleDateString("es-CL", { weekday: "long" })}`), pressed: true })).toBeVisible();
  await expect(page.getByTestId("fila-tarea")).toHaveCount(8);
});

test("temas de color y color de un evento", async ({ page }) => {
  await page.goto("/");
  // Por defecto, Clásico (azul): el menú es la "cabecera" de color.
  await expect(page.locator("html")).toHaveAttribute("data-tema", "clasico");
  // El tema está en su propia entrada del menú, no en Cuenta y ajustes.
  await expect(page.getByRole("navigation", { name: "Navegación" }).getByRole("link", { name: "Tema" })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Navegación" }).getByRole("link", { name: "Configuración" }).click();
  await page.getByRole("link", { name: "Tema" }).click();
  await expect(page).toHaveURL(/#\/tema$/);
  await page.goto("/#/ajustes");
  await expect(page.getByRole("radiogroup", { name: "Tema de la app" })).toHaveCount(0);
  await page.goto("/#/tema");
  await page.getByRole("radiogroup", { name: "Tema de la app" }).getByRole("radio", { name: "Lavanda" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "lavanda");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#6d28d9");
  // Personalizar: color del menú y fondo degradado.
  await page.getByText("Personalizar tema").click();
  await page.getByLabel("Menú", { exact: true }).fill("#123456");
  await page.getByRole("group", { name: "Fondo" }).getByRole("button", { name: "Degradado" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "lavanda");
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector(".barra-lateral")!).backgroundColor)).toBe("rgb(18, 52, 86)");
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundImage)).toContain("linear-gradient");
  // Un tema oscuro y de vuelta.
  await page.getByRole("radiogroup", { name: "Tema de la app" }).getByRole("radio", { name: "Noche", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "noche");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("radiogroup", { name: "Tema de la app" }).getByRole("radio", { name: "Lavanda" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "lavanda");

  await page.goto("/");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("menuitem", { name: "Evento" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByRole("textbox", { name: "Añadir evento" }).fill("Cumpleaños");
  await dialogo.getByRole("radiogroup", { name: "Color del evento" }).getByRole("radio", { name: "#e0245e" }).click();
  await dialogo.getByRole("button", { name: "Crear evento" }).click();
  await expect(page.getByTestId("fila-evento")).toHaveAttribute("style", /border-color: rgb\(224, 36, 94\)/);

  // Color a elección: el círculo arcoíris abre el mismo selector de los hábitos (barra de tonos y cuadro).
  await page.getByTestId("fila-evento").click();
  const colores = page.getByRole("radiogroup", { name: "Color del evento" });
  await colores.getByRole("button", { name: "Otro color" }).click();
  await expect(colores.getByTestId("panel-color")).toBeVisible();
  await colores.getByRole("slider", { name: "Tono" }).press("ArrowUp");
  await expect(colores.getByRole("button", { name: "Otro color" })).toHaveAttribute("aria-pressed", "true");
  // El círculo multicolor sigue a la vista y el color elegido aparece como un círculo más.
  await expect(colores.getByRole("button", { name: "Otro color" })).toHaveAttribute("style", /conic-gradient/);
  await expect(colores.getByTitle("Color elegido")).toBeVisible();
  await expect(page.getByTestId("fila-evento").first()).not.toHaveAttribute("style", /border-color: rgb\(224, 36, 94\)/);
});

async function arrastrar(page: Page, desde: import("@playwright/test").Locator, hasta: import("@playwright/test").Locator) {
  await desde.hover();
  const a = (await desde.boundingBox())!;
  const b = (await hasta.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 5 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
  await page.mouse.up();
}

test("semana: arrastrar una tarea a otro día", async ({ page }) => {
  await page.goto("/");
  await crearEnSemana(page, "Tarea", "Llevar a otro día");
  // Un día que aún no pasa (si fuera un día pasado, la tarea seguiría en hoy como atrasada); el domingo, el sábado.
  const botones = page.getByTestId("boton-dia");
  const iHoy = await botones.evaluateAll((es) => es.findIndex((e) => e.getAttribute("aria-pressed") === "true"));
  const nombre = await botones.nth(iHoy < 6 ? iHoy + 1 : iHoy - 1).getAttribute("aria-label");
  const otro = page.getByRole("button", { name: nombre!, exact: true });
  const nombreHoy = await botones.nth(iHoy).getAttribute("aria-label");
  await arrastrar(page, page.getByRole("button", { name: "Mover Llevar a otro día" }), otro);
  await page.getByRole("button", { name: nombreHoy!, exact: true }).click();
  if (iHoy < 6) await expect(page.getByText("Llevar a otro día")).toHaveCount(0);
  await otro.click();
  await expect(page.getByText("Llevar a otro día")).toBeVisible();
});

test("matriz: subir o bajar una tarea dentro del cuadrante", async ({ page }) => {
  await page.goto("/#/matriz");
  const cuadrante = page.getByTestId("cuadrante").nth(3);
  const entradaCuadrante = cuadrante.getByRole("textbox");
  for (const t of ["Uno", "Dos"]) {
    await entradaCuadrante.fill(t);
    await entradaCuadrante.press("Enter");
    await expect(cuadrante.getByText(t, { exact: true })).toBeVisible();
  }
  const titulos = () => cuadrante.getByTestId("fila-tarea").allInnerTexts();
  const antes = (await titulos()).map((x) => x.split("\n")[0]);
  const [primera, segunda] = antes;
  await arrastrar(page, cuadrante.getByRole("button", { name: `Mover ${segunda}` }), cuadrante.getByTestId("fila-tarea").first());
  await expect.poll(async () => (await titulos()).map((x) => x.split("\n")[0])).toEqual([segunda, primera]);
});

test("widget del escritorio: vista sola, sin menú, con barra para moverlo", async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 560 });
  await page.goto("/?widget=matriz");
  await expect(page.getByTestId("barra-widget")).toHaveAttribute("title", /Matriz/);
  await expect(page.getByRole("heading", { name: "Matriz de Eisenhower" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegación" })).toHaveCount(0);
  await page.goto("/?widget=semana");
  await expect(page.getByTestId("barra-widget")).toHaveAttribute("title", /Semana/);
  // Sin barra de color ni menú: la franja para moverlo es transparente.
  await expect(page.getByRole("button", { name: "Abrir menú" })).toHaveCount(0);
  // El widget Semana parte en los 7 días, como la Semana de la app.
  await expect(page.getByTestId("dia-semana")).toHaveCount(7);
});

test("semana: los días con pendientes quedan igual de anchos y los demás angostos", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/");
  await crearEnSemana(page, "Tarea", "Tarea con espacio");
  await page.getByRole("group", { name: "Ver" }).getByRole("button", { name: "7 Días" }).click();
  const anchos = () => page.getByTestId("dia-semana").evaluateAll((es) => es.map((e) => Math.round(e.getBoundingClientRect().width)));
  const hoy = await page.getByTestId("dia-semana").evaluateAll((es) => es.findIndex((e) => e.textContent?.includes("Tarea con espacio")));
  const auto = await anchos();
  const vacio = hoy === 0 ? 1 : 0;
  expect(auto[hoy]).toBeGreaterThan(auto[vacio] * 2);

  // Al añadir una tarea a un día vacío, ese día crece y queda igual de ancho que el otro con pendientes.
  await page.getByTestId("dia-semana").nth(vacio).click({ position: { x: 5, y: 5 } });
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("menuitem", { name: "Tarea" }).click();
  const campo = page.getByRole("dialog").getByRole("textbox", { name: "Añadir tarea" });
  await campo.fill("Otra pendiente");
  await campo.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(async () => { const w = await anchos(); return Math.abs(w[hoy] - w[vacio]) <= 1 && w[vacio] > auto[vacio] * 2; }).toBe(true);
  await expect(page.getByTestId("borde-columna")).toHaveCount(0);
  await page.getByTestId("dia-semana").nth(vacio).getByRole("checkbox", { name: "Completar: Otra pendiente" }).click();
  await expect.poll(anchos).toEqual(auto);
  // Un día con todas sus tareas hechas queda tan angosto como uno sin nada.
  await page.getByRole("checkbox", { name: "Completar: Tarea con espacio" }).click();
  await expect.poll(async () => (await anchos())[hoy]).toBe(auto[vacio]);
});

test("semana: un evento se arrastra a otro día y la casilla completada queda plomo", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("menuitem", { name: "Evento" }).click();
  await page.getByRole("dialog").getByRole("textbox", { name: "Añadir evento" }).fill("Entrevista");
  await page.getByRole("dialog").getByRole("button", { name: "Crear evento" }).click();
  await crearEnSemana(page, "Tarea", "Tarea lista");
  await page.getByRole("checkbox", { name: "Completar: Tarea lista" }).click();
  await expect.poll(() => page.getByRole("checkbox", { name: /Tarea lista/ }).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(156, 163, 175)");

  await page.getByRole("group", { name: "Ver" }).getByRole("button", { name: "7 Días" }).click();
  const columnas = page.getByTestId("dia-semana");
  const iHoy = await columnas.evaluateAll((es) => es.findIndex((e) => e.textContent?.includes("Entrevista")));
  const destino = columnas.nth(iHoy < 6 ? iHoy + 1 : iHoy - 1);
  await arrastrar(page, page.getByTestId("fila-evento"), destino);
  await expect(destino.getByTestId("fila-evento")).toHaveText(/Entrevista/);
  await expect(columnas.nth(iHoy).getByTestId("fila-evento")).toHaveCount(0);
  // Un toque sin arrastrar lo sigue abriendo.
  // (Justo después de soltar, dnd-kit se traga un clic: se reintenta como lo haría una persona.)
  await expect(async () => {
    await destino.getByTestId("fila-evento").click();
    await expect(page.getByRole("complementary", { name: "Detalle de la tarea" })).toBeVisible({ timeout: 500 });
  }).toPass();
});

test("matriz: ajustar el ancho de las columnas y el alto de las filas", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/#/matriz");
  const tam = () => page.getByTestId("cuadrante").evaluateAll((es) => es.map((e) => [Math.round(e.getBoundingClientRect().width), Math.round(e.getBoundingClientRect().height)]));
  await expect(page.getByTestId("cuadrante")).toHaveCount(4);
  const inicio = await tam();
  let b = (await page.getByTestId("borde-columnas").boundingBox())!;
  await page.mouse.move(b.x + 6, b.y + 50);
  await page.mouse.down();
  await page.mouse.move(b.x + 206, b.y + 50, { steps: 8 });
  await page.mouse.up();
  b = (await page.getByTestId("borde-filas").boundingBox())!;
  await page.mouse.move(b.x + 50, b.y + 6);
  await page.mouse.down();
  await page.mouse.move(b.x + 50, b.y + 106, { steps: 8 });
  await page.mouse.up();
  const movido = await tam();
  expect(movido[0][0]).toBeGreaterThan(inicio[0][0] + 150);
  expect(movido[1][0]).toBeLessThan(inicio[1][0] - 150);
  expect(movido[0][1]).toBeGreaterThan(inicio[0][1] + 70);
  expect(movido[2][1]).toBeLessThan(inicio[2][1] - 70);
  await page.reload();
  await expect.poll(tam).toEqual(movido);
  await page.getByTestId("borde-columnas").dblclick();
  await page.getByTestId("borde-filas").dblclick();
  await expect.poll(tam).toEqual(inicio);
});

test("menú: el orden de las vistas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Navegación" }).getByRole("link", { name: "Matriz" })).toBeVisible();
  const nombres = await page.getByRole("navigation", { name: "Navegación" }).getByRole("link").allTextContents();
  const vistas = ["Semana", "Calendario", "Hábitos", "Matriz", "Estadística Tareas", "Estadística Hábitos"];
  expect(nombres.map((n) => n.replace(/\d+$/, "").trim()).filter((n) => vistas.includes(n))).toEqual(vistas);
});

test("widget Semana del escritorio: 7 días, transparencia y esquinas", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto("/?widget=semana");
  // Aunque la ventana sea angosta, el widget parte mostrando los 7 días.
  await expect(page.getByTestId("dia-semana")).toHaveCount(7);
  await expect(page.locator("html")).toHaveClass(/modo-widget/);
  await page.getByRole("button", { name: "Transparencia y esquinas" }).click();
  const ajustes = page.getByRole("group", { name: "Aspecto del widget" });
  await expect(ajustes.getByRole("button", { name: "Ajustes del Widget" })).toBeVisible();
  await ajustes.getByLabel("Transparencia").fill("60");
  await ajustes.getByLabel("Esquinas").fill("20");
  await expect(page.getByTestId("fondo-widget")).toHaveCSS("opacity", "0.4");
  await expect(page.getByTestId("marco-widget")).toHaveCSS("border-radius", "20px");
  // Las tarjetas y columnas tienen su propia transparencia.
  await ajustes.getByLabel("Tarjetas").fill("80");
  await expect.poll(() => page.getByTestId("dia-semana").first().evaluate((e) => getComputedStyle(e).getPropertyValue("--suave"))).toContain("20%");
  // Se recuerda al volver a abrir el widget.
  await page.reload();
  await expect(page.getByTestId("fondo-widget")).toHaveCSS("opacity", "0.4");
});

test("widget Semana: el contenido se achica para verse completo y no parpadea", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  for (let i = 1; i <= 7; i++) await crearEnSemana(page, "Tarea", `Tarea larga número ${i} con un título que ocupa varias líneas en la columna`);
  await page.getByRole("checkbox", { name: /Completar: Tarea larga número 1 / }).click();
  // Widget chico: todo debe caber, hasta la última completada, sin barra de desplazamiento.
  await page.setViewportSize({ width: 900, height: 380 });
  await page.goto("/?widget=semana");
  await expect(page.getByText("Tarea larga número 7", { exact: false })).toBeVisible();
  const zona = page.locator("[data-widget-desplazable]");
  await expect.poll(() => zona.evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(1);
  const zoom = () => page.getByTestId("contenido-widget").evaluate((e) => (e as HTMLElement).style.zoom);
  const z1 = await zoom();
  expect(Number(z1)).toBeLessThan(0.86);
  await page.screenshot({ path: "test-results/widget-cabe.png" });
  // Estable: la escala no cambia sola con el tiempo.
  await page.waitForTimeout(800);
  expect(await zoom()).toBe(z1);
  // Más alto: el contenido vuelve a crecer.
  await page.setViewportSize({ width: 900, height: 800 });
  await expect.poll(async () => Number(await zoom())).toBeGreaterThan(Number(z1));
  await expect.poll(() => zona.evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(1);
});

test("widget Calendario: el mes entero cabe sin barra y '+n más' abre el día en Andamia", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto("/");
  for (const t of ["Primera del día", "Segunda del día", "Tercera del día", "Cuarta del día"]) await crearEnSemana(page, "Tarea", t);
  await page.setViewportSize({ width: 520, height: 520 });
  await page.goto("/?widget=calendario");
  await expect(page.getByTestId("titulo-calendario")).toBeVisible();
  await page.getByRole("group", { name: "Mostrar" }).getByRole("button", { name: "Todos" }).click();
  const rejilla = page.locator(".auto-rows-fr");
  await expect.poll(() => rejilla.evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(1);
  const mas = page.getByRole("link", { name: /más$/ });
  await expect(mas).toBeVisible();
  await mas.click();
  await expect(page).toHaveURL(/\?abrir#\/tareas\/semana/);
});

test("widget Matriz del escritorio: los 4 cuadrantes a la vista, sin desplazar el widget", async ({ page }) => {
  for (const [ancho, alto] of [[380, 420], [560, 560]] as const) {
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto("/?widget=matriz");
    const cuadrantes = page.getByTestId("cuadrante");
    await expect(cuadrantes).toHaveCount(4);
    for (let i = 0; i < 4; i++) await expect(cuadrantes.nth(i)).toBeInViewport({ ratio: 1 });
    // 2×2: los dos de arriba en la misma fila y los dos de la izquierda en la misma columna.
    const cajas = await cuadrantes.evaluateAll((es) => es.map((e) => e.getBoundingClientRect()).map((r) => ({ x: Math.round(r.x), y: Math.round(r.y) })));
    expect(cajas[0].y).toBe(cajas[1].y);
    expect(cajas[0].x).toBe(cajas[2].x);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
  }
});

test("menú Widgets (app de PC): añadir y quitar widgets del escritorio", async ({ page }) => {
  // Sin la app de PC, el apartado no aparece.
  await page.goto("/");
  await irAHash(page, "#/configuracion");
  await expect(page.getByRole("link", { name: "Widgets" })).toHaveCount(0);

  // Puente falso de la app de PC.
  await page.addInitScript(() => {
    const abiertos = new Set<string>(["semana"]);
    const oyentes: ((ids: string[]) => void)[] = [];
    const avisar = () => oyentes.forEach((f) => f([...abiertos]));
    (window as unknown as { andamiaEscritorio: unknown }).andamiaEscritorio = {
      widgetsAbiertos: async () => [...abiertos],
      abrirWidget: (id: string) => (abiertos.add(id), avisar()),
      cerrarWidget: (id: string) => (abiertos.delete(id), avisar()),
      alCambiarWidgets: (f: (ids: string[]) => void) => (oyentes.push(f), () => undefined),
    };
  });
  await page.goto("/");
  await page.getByRole("navigation", { name: "Navegación" }).getByRole("link", { name: "Configuración" }).click();
  await page.getByRole("link", { name: "Widgets" }).click();
  await expect(page).toHaveURL(/#\/widgets$/);
  await expect(page.getByTestId("widget-disponible")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Quitar del escritorio: Semana" })).toBeVisible();
  await page.getByRole("button", { name: "Añadir al escritorio: Calendario" }).click();
  await expect(page.getByRole("button", { name: "Quitar del escritorio: Calendario" })).toBeVisible();
  await page.getByRole("button", { name: "Quitar del escritorio: Semana" }).click();
  await expect(page.getByRole("button", { name: "Añadir al escritorio: Semana" })).toBeVisible();
  // "Ajustes del Widget" (desde la ventana de un widget) llega con los ajustes de ese widget abiertos.
  await expect(page.getByRole("button", { name: "Ajustes de Calendario" })).toHaveAttribute("aria-expanded", "false");
  await page.goto("/#/widgets/calendario");
  await expect(page.getByRole("button", { name: "Ajustes de Calendario" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Ajustes de Semana" })).toHaveAttribute("aria-expanded", "false");
  // Abajo de la vista Semana de la app está "Ajustes del Widget", que lleva a los ajustes de ese widget.
  await page.goto("/#/tareas/semana");
  // Va pegado a la tarjeta de tareas, no al fondo de la ventana.
  const tarjeta = (await page.getByTestId("tarjeta-tareas").boundingBox())!;
  const enlace = (await page.getByRole("link", { name: "Ajustes del Widget" }).boundingBox())!;
  expect(enlace.y - (tarjeta.y + tarjeta.height)).toBeLessThan(16);
  // Con los 7 días a la vista, el enlace también se ve sin tener que bajar.
  await page.getByRole("group", { name: "Ver" }).getByRole("button", { name: "7 Días" }).click();
  await expect(page.getByRole("link", { name: "Ajustes del Widget" })).toBeInViewport({ ratio: 1 });
  await page.getByRole("link", { name: "Ajustes del Widget" }).click();
  await expect(page).toHaveURL(/#\/widgets\/semana$/);
  await expect(page.getByRole("button", { name: "Ajustes de Semana" })).toHaveAttribute("aria-expanded", "true");
  // En vistas sin widget (Hábitos) no aparece.
  await page.goto("/#/habitos");
  await expect(page.getByRole("link", { name: "Ajustes del Widget" })).toHaveCount(0);
});
test.describe("celular", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("semana: el hábito se completa pinchando a la derecha y se desmarca pinchando a la izquierda", async ({ page }) => {
    await page.goto("/#/habitos");
    await page.getByRole("button", { name: "Nuevo hábito" }).click();
    await page.getByLabel("Nombre del hábito").fill("Estirar");
    await page.getByRole("button", { name: "Crear hábito" }).click();
    await expect(page.getByTestId("habito")).toHaveCount(1);

    await page.goto("/#/semana");
    await abrirHabitos(page);
    const interruptor = page.getByRole("switch", { name: "Hábito Estirar" });
    const perilla = interruptor.getByTestId("perilla-habito");
    const arrastrar = (hasta: number) => deslizarHabito(page, interruptor, hasta);

    // Un toque en el círculo (a la izquierda) lo marca; a la izquierda otra vez lo desmarca.
    await perilla.click();
    await expect(interruptor).toHaveAttribute("aria-checked", "true");
    await arrastrar(0.03);
    await expect(interruptor).toHaveAttribute("aria-checked", "false");
    // En la parte vacía de la mitad izquierda no se marca.
    await arrastrar(0.4);
    await expect(interruptor).toHaveAttribute("aria-checked", "false");
    // Un toque a la derecha lo deja hecho.
    await arrastrar(0.9);
    await expect(interruptor).toHaveAttribute("aria-checked", "true");
    // Pinchar el círculo cuando ya está hecho (a la derecha) lo desmarca; y otra vez lo marca.
    await page.waitForTimeout(300);
    await perilla.click();
    await expect(interruptor).toHaveAttribute("aria-checked", "false");
    await page.waitForTimeout(300);
    await perilla.click();
    await expect(interruptor).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await abrirHabitos(page);
    await expect(interruptor).toHaveAttribute("aria-checked", "true");
    // Un toque a la izquierda quita la marca.
    await arrastrar(0.1);
    await expect(interruptor).toHaveAttribute("aria-checked", "false");
  });

  for (const ancho of [360, 369, 412]) {
    test(`semana: los filtros caben en su barra en un celular de ${ancho} px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 780 });
      await page.goto("/#/semana");
      const grupo = page.getByRole("group", { name: "Mostrar" });
      await grupo.getByRole("button", { name: "Todos" }).click();
      const barra = (await grupo.boundingBox())!;
      const todos = (await grupo.getByRole("button", { name: "Todos" }).boundingBox())!;
      const nuevo = (await page.locator("header [aria-haspopup=menu]").first().boundingBox())!;
      expect(todos.x + todos.width).toBeLessThanOrEqual(barra.x + barra.width);
      expect(barra.x + barra.width).toBeLessThanOrEqual(nuevo.x);
      expect(nuevo.x + nuevo.width).toBeLessThanOrEqual(ancho);
    });
  }
});

test("detalle: ventana al medio con Eliminar y Guardar; el hábito de la Semana también tiene el suyo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/#/habitos");
  await page.getByRole("button", { name: "Nuevo hábito" }).click();
  await page.getByLabel("Nombre del hábito").fill("Leer");
  await page.getByRole("button", { name: "Crear hábito" }).click();
  await expect(page.getByTestId("habito")).toHaveCount(1);

  await page.goto("/");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("menuitem", { name: "Evento" }).click();
  await page.getByRole("dialog").getByRole("textbox", { name: "Añadir evento" }).fill("Doctor");
  await page.getByRole("dialog").getByRole("button", { name: "Crear evento" }).click();

  // Evento: sin casilla ni X; Eliminar (rojo) a la izquierda y Guardar a la derecha; tocar de nuevo lo cierra.
  const detalle = page.getByRole("complementary", { name: "Detalle de la tarea" });
  await page.getByTestId("fila-evento").click();
  await expect(detalle).toBeVisible();
  await expect(detalle.getByRole("checkbox")).toHaveCount(0);
  await expect(detalle.getByRole("button", { name: "Cerrar detalle" })).toHaveCount(0);
  const eliminar = detalle.getByRole("button", { name: "Enviar a la papelera" });
  const guardar = detalle.getByRole("button", { name: "Guardar" });
  await expect(eliminar).toHaveText(/Eliminar/);
  expect((await eliminar.boundingBox())!.x).toBeLessThan((await guardar.boundingBox())!.x);
  // Es una ventana al medio y encima (como "Nueva tarea"): tocar fuera la cierra.
  const caja = (await detalle.boundingBox())!;
  expect(Math.abs(caja.x + caja.width / 2 - 640)).toBeLessThan(5);
  await page.mouse.click(5, 5);
  await expect(detalle).toBeHidden();

  // Guardar conserva el cambio y cierra.
  await page.getByTestId("fila-evento").click();
  await detalle.getByLabel("Título").fill("Doctora");
  await guardar.click();
  await expect(detalle).toBeHidden();
  await expect(page.getByTestId("fila-evento")).toContainText("Doctora");

  // Hábito: tocar su nombre abre su detalle; Guardar aplica el cambio; tocar de nuevo lo cierra.
  const habito = page.getByRole("complementary", { name: "Detalle del hábito" });
  await abrirHabitos(page);
  await page.getByRole("button", { name: "Ver Leer", exact: true }).first().click();
  await expect(habito).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(habito).toBeHidden();
  await page.getByRole("button", { name: "Ver Leer", exact: true }).first().click();
  await habito.getByLabel("Nombre del hábito").fill("Leer mucho");
  await habito.getByRole("button", { name: "Guardar" }).click();
  await expect(habito).toBeHidden();
  await page.getByRole("button", { name: "Ver Leer mucho" }).first().click();
  await habito.getByRole("button", { name: "Eliminar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Borrar para siempre" }).click();
  await expect(page.getByTestId("habito-semana")).toHaveCount(0);

  await page.screenshot({ path: process.env.CAPTURA ?? "/tmp/claude-0/-home-user/229ca586-01d6-597f-9392-378f6527fb35/scratchpad/detalle.png" });
});

test("el + crea directo lo del filtro puesto y el menú se puede achicar", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/#/semana");
  const mostrar = page.getByRole("group", { name: "Mostrar" });
  const mas = page.getByRole("button", { name: "Añadir", exact: true });

  // Con "Todos", el + pregunta qué crear.
  await mostrar.getByRole("button", { name: "Todos" }).click();
  await mas.click();
  await expect(page.getByRole("menuitem")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await page.mouse.click(700, 600);

  // Con un filtro, abre de inmediato ese formulario.
  await mostrar.getByRole("button", { name: "Tareas" }).click();
  await mas.click();
  await expect(page.getByRole("menuitem")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Nueva tarea" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
  await mostrar.getByRole("button", { name: "Eventos" }).click();
  await mas.click();
  await expect(page.getByRole("dialog", { name: "Nuevo evento" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
  await mostrar.getByRole("button", { name: "Hábitos" }).click();
  await mas.click();
  await expect(page.getByRole("dialog", { name: "Nuevo hábito" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();

  // El borde derecho del menú se arrastra para achicarlo, y se recuerda.
  const menu = page.locator(".barra-lateral").first();
  expect(Math.round((await menu.boundingBox())!.width)).toBe(288);
  const borde = (await page.getByTestId("ancho-menu").boundingBox())!;
  await page.mouse.move(borde.x + borde.width / 2, 400);
  await page.mouse.down();
  await page.mouse.move(200, 400, { steps: 5 });
  await page.mouse.up();
  expect(Math.round((await menu.boundingBox())!.width)).toBe(200);
  // Con el menú angosto, el botón de ocultarlo sigue dentro del menú.
  const cajaMenu = (await menu.boundingBox())!;
  const ocultar = (await page.getByRole("button", { name: "Ocultar menú" }).boundingBox())!;
  expect(ocultar.x + ocultar.width).toBeLessThanOrEqual(cajaMenu.x + cajaMenu.width);
  await page.reload();
  await expect.poll(async () => Math.round((await menu.boundingBox())!.width)).toBe(200);
});

test("hábitos: de a dos en la Semana y tabla por día en el computador", async ({ page }) => {
  await page.goto("/#/habitos");
  for (const nombre of ["Agua", "Deporte"]) {
    await page.getByRole("button", { name: "Nuevo hábito" }).click();
    await page.getByLabel("Nombre del hábito").fill(nombre);
    await page.getByRole("button", { name: "Crear hábito" }).click();
    await expect(page.getByTestId("habito").filter({ hasText: nombre })).toHaveCount(1);
  }
  // Tabla: una fila por hábito, 7 días, y se marca tocando el círculo de hoy.
  const tabla = page.getByTestId("tabla-habitos");
  await expect(tabla.getByTestId("fila-tabla-habito")).toHaveCount(2);
  await expect(tabla.getByRole("button", { name: /^Marcar Agua el / })).toHaveCount(7);
  const hoy = tabla.locator("button[aria-label^='Marcar Agua el ']:not([disabled])").last();
  await hoy.click();
  await expect(hoy).toHaveAttribute("data-estado", "hecho");
  // El segundo toque lo desmarca.
  await hoy.click();
  await expect(hoy).toHaveAttribute("data-estado", "vacio");
  await hoy.click();
  await expect(hoy).toHaveAttribute("data-estado", "hecho");
  // Semana: "Hábitos" queda centrado sobre la columna de nombres y el mes sobre el primer día.
  const nombreCol = (await tabla.getByTestId("fila-tabla-habito").first().boundingBox())!;
  const titulo = (await tabla.getByRole("heading", { name: "Hábitos" }).boundingBox())!;
  expect(Math.abs(titulo.x + titulo.width / 2 - (nombreCol.x + nombreCol.width / 2))).toBeLessThan(3);
  const nav = (await tabla.getByTestId("nav-tabla-habitos").boundingBox())!;
  const colDia = (await tabla.locator("button[aria-label^='Marcar Agua el ']").first().locator("xpath=..").boundingBox())!;
  expect(Math.abs(nav.x - colDia.x)).toBeLessThan(3);

  // Por mes: una columna por cada día del mes.
  await page.getByRole("group", { name: "Ver por" }).getByRole("button", { name: "Mes", exact: true }).click();
  expect(await tabla.getByRole("button", { name: /^Marcar Agua el / }).count()).toBeGreaterThanOrEqual(28);
  // Título, mes y botones van dentro del recuadro de la tabla; ya no hay línea "Configuración".
  await expect(tabla.getByRole("heading", { name: "Hábitos" })).toBeVisible();
  await expect(tabla.getByRole("group", { name: "Ver por" })).toBeVisible();
  await expect(tabla.getByRole("button", { name: "Nuevo hábito" })).toBeVisible();
  await expect(tabla.getByTestId("titulo-tabla-habitos")).toHaveText(/^\S+ \d{4}$/);
  await expect(page.getByRole("heading", { name: "Configuración" })).toHaveCount(0);

  // En la Semana (vista de un día) los hábitos van de a dos por fila; el marcado en la tabla se ve aquí.
  await page.goto("/#/tareas/semana");
  await abrirHabitos(page);
  const filas = page.getByTestId("habito-semana");
  await expect(filas).toHaveCount(2);
  const a = (await filas.nth(0).boundingBox())!;
  const b = (await filas.nth(1).boundingBox())!;
  expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  expect(b.x).toBeGreaterThan(a.x + a.width - 1);
  await expect(page.getByRole("switch", { name: "Hábito Agua" })).toHaveAttribute("aria-checked", "true");

  // En el celular la tabla no aparece (solo es para el computador).
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/#/habitos");
  await expect(page.getByTestId("habito")).toHaveCount(2);
  await expect(page.getByTestId("tabla-habitos")).toBeHidden();
});

test("semana: con 2 eventos y más de 2 filas de hábitos, los hábitos van en un desplegable", async ({ page }) => {
  await page.goto("/#/habitos");
  for (const nombre of ["Uno", "Dos", "Tres", "Cuatro", "Cinco"]) {
    await page.getByRole("button", { name: "Nuevo hábito" }).first().click();
    await page.getByLabel("Nombre del hábito").fill(nombre);
    await page.getByRole("button", { name: "Crear hábito" }).click();
    await expect(page.getByTestId("habito").filter({ hasText: nombre })).toHaveCount(1);
  }
  await page.goto("/#/semana");
  // En el computador los hábitos van siempre en el desplegable (cerrado al principio).
  await expect(page.locator("button[aria-expanded][aria-label='Hábitos']")).toHaveAttribute("aria-expanded", "false");
  await crearEnSemana(page, "Evento", "Primer evento");
  await crearEnSemana(page, "Evento", "Segundo evento");
  const desplegable = page.locator("button[aria-expanded][aria-label='Hábitos']");
  await expect(desplegable).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("switch", { name: "Hábito Uno" })).toHaveCount(0);
  await desplegable.click();
  await expect(page.getByRole("switch", { name: "Hábito Uno" })).toBeVisible();
  // Cada hábito lleva su color de fondo.
  const fondo = await page.getByTestId("habito-semana").first().evaluate((e) => getComputedStyle(e).backgroundImage);
  expect(fondo).not.toBe("none");
});

test("estadísticas: el filtro Año viene elegido por defecto", async ({ page }) => {
  await page.goto("/#/estadisticas/tareas");
  await expect(page.getByRole("button", { name: "Año", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/#/estadisticas/habitos");
  await expect(page.getByRole("button", { name: "Año", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Semana", exact: true }).click();
  await expect(page.getByRole("button", { name: "Semana", exact: true })).toHaveAttribute("aria-pressed", "true");
});

/** Un día del mes actual que no sea hoy, para probar la marca del día elegido. */
const otroDiaDelMes = () => {
  const hoy = hoyEnSantiago();
  return `${hoy.slice(0, 8)}${hoy.endsWith("-15") ? "16" : "15"}`;
};

test("calendario mes: tocar un día solo lo marca; el + abre el formulario del filtro con ese día", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("navigation").getByRole("link", { name: "Calendario" }).click();
  const clave = otroDiaDelMes();
  const celda = page.locator(`[data-zona="dia:${clave}"]`);
  const hoy = page.locator(`[data-zona="dia:${hoyEnSantiago()}"]`);
  const filtro = (nombre: string) => page.getByRole("group", { name: "Mostrar" }).getByRole("button", { name: nombre });
  const dialogo = page.getByRole("dialog");
  // Sin tocar nada, el borde está en el día de hoy.
  await expect(hoy).toHaveAttribute("data-elegida", "");

  await filtro("Eventos").click();
  await celda.click({ position: { x: 40, y: 50 } });
  // Tocar solo marca el día: no se abre ningún formulario.
  await expect(celda).toHaveAttribute("data-elegida", "");
  await expect(page.locator("[data-elegida]")).toHaveCount(1);
  await expect(dialogo).toHaveCount(0);
  await page.locator("button[data-nueva-tarea]").click();
  await expect(dialogo).toContainText("Nuevo evento");
  await expect(dialogo.getByLabel("Fecha", { exact: true })).toHaveValue(clave);
  await expect(dialogo.getByRole("radiogroup", { name: "Color del evento" })).toBeVisible();
  await dialogo.getByRole("textbox", { name: "Añadir evento" }).fill("Reunión de curso");
  await dialogo.getByRole("button", { name: "Crear evento" }).click();
  await expect(celda).toContainText("Reunión de curso");
  // Al crear, el borde vuelve solo al día de hoy.
  await expect(hoy).toHaveAttribute("data-elegida", "");
  await expect(celda).not.toHaveAttribute("data-elegida", "");

  await filtro("Tareas").click();
  await celda.click({ position: { x: 40, y: 50 } });
  await expect(dialogo).toHaveCount(0);
  await page.locator("button[data-nueva-tarea]").click();
  await expect(dialogo).toContainText("Nueva tarea");
  await expect(dialogo.getByLabel("Fecha", { exact: true })).toHaveValue(clave);
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(hoy).toHaveAttribute("data-elegida", "");

  await filtro("Hábitos").click();
  await celda.click({ position: { x: 40, y: 50 } });
  await page.locator("button[data-nueva-tarea]").click();
  await expect(dialogo.getByLabel("Fecha de inicio")).toHaveValue(clave);
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.locator(".fixed.inset-0.z-40")).toHaveCount(0);
  await expect(hoy).toHaveAttribute("data-elegida", "");

  // Con Todos, el + pregunta qué crear.
  await filtro("Todos").click();
  // (el evento creado arriba ocupa la parte media de la celda: se toca la esquina)
  await celda.click({ position: { x: 4, y: 4 } });
  await page.locator("button[data-nueva-tarea]").click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.locator('[data-crear="tarea"]').click();
  await expect(dialogo.getByLabel("Fecha", { exact: true })).toHaveValue(clave);
});

test("calendario mes: tocar dos veces un día lleva a la Semana en ese día", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("navigation").getByRole("link", { name: "Calendario" }).click();
  const clave = otroDiaDelMes();
  await page.locator(`[data-zona="dia:${clave}"]`).dblclick({ position: { x: 40, y: 50 } });
  await expect(page).toHaveURL(/#\/tareas\/semana/);
  await expect(page.getByRole("button", { name: new RegExp(`^.*${Number(clave.slice(8))}`) }).first()).toBeVisible();
});

test("detalle de un evento: Cancelar deshace el cambio de color y Guardar lo conserva", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await crearEnSemana(page, "Evento", "Entrega final");
  await page.getByRole("navigation").getByRole("link", { name: "Calendario" }).click();
  await page.getByRole("group", { name: "Mostrar" }).getByRole("button", { name: "Eventos" }).click();
  const chip = page.getByTestId("chip-tarea").filter({ hasText: "Entrega final" });
  const detalle = page.getByRole("complementary", { name: "Detalle de la tarea" });

  await chip.click();
  await detalle.getByRole("radiogroup", { name: "Color del evento" }).getByRole("radio", { name: "#e0245e" }).click();
  await expect(chip).toHaveAttribute("style", /border-color: rgb\(224, 36, 94\)/);
  await detalle.getByRole("button", { name: "Cancelar" }).click();
  await expect(detalle).toBeHidden();
  await expect(chip).not.toHaveAttribute("style", /rgb\(224, 36, 94\)/);

  await chip.click();
  await detalle.getByRole("radiogroup", { name: "Color del evento" }).getByRole("radio", { name: "#e0245e" }).click();
  await detalle.getByRole("button", { name: "Guardar" }).click();
  await expect(chip).toHaveAttribute("style", /border-color: rgb\(224, 36, 94\)/);
});

test("semana, vista Día en el computador: arrastrar la tira abre el mes y arrastrar hacia arriba lo cierra", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/#/tareas/semana");
  await page.getByRole("group", { name: "Ver" }).getByRole("button", { name: "Día", exact: true }).click();
  const zona = page.getByTestId("zona-dias");
  await expect(page.getByRole("group", { name: "Días del mes" })).toHaveCount(0);
  const caja = (await zona.boundingBox())!;
  const x = caja.x + caja.width / 2;
  const y = caja.y + 10;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 80, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("group", { name: "Días del mes" })).toBeVisible();
  // Tocar la barrita no hace nada: solo se arrastra.
  await page.getByTestId("agarre-mes").click();
  await expect(page.getByRole("group", { name: "Días del mes" })).toBeVisible();
  const caja2 = (await zona.boundingBox())!;
  await page.mouse.move(x, caja2.y + caja2.height - 4);
  await page.mouse.down();
  await page.mouse.move(x, caja2.y + caja2.height - 100, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("group", { name: "Días del mes" })).toHaveCount(0);
});
