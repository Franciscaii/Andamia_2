package cl.andamia.app;

import android.app.Activity;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import java.util.Random;

/** Lluvia de confeti sobre la pantalla (dura menos de dos segundos y deja pasar los toques). */
public class ConfetiActivity extends Activity {
    private static final long DURACION = 1700;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE);
        // Que las barras del teléfono (hora arriba, botones abajo) no cambien de color mientras cae el confeti.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS | WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        if (android.os.Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        setContentView(new Lluvia(this));
        overridePendingTransition(0, 0);
    }

    @Override
    public void finish() {
        super.finish();
        overridePendingTransition(0, 0);
    }

    private final class Lluvia extends View {
        private final int N = 80;
        private final float[] x = new float[N], y = new float[N], vx = new float[N], vy = new float[N], giro = new float[N], vg = new float[N], tam = new float[N];
        private final int[] color = new int[N], forma = new int[N];
        // Mismos colores pastel y mismas formas que el confeti de la app: 0 estrella, 1 punto, 2 trozo, 3 cinta.
        private final int[] paleta = { 0xFFFF9EC0, 0xFFA9D0FF, 0xFFFFE08A, 0xFFC9A6EE, 0xFFA9E2C4, 0xFFFFB88A, 0xFFFF9ED4 };
        private final int[] formas = { 0, 1, 2, 3, 3, 2 };
        private final Paint pincel = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path trazo = new Path();
        private final long inicio = System.currentTimeMillis();
        private long ultimo = inicio;
        private boolean listo;

        Lluvia(Context c) {
            super(c);
        }

        private void arrancar() {
            Random r = new Random();
            float d = getResources().getDisplayMetrics().density;
            // Sale del círculo del hábito que se marcó (si el celular dice dónde fue el toque); si no, de arriba al medio.
            float ox = getIntent().getFloatExtra("x", -1f), oy = getIntent().getFloatExtra("y", -1f);
            if (ox < 0 || oy < 0) {
                ox = getWidth() / 2f;
                oy = getHeight() * 0.35f;
            }
            for (int i = 0; i < N; i++) {
                double angulo = r.nextDouble() * Math.PI * 2;
                float rapidez = (90 + r.nextFloat() * 300) * d;
                x[i] = ox;
                y[i] = oy;
                vx[i] = (float) Math.cos(angulo) * rapidez;
                vy[i] = (float) Math.sin(angulo) * rapidez;
                giro[i] = r.nextFloat() * 360;
                vg[i] = (r.nextFloat() - 0.5f) * 10 * 57.2958f;
                tam[i] = (5 + r.nextFloat() * 7) * d;
                color[i] = paleta[r.nextInt(paleta.length)];
                forma[i] = formas[r.nextInt(formas.length)];
            }
            listo = true;
        }

        private void estrella(Canvas lienzo, float radio) {
            trazo.reset();
            for (int i = 0; i < 10; i++) {
                float rr = i % 2 == 0 ? radio : radio * 0.45f;
                double a = (Math.PI / 5) * i - Math.PI / 2;
                float px = (float) Math.cos(a) * rr, py = (float) Math.sin(a) * rr;
                if (i == 0) trazo.moveTo(px, py);
                else trazo.lineTo(px, py);
            }
            trazo.close();
            pincel.setStyle(Paint.Style.FILL);
            lienzo.drawPath(trazo, pincel);
        }

        @Override
        protected void onDraw(Canvas lienzo) {
            if (!listo) arrancar();
            long ahora = System.currentTimeMillis();
            float dt = Math.min(0.05f, (ahora - ultimo) / 1000f);
            ultimo = ahora;
            float t = (ahora - inicio) / (float) DURACION;
            float d = getResources().getDisplayMetrics().density;
            float freno = (float) Math.pow(0.05, dt);
            int alfa = (int) (255 * Math.max(0f, Math.min(1f, (1f - t) * 2.2f)));
            for (int i = 0; i < N; i++) {
                vy[i] += 160 * d * dt;
                vx[i] *= freno;
                vy[i] *= freno;
                x[i] += vx[i] * dt;
                y[i] += vy[i] * dt;
                giro[i] += vg[i] * dt;
                pincel.setColor(color[i]);
                pincel.setAlpha(alfa);
                lienzo.save();
                lienzo.translate(x[i], y[i]);
                lienzo.rotate(giro[i]);
                float m = tam[i];
                switch (forma[i]) {
                    case 0:
                        estrella(lienzo, m * 0.9f);
                        break;
                    case 1:
                        pincel.setStyle(Paint.Style.FILL);
                        lienzo.drawCircle(0, 0, m * 0.45f, pincel);
                        break;
                    case 2:
                        pincel.setStyle(Paint.Style.FILL);
                        lienzo.drawRect(-m / 2, -m / 4, m / 2, m / 4, pincel);
                        break;
                    default:
                        pincel.setStyle(Paint.Style.STROKE);
                        pincel.setStrokeWidth(2.5f * d);
                        pincel.setStrokeCap(Paint.Cap.ROUND);
                        trazo.reset();
                        trazo.moveTo(-m * 1.3f, 0);
                        trazo.cubicTo(-m * 0.6f, -m * 0.9f, 0, m * 0.9f, m * 1.3f, 0);
                        lienzo.drawPath(trazo, pincel);
                        break;
                }
                lienzo.restore();
            }
            if (ahora - inicio < DURACION) postInvalidateOnAnimation();
            else finish();
        }
    }
}
