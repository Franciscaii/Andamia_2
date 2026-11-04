/** Dos notas suaves generadas en el navegador: no usa archivos de sonido. */
export function reproducirFin(): void {
  try {
    const Contexto = window.AudioContext;
    if (!Contexto) return;
    const ctx = new Contexto();
    const notas = [
      { frecuencia: 659.25, inicio: 0 },
      { frecuencia: 880, inicio: 0.22 },
    ];
    for (const { frecuencia, inicio } of notas) {
      const oscilador = ctx.createOscillator();
      const volumen = ctx.createGain();
      oscilador.type = "sine";
      oscilador.frequency.value = frecuencia;
      const t = ctx.currentTime + inicio;
      volumen.gain.setValueAtTime(0.0001, t);
      volumen.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      volumen.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      oscilador.connect(volumen).connect(ctx.destination);
      oscilador.start(t);
      oscilador.stop(t + 0.55);
    }
    window.setTimeout(() => void ctx.close(), 1200);
  } catch {
    // Sin audio disponible el aviso visual sigue funcionando.
  }
}
