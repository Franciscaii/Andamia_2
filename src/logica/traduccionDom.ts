import { IDIOMA } from "./idioma";
import { aIngles } from "./traducciones";

/**
 * Con el idioma en inglés, cambia los textos que React dibuja (y sus aria-label, title y placeholder)
 * a medida que aparecen. No toca los datos guardados: solo lo que se ve.
 */
const ATRIBUTOS = ["aria-label", "title", "placeholder", "alt"];
const OMITIR = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION"]);

function enEditable(el: Element | null): boolean {
  return !!el?.closest("[contenteditable='true'], [data-no-traducir]");
}

function textoDe(nodo: Text) {
  const padre = nodo.parentElement;
  if (!padre || (OMITIR.has(padre.tagName) && padre.tagName !== "OPTION") || enEditable(padre)) return;
  const nuevo = aIngles(nodo.nodeValue ?? "");
  if (nuevo !== nodo.nodeValue) nodo.nodeValue = nuevo;
}

function atributosDe(el: Element) {
  for (const a of ATRIBUTOS) {
    const v = el.getAttribute(a);
    if (v) {
      const nuevo = aIngles(v);
      if (nuevo !== v) el.setAttribute(a, nuevo);
    }
  }
}

function recorrer(raiz: Node) {
  if (raiz.nodeType === Node.TEXT_NODE) return textoDe(raiz as Text);
  if (raiz.nodeType !== Node.ELEMENT_NODE) return;
  const el = raiz as Element;
  if (enEditable(el)) return;
  atributosDe(el);
  el.querySelectorAll("*").forEach(atributosDe);
  const lector = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = lector.nextNode(); n; n = lector.nextNode()) textoDe(n as Text);
}

export function iniciarTraduccion() {
  document.documentElement.lang = IDIOMA;
  if (IDIOMA !== "en") return;
  const observador = new MutationObserver((cambios) => {
    for (const c of cambios) {
      if (c.type === "childList") c.addedNodes.forEach(recorrer);
      else if (c.type === "characterData") recorrer(c.target);
      else if (c.type === "attributes" && c.target instanceof Element) atributosDe(c.target);
    }
  });
  observador.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
  recorrer(document.body);
}
