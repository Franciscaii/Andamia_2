import { expect, test, type Locator, type Page } from "@playwright/test";

const AHORA = new Date("2026-11-04T12:00:00-03:00"); // miércoles

const enlace = (page: Page, nombre: string) => page.getByRole("navigation").getByRole("link", { name: new RegExp(`^${nombre}`) });
const entrada = (page: Page) => page.getByRole("textbox", { name: "Añadir tarea" });

async function agregar(page: Page, texto: string) {
  await entrada(page).fill(texto);
  await entrada(page).press("Enter");
  await expect(entrada(page)).toHaveValue("");
}

async function arrastrar(page: Page, origen: Locator, destino: Locator) {
  const a = await origen.boundingBox();
  await destino.scrollIntoViewIfNeeded();
  const b = await destino.boundingBox();
  if (!a || !b) throw new Error("No se encontró dónde arrastrar");
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 + 8, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(120);
}

test.describe("matriz", () => {
  test("arrastrar entre cuadrantes cambia la prioridad", async ({ page }) => {
    await page.clock.setFixedTime(AHORA);
    await page.goto("/#/tareas/bandeja");
    await agregar(page, "Entregar informe !alta");
    await agregar(page, "Ordenar correo");
    await agregar(page, "Hecha ya !alta");
    await page.getByTestId("fila-tarea").filter({ hasText: "Hecha ya" }).getByRole("checkbox").click();

    await enlace(page, "Matriz").click();
    const cuadrante = (n: string) => page.getByRole("region", { name: n, exact: true });
    await expect(cuadrante("Urgente + Importante")).toContainText("Entregar informe");
    await expect(cuadrante("No urgente + No importante")).toContainText("Ordenar correo");
    // Solo pendientes.
    await expect(page.getByTestId("cuadrante").filter({ hasText: "Hecha ya" })).toHaveCount(0);

    const fila = cuadrante("No urgente + No importante").getByTestId("fila-tarea").filter({ hasText: "Ordenar correo" });
    await fila.hover();
    await arrastrar(page, fila.getByRole("button", { name: "Mover Ordenar correo" }), cuadrante("No urgente + Importante"));
    await expect(cuadrante("No urgente + Importante")).toContainText("Ordenar correo");
    await expect(cuadrante("No urgente + No importante")).not.toContainText("Ordenar correo");

    // La prioridad cambió de verdad y persiste.
    await page.reload();
    await page.getByRole("button", { name: /^Ordenar correo/ }).click();
    await expect(page.getByRole("complementary", { name: "Detalle de la tarea" }).getByRole("group", { name: "Importancia" }).getByRole("button", { name: "Media" })).toHaveAttribute("aria-pressed", "true");
  });

  test("añadir en un cuadrante y filtrar", async ({ page }) => {
    await page.clock.setFixedTime(AHORA);
    await page.goto("/#/tareas/bandeja");
    await agregar(page, "Con etiqueta #casa");
    await page.goto("/#/matriz");
    const cuadrante = (n: string) => page.getByRole("region", { name: n, exact: true });

    await page.getByLabel("Añadir tarea en Urgente + No importante").fill("Llamar al gas mañana");
    await page.getByLabel("Añadir tarea en Urgente + No importante").press("Enter");
    await expect(cuadrante("Urgente + No importante")).toContainText("Llamar al gas");
    await expect(cuadrante("Urgente + No importante")).toContainText("Mañana");

    await page.getByLabel("Filtrar por etiqueta").selectOption("casa");
    await expect(page.getByTestId("fila-tarea")).toHaveCount(1);
    await expect(page.getByTestId("fila-tarea")).toContainText("Con etiqueta");
    await page.getByLabel("Filtrar por etiqueta").selectOption("");
    await expect(page.getByLabel("Filtrar por lista")).toHaveCount(0);
    await expect(page.getByTestId("fila-tarea")).toHaveCount(2);
  });
});

