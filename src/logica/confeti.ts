const CLAVE_CONFETI = "andamia-confeti";

/** Si el confeti al completar un hábito está activado (por defecto sí). Se guarda en este dispositivo. */
export function confetiActivo(): boolean {
  try {
    return localStorage.getItem(CLAVE_CONFETI) !== "0";
  } catch {
    return true;
  }
}

export function guardarConfetiActivo(activo: boolean): void {
  try {
    localStorage.setItem(CLAVE_CONFETI, activo ? "1" : "0");
  } catch {
    // Sin almacenamiento: queda como estaba.
  }
  // El widget de Android también tiene que enterarse.
  window.dispatchEvent(new Event("andamia-confeti"));
}

/** Estallido de confeti pastel (estrellas, puntos, trocitos y cintas) que sale de un punto, por ejemplo del círculo de un hábito recién marcado. Dura menos de dos segundos y deja pasar los toques. */
export function lanzarConfeti(origen?: { x: number; y: number }) {
  if (typeof document === "undefined" || typeof requestAnimationFrame === "undefined") return;
  if (!confetiActivo()) return;
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
  const ox = origen?.x ?? ancho / 2;
  const oy = origen?.y ?? alto * 0.35;
  const paleta = ["#ff9ec0", "#a9d0ff", "#ffe08a", "#c9a6ee", "#a9e2c4", "#ffb88a", "#ff9ed4"];
  const formas = ["estrella", "punto", "trozo", "cinta", "cinta", "trozo"] as const;
  const trozos = Array.from({ length: 80 }, () => {
    const angulo = Math.random() * Math.PI * 2;
    const rapidez = 90 + Math.random() * 300;
    return {
      forma: formas[Math.floor(Math.random() * formas.length)],
      x: ox,
      y: oy,
      vx: Math.cos(angulo) * rapidez,
      vy: Math.sin(angulo) * rapidez,
      giro: Math.random() * Math.PI * 2,
      vg: (Math.random() - 0.5) * 10,
      tam: 5 + Math.random() * 7,
      color: paleta[Math.floor(Math.random() * paleta.length)],
    };
  });
  const estrella = (r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  };
  const DURACION = 1700;
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
    const freno = Math.pow(0.05, dt);
    for (const p of trozos) {
      p.vy += 160 * dt;
      p.vx *= freno;
      p.vy *= freno;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.giro += p.vg * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.giro);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      if (p.forma === "estrella") estrella(p.tam * 0.9);
      else if (p.forma === "punto") {
        ctx.beginPath();
        ctx.arc(0, 0, p.tam * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.forma === "trozo") ctx.fillRect(-p.tam / 2, -p.tam / 4, p.tam, p.tam / 2);
      else {
        // Cinta: una ondita.
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-p.tam * 1.3, 0);
        ctx.bezierCurveTo(-p.tam * 0.6, -p.tam * 0.9, 0, p.tam * 0.9, p.tam * 1.3, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);
}
