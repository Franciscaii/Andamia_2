package cl.andamia.app;

import android.app.Activity;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import java.util.Random;

/** Lluvia de confeti sobre la pantalla (dura menos de dos segundos y deja pasar los toques). */
public class ConfetiActivity extends Activity {
    private static final long DURACION = 1800;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE);
        setContentView(new Lluvia(this));
        overridePendingTransition(0, 0);
    }

    @Override
    public void finish() {
        super.finish();
        overridePendingTransition(0, 0);
    }

    private final class Lluvia extends View {
        private final int N = 90;
        private final float[] x = new float[N], y = new float[N], vx = new float[N], vy = new float[N], giro = new float[N], vg = new float[N], tam = new float[N];
        private final int[] color = new int[N];
        private final int[] paleta = { 0xFFEF4444, 0xFFF59E0B, 0xFF22C55E, 0xFF3B82F6, 0xFFA855F7, 0xFFEC4899, 0xFF14B8A6 };
        private final Paint pincel = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final long inicio = System.currentTimeMillis();
        private long ultimo = inicio;
        private boolean listo;

        Lluvia(Context c) {
            super(c);
        }

        private void arrancar() {
            Random r = new Random();
            float ancho = getWidth(), alto = getHeight(), d = getResources().getDisplayMetrics().density;
            for (int i = 0; i < N; i++) {
                x[i] = ancho * (0.1f + 0.8f * r.nextFloat());
                y[i] = alto * (0.25f + 0.15f * r.nextFloat());
                vx[i] = (r.nextFloat() - 0.5f) * 900 * d / 3;
                vy[i] = -(300 + r.nextFloat() * 700) * d / 2;
                giro[i] = r.nextFloat() * 360;
                vg[i] = (r.nextFloat() - 0.5f) * 720;
                tam[i] = (5 + r.nextFloat() * 6) * d;
                color[i] = paleta[r.nextInt(paleta.length)];
            }
            listo = true;
        }

        @Override
        protected void onDraw(Canvas lienzo) {
            if (!listo) arrancar();
            long ahora = System.currentTimeMillis();
            float dt = Math.min(0.05f, (ahora - ultimo) / 1000f);
            ultimo = ahora;
            float t = (ahora - inicio) / (float) DURACION;
            float d = getResources().getDisplayMetrics().density;
            for (int i = 0; i < N; i++) {
                vy[i] += 900 * d * dt;
                vx[i] *= 0.99f;
                x[i] += vx[i] * dt;
                y[i] += vy[i] * dt;
                giro[i] += vg[i] * dt;
                pincel.setColor(color[i]);
                pincel.setAlpha((int) (255 * Math.max(0f, Math.min(1f, (1f - t) * 2.2f))));
                lienzo.save();
                lienzo.rotate(giro[i], x[i], y[i]);
                lienzo.drawRect(x[i] - tam[i] / 2, y[i] - tam[i] / 4, x[i] + tam[i] / 2, y[i] + tam[i] / 4, pincel);
                lienzo.restore();
            }
            if (ahora - inicio < DURACION) postInvalidateOnAnimation();
            else finish();
        }
    }
}