test.describe("enfoque", () => {
  test("completar un pomodoro con tiempo acelerado, descanso y estadísticas", async ({ page }) => {
    await page.clock.install({ time: AHORA });
    await page.addInitScript(() => {
      const w = window as unknown as { avisos: string[]; Notification: unknown; sonidos: number; AudioContext: unknown };
      w.avisos = [];
      w.sonidos = 0;
      class Falsa {
        static permission = "granted";
        static requestPermission = async () => "granted";
        onclick = null;
        constructor(t: string) {
          w.avisos.push(t);
        }
        close() {}
      }
      w.Notification = Falsa;
      const Original = window.AudioContext;
      w.AudioContext = class extends Original {
        constructor() {
          super();
          w.sonidos += 1;
        }
      };
    });
    await page.goto("/#/tareas/bandeja");
    await agregar(page, "Escribir capítulo");
    await page.goto("/#/enfoque");

    await expect(page.getByTestId("tiempo")).toHaveText("25:00");
    await page.getByRole("combobox", { name: "Tarea de esta sesión" }).selectOption({ label: "Escribir capítulo" });
    await page.getByRole("button", { name: "Empezar" }).click();

    // Diez minutos después sigue contando desde la marca de tiempo.
    await page.clock.fastForward("10:00");
    await expect(page.getByTestId("tiempo")).toHaveText(/^1[45]:\d\d$/);

    // Sobrevive a recargar la página.
    await page.reload();
    await expect(page.getByTestId("tiempo")).toHaveText(/^1[45]:\d\d$/);
    await expect(page.getByRole("button", { name: "Pausar" })).toBeVisible();

    await page.clock.fastForward("15:01");
    await expect(page.getByTestId("fase")).toHaveText("Descanso");
    await expect(page.getByTestId("aviso-enfoque")).toContainText("Enfoque terminado");
    await expect.poll(() => page.evaluate(() => (window as unknown as { avisos: string[] }).avisos)).toEqual(["¡Enfoque terminado!"]);
    expect(await page.evaluate(() => (window as unknown as { sonidos: number }).sonidos)).toBe(1);

    const estadisticas = page.getByRole("region", { name: "Estadísticas de enfoque" });
    await expect(page.getByTestId("sesion")).toHaveCount(1);
    await expect(page.getByTestId("sesion")).toContainText("Escribir capítulo");
    await expect(page.getByTestId("sesion")).toContainText("25 min");
    await expect(estadisticas).toContainText("1 pomodoro");
    await expect(estadisticas).not.toContainText("1 pomodoros");
    await expect(estadisticas).toContainText("1 día");

    // Saltar el descanso deja listo el siguiente.
    await page.getByRole("button", { name: "Saltar" }).click();
    await expect(page.getByTestId("fase")).toHaveText("Enfoque");
    await expect(page.getByTestId("tiempo")).toHaveText("25:00");
  });

  test("con la página cerrada, la sesión termina a su hora", async ({ page }) => {
    await page.clock.install({ time: AHORA });
    await page.goto("/#/enfoque");
    await page.getByRole("button", { name: "Empezar" }).click();
    await page.goto("about:blank");
    await page.clock.fastForward("03:00:00");
    await page.goto("/#/enfoque");
    await expect(page.getByTestId("sesion")).toHaveCount(1);
    await expect(page.getByTestId("sesion")).toContainText("25 min");
    await expect(page.getByRole("button", { name: "Empezar" })).toBeVisible();
  });

  test("pausar, reanudar, ajustes y cronómetro", async ({ page }) => {
    await page.clock.install({ time: AHORA });
    await page.goto("/#/enfoque");

    await page.getByRole("button", { name: "Ajustes del temporizador" }).click();
    await page.getByRole("dialog").getByLabel("Enfoque (minutos)").fill("10");
    await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByTestId("tiempo")).toHaveText("10:00");

    await page.getByRole("button", { name: "Empezar" }).click();
    await page.clock.fastForward("02:00");
    await page.getByRole("button", { name: "Pausar" }).click();
    const pausado = await page.getByTestId("tiempo").innerText();
    await page.clock.fastForward("05:00");
    await expect(page.getByTestId("tiempo")).toHaveText(pausado);
    await page.reload();
    await expect(page.getByTestId("tiempo")).toHaveText(pausado);
    await page.getByRole("button", { name: "Reanudar" }).click();
    await page.clock.fastForward("01:00");
    await expect(page.getByTestId("tiempo")).not.toHaveText(pausado);

    await page.getByRole("button", { name: "Abandonar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Abandonar" }).click();
    await expect(page.getByTestId("sesion")).toHaveCount(0);

    await page.getByRole("button", { name: "Cronómetro" }).click();
    await page.getByRole("button", { name: "Empezar" }).click();
    await page.clock.fastForward("12:00");
    await page.getByRole("button", { name: "Detener y guardar" }).click();
    await expect(page.getByTestId("sesion")).toHaveCount(1);
    await expect(page.getByTestId("sesion")).toContainText("12 min");
  });
});

