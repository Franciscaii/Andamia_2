import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Android solo deja poner en un widget ciertas vistas. Si un diseño usa otra (por ejemplo
// un <View> suelto), el celular muestra "No se pudo agregar el widget".
const PERMITIDAS = new Set([
  "FrameLayout", "LinearLayout", "RelativeLayout", "GridLayout",
  "TextView", "ImageView", "ImageButton", "Button", "ProgressBar", "Chronometer", "AnalogClock",
  "ListView", "GridView", "StackView", "ViewFlipper", "AdapterViewFlipper", "ViewStub",
  "CheckBox", "Switch", "RadioButton", "RadioGroup",
]);

const carpeta = join(__dirname, "../../android/app/src/main/res/layout");
const disenos = readdirSync(carpeta).filter((n) => n.startsWith("widget_") && n.endsWith(".xml"));

describe("diseños de widgets de Android", () => {
  it("hay diseños que revisar", () => expect(disenos.length).toBeGreaterThan(3));

  for (const nombre of disenos) {
    it(`${nombre} solo usa vistas permitidas en widgets`, () => {
      const xml = readFileSync(join(carpeta, nombre), "utf8").replace(/<!--[\s\S]*?-->/g, "");
      const etiquetas = [...xml.matchAll(/<([A-Za-z][\w.]*)[\s/>]/g)].map((m) => m[1]);
      expect(etiquetas.filter((e) => !PERMITIDAS.has(e))).toEqual([]);
    });
  }
});
