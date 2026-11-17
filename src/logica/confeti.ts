/** Lluvia de confeti sobre la pantalla al completar un hábito; dura menos de dos segundos y deja pasar los toques. */
export function lanzarConfeti() {
  if (typeof document === "undefined" || typeof requestAnimationFrame === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const lienzo = document.createElement("canvas");
  lienzo.setAttribute("aria-hidden", "true");
  lienzo.dataset.testid = "confeti";
  lienzo.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  const ancho = (lienzo.width = window.innerWidth);
  const alto = (lienzo.height = window.innerHeight);
  const ctx = lienzo.getContext("2d");
  if (!ctx) return;
  document.body.appendChild(lienzo);
  const paleta = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];
  const trozos = Array.from({ length: 90 }, () => ({
    x: ancho * (0.1 + 0.8 * Math.random()),
    y: alto * (0.25 + 0.15 * Math.random()),
    vx: (Math.random() - 0.5) * 300,
    vy: -(150 + Math.random() * 350),
    giro: Math.random() * Math.PI * 2,
    vg: (Math.random() - 0.5) * 12,
    tam: 6 + Math.random() * 6,
    color: paleta[Math.floor(Math.random() * paleta.length)],
  }));
  const DURACION = 1800;
  const inicio = performance.now();
  let ultimo = inicio;
  const cuadro = (ahora: number) => {
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    ultimo = ahora;
    const t = (ahora - inicio) / DURACION;
    if (t >= 1) {
      lienzo.remove();
      return;
    }
    ctx.clearRect(0, 0, ancho, alto);
    ctx.globalAlpha = Math.max(0, Math.min(1, (1 - t) * 2.2));
    for (const p of trozos) {
      p.vy += 450 * dt;
      p.vx *= 0.99;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.giro += p.vg * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.giro);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.tam / 2, -p.tam / 4, p.tam, p.tam / 2);
      ctx.restore();
    }
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);
}