test.describe("hábitos", () => {
  async function crear(page: Page, nombre: string, ajustes?: () => Promise<void>) {
    await page.getByRole("button", { name: "Nuevo hábito" }).click();
    await page.getByLabel("Nombre del hábito").fill(nombre);
    if (ajustes) await ajustes();
    await page.getByRole("button", { name: "Crear hábito" }).click();
    await expect(page.getByTestId("habito").filter({ hasText: nombre })).toBeVisible();
  }

  test("marcar días y ver la racha, el historial y archivar", async ({ page }) => {
    await page.clock.setFixedTime(AHORA);
    await page.goto("/#/habitos");
    await crear(page, "Leer", async () => {
      await page.getByLabel("Fecha de inicio").fill("2026-11-01");
      await page.getByRole("button", { name: "Icono libro" }).click();
    });

    const fila = page.getByTestId("habito").filter({ hasText: "Leer" });
    await expect(fila.getByTestId("racha-fila")).toContainText("0 días");
    // Los días se marcan al desplegar la tarjeta.
    await fila.getByRole("button", { name: "Desplegar Leer" }).click();

    // Los días anteriores al inicio no se pueden marcar.
    await expect(fila.getByRole("button", { name: /^Leer, viernes 30 de octubre/ })).toBeDisabled();

    await fila.getByRole("button", { name: /^Leer, lunes 2 de noviembre/ }).click();
    await fila.getByRole("button", { name: /^Leer, martes 3 de noviembre/ }).click();
    await fila.getByRole("button", { name: /^Leer, miércoles 4 de noviembre/ }).click();
    await expect(fila.getByTestId("racha-fila")).toContainText("3 días");

    // Parcial no suma; no hecho rompe la racha.
    const hoy = fila.getByRole("button", { name: /^Leer, miércoles 4 de noviembre/ });
    await hoy.click();
    await expect(hoy).toHaveAttribute("data-estado", "parcial");
    await expect(fila.getByTestId("racha-fila")).toContainText("2 días");
    await hoy.click();
    await expect(hoy).toHaveAttribute("data-estado", "no-hecho");
    await expect(fila.getByTestId("racha-fila")).toContainText("0 días");
    await hoy.click();
    await expect(hoy).toHaveAttribute("data-estado", "vacio");
    await hoy.click();

    // Historial con rachas, cumplimiento y calendario.
    await fila.getByRole("button", { name: "Historial" }).click();
    const historial = page.getByRole("region", { name: "Historial de Leer" });
    await expect(historial.getByTestId("racha-actual")).toHaveText("3 días");
    await expect(historial.getByTestId("racha-maxima")).toHaveText("3 días");
    await expect(historial.getByTestId("cumplimiento")).toHaveText("75 %");
    await expect(historial.getByTestId("mes-habito")).toHaveText(/noviembre 2026/i);
    await historial.getByRole("button", { name: /^1 de noviembre/ }).click();
    await expect(historial.getByTestId("racha-actual")).toHaveText("4 días");
    await expect(historial.getByTestId("cumplimiento")).toHaveText("100 %");

    // Persiste.
    await page.reload();
    await expect(page.getByTestId("habito").filter({ hasText: "Leer" }).getByTestId("racha-fila")).toContainText("4 días");

    // Apagar "Activo" lo deja en la lista, sin poder marcarlo, y conserva su historial.
    const leer = page.getByTestId("habito").filter({ hasText: "Leer" });
    await leer.getByRole("switch", { name: "Activo: Leer" }).click();
    await expect(leer.getByRole("switch", { name: "Activo: Leer" })).toHaveAttribute("aria-checked", "false");
    await expect(leer.getByTestId("racha-fila")).toContainText("4 días");
    await leer.getByRole("button", { name: "Desplegar Leer" }).click();
    await expect(leer.getByRole("button", { name: /^Leer, miércoles 4 de noviembre/ })).toBeDisabled();

    // Desplegado se cambian el color (también uno a elección) y la frecuencia, y queda guardado.
    await leer.getByRole("button", { name: "Otro color" }).click();
    // El cuadro del selector: arrastrar el círculo hasta la esquina derecha de arriba da blanco, a la izquierda el tono puro.
    const cuadro = leer.getByRole("slider", { name: "Intensidad y brillo" });
    const caja = (await cuadro.boundingBox())!;
    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
    await page.mouse.down();
    await page.mouse.move(caja.x + 2, caja.y + 2, { steps: 5 });
    await page.mouse.up();
    const rojoOtro = await cuadro.getAttribute("aria-valuetext");
    expect(rojoOtro).toMatch(/^#[0-9a-f]{6}$/);
    await leer.getByRole("slider", { name: "Tono" }).press("ArrowDown");
    await expect(cuadro).not.toHaveAttribute("aria-valuetext", rojoOtro!);
    const elegido = (await cuadro.getAttribute("aria-valuetext"))!;
    await leer.getByRole("button", { name: "Veces por semana" }).click();
    await expect(leer).toContainText("3 veces por semana");
    await page.reload();
    await expect(page.getByTestId("habito").filter({ hasText: "Leer" })).toContainText("3 veces por semana");
    await page.getByTestId("habito").filter({ hasText: "Leer" }).getByRole("button", { name: "Desplegar Leer" }).click();
    await page.getByRole("button", { name: "Otro color" }).click();
    await expect(page.getByRole("slider", { name: "Intensidad y brillo" })).toHaveAttribute("aria-valuetext", elegido);

    // El basurero lo borra, con confirmación.
    await page.getByRole("button", { name: "Borrar Leer" }).click();
    await page.getByRole("button", { name: "Borrar para siempre" }).click();
    await expect(page.getByTestId("habito")).toHaveCount(0);
  });

  test("objetivo por día con cantidad y varias veces por semana", async ({ page }) => {
    await page.clock.setFixedTime(AHORA);
    await page.goto("/#/habitos");
    await crear(page, "Agua", async () => {
      await page.getByLabel("Objetivo por día").fill("8");
      // Ya no se pide unidad; bajo el nombre van la fecha de inicio y la de fin.
      await expect(page.getByLabel("Unidad")).toHaveCount(0);
      await expect(page.getByLabel("Fecha de inicio")).toBeVisible();
      await expect(page.getByLabel("Fecha de fin")).toBeVisible();
    });
    const agua = page.getByTestId("habito").filter({ hasText: "Agua" });
    await expect(agua).toContainText("· 8");
    await agua.getByRole("button", { name: "Desplegar Agua" }).click();
    const hoy = agua.getByRole("button", { name: /^Agua, miércoles 4 de noviembre/ });

    await hoy.click();
    await page.getByRole("dialog").getByLabel("Cantidad").fill("3");
    await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
    await expect(hoy).toHaveAttribute("data-estado", "parcial");
    await expect(hoy).toHaveText("3");

    await hoy.click();
    await page.getByRole("dialog").getByLabel("Cantidad").fill("8");
    await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
    await expect(hoy).toHaveAttribute("data-estado", "hecho");
    await expect(agua.getByTestId("racha-fila")).toContainText("1 día");

    await crear(page, "Correr", async () => {
      await page.getByLabel("Frecuencia", { exact: true }).selectOption("semanal");
      await page.getByLabel("Veces por semana").fill("1");
    });
    const correr = page.getByTestId("habito").filter({ hasText: "Correr" });
    await expect(correr).toContainText("1 vez por semana");
    await correr.getByRole("button", { name: "Desplegar Correr" }).click();
    await correr.getByRole("button", { name: /^Correr, miércoles 4 de noviembre/ }).click();
    await expect(correr.getByTestId("racha-fila")).toContainText("1 sem.");
  });

  test("días de la semana y recordatorio", async ({ page }) => {
    await page.clock.setFixedTime(AHORA);
    await page.goto("/#/habitos");
    await crear(page, "Clase", async () => {
      await page.getByLabel("Frecuencia", { exact: true }).selectOption("dias");
      for (const d of ["martes", "miércoles", "jueves"]) await page.getByRole("dialog").getByRole("button", { name: d, exact: true }).click();
      await page.getByLabel("Hora del recordatorio").fill("09:00");
    });
    const fila = page.getByTestId("habito").filter({ hasText: "Clase" });
    await expect(fila).toContainText("lun, vie");
    await fila.getByRole("button", { name: "Desplegar Clase" }).click();
    await expect(fila.getByRole("button", { name: /^Clase, miércoles 4 de noviembre/ })).toBeDisabled();
    // Hoy no está programado: no avisa.
    await expect(page.getByTestId("aviso")).toHaveCount(0);

    await crear(page, "Estirar", async () => {
      await page.getByLabel("Hora del recordatorio").fill("09:00");
    });
    await expect(page.getByTestId("aviso")).toContainText("Estirar");
    await page.reload();
    await expect(page.getByTestId("habito").filter({ hasText: "Estirar" })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByTestId("aviso")).toHaveCount(0);
  });
});

test.describe("móvil", () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test("las pantallas nuevas caben y funcionan", async ({ page }) => {
    await page.clock.setFixedTime(AHORA);
    await page.goto("/#/habitos");
    await page.getByRole("button", { name: "Nuevo hábito" }).click();
    await page.getByLabel("Nombre del hábito").fill("Leer");
    await page.getByRole("button", { name: "Crear hábito" }).click();
    await page.getByRole("button", { name: "Desplegar Leer" }).click();
    await page.getByTestId("habito").getByRole("button", { name: /^Leer, miércoles/ }).click();
    await expect(page.getByTestId("racha-fila")).toContainText("1 día");

    for (const ruta of ["/#/habitos", "/#/matriz", "/#/enfoque"]) {
      await page.goto(ruta);
      await page.waitForTimeout(100);
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(desborde, `desborde horizontal en ${ruta}`).toBeLessThanOrEqual(0);
    }
    await page.goto("/#/matriz");
    await page.getByLabel("Añadir tarea en Urgente + Importante").fill("Desde el móvil");
    await page.getByLabel("Añadir tarea en Urgente + Importante").press("Enter");
    await expect(page.getByRole("region", { name: "Urgente + Importante", exact: true })).toContainText("Desde el móvil");

    // En el celular el menú va abajo, con iconos.
    await page.getByTestId("menu-abajo").getByRole("link", { name: "Hábitos", exact: true }).click();
    await expect(page).toHaveURL(/#\/habitos$/);
  });
});
