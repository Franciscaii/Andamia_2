// Genera los iconos de la PWA a partir del diseño propio de Andamia: un andamio simple.
// Uso: node scripts/generar-iconos.cjs (requiere Google Chrome).
const { chromium } = require("@playwright/test");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const COLOR = "#2f6b5e";
const dibujo = (escala) => {
  const t = (32 - 32 * escala) / 2;
  return `<g transform="translate(${t} ${t}) scale(${escala})"><path d="M9 6v20M23 6v20M9 12h14M9 20h14M9 20l14-8" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/></g>`;
};
const svgNormal = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${COLOR}"/>${dibujo(1)}</svg>`;
// En los iconos adaptables el sistema recorta el borde: fondo completo y dibujo más pequeño.
const svgAdaptable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${COLOR}"/>${dibujo(0.72)}</svg>`;

(async () => {
  const dir = join(__dirname, "..", "public", "iconos");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "icono.svg"), svgNormal);
  const navegador = await chromium.launch({ channel: "chrome" });
  const salidas = [
    ["icono-192.png", 192, svgNormal],
    ["icono-512.png", 512, svgNormal],
    ["icono-adaptable-512.png", 512, svgAdaptable],
    ["icono-apple-180.png", 180, svgAdaptable],
  ];
  for (const [nombre, tamano, svg] of salidas) {
    const p = await navegador.newPage({ viewport: { width: tamano, height: tamano } });
    await p.setContent(`<!doctype html><style>*{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await p.screenshot({ path: join(dir, nombre), omitBackground: true });
    await p.close();
  }
  await navegador.close();
  console.log("Iconos generados en public/iconos");
})();
