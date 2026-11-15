package cl.andamia.app;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.List;

/**
 * Ventanita que se abre sobre la pantalla de inicio al tocar el interruptor de un hábito en el
 * widget Semana (Android no deja arrastrar dentro de un widget). Trae el mismo interruptor en
 * grande: se arrastra el círculo a la derecha, el lado izquierdo se va coloreando y, al soltarlo
 * cerca del final, el hábito queda hecho. Arrastrarlo de vuelta a la izquierda quita la marca.
 *
 * Se abre con andamia://habito/ID/AAAA-MM-DD/1|0?n=nombre&c=color&w=idWidget (el 1|0 es lo que
 * pasaría con un toque: 1 si falta marcarlo, 0 si ya está hecho).
 */
public class DeslizarHabitoActivity extends Activity {
    private float d;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        d = getResources().getDisplayMetrics().density;
        Uri datos = getIntent().getData();
        List<String> partes = datos == null ? null : datos.getPathSegments();
        if (partes == null || partes.size() != 3) {
            cerrar();
            return;
        }
        final String id = partes.get(0);
        final String fecha = partes.get(1);
        final boolean hecho = "0".equals(partes.get(2));
        String nombre = datos.getQueryParameter("n");
        int idWidget = AppWidgetManager.INVALID_APPWIDGET_ID;
        try {
            idWidget = Integer.parseInt(String.valueOf(datos.getQueryParameter("w")));
        } catch (NumberFormatException e) {
            // Sin widget conocido: quedan los colores del tema de la app.
        }
        TemaWidget.usar(this, idWidget);
        int fondo = FabricaListaHoy.color(this, R.color.widget_fondo) | 0xFF000000;
        int texto = FabricaListaHoy.color(this, R.color.widget_texto);
        int tenue = FabricaListaHoy.color(this, R.color.widget_texto_tenue);
        int color = FabricaListaHoy.color(this, R.color.widget_acento);
        try {
            String c = datos.getQueryParameter("c");
            if (c != null && !c.isEmpty()) color = Color.parseColor(c);
        } catch (IllegalArgumentException e) {
            // Color desconocido: queda el acento.
        }

        // Fondo oscurecido: tocar fuera cierra sin cambiar nada.
        FrameLayout raiz = new FrameLayout(this);
        raiz.setBackgroundColor(Color.argb(110, 0, 0, 0));
        raiz.setOnClickListener(v -> cerrar());

        LinearLayout tarjeta = new LinearLayout(this);
        tarjeta.setOrientation(LinearLayout.VERTICAL);
        tarjeta.setClickable(true);
        tarjeta.setPadding(px(18), px(16), px(18), px(16));
        GradientDrawable forma = new GradientDrawable();
        forma.setColor(fondo);
        forma.setCornerRadius(20 * d);
        tarjeta.setBackground(forma);
        tarjeta.setElevation(px(8));
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER_VERTICAL);
        lp.setMargins(px(20), px(24), px(20), px(24));
        raiz.addView(tarjeta, lp);

        TextView titulo = new TextView(this);
        titulo.setText(nombre == null || nombre.isEmpty() ? "Hábito" : nombre);
        titulo.setTextColor(texto);
        titulo.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        titulo.setTypeface(Typeface.DEFAULT_BOLD);
        titulo.setGravity(Gravity.CENTER);
        tarjeta.addView(titulo);

        final TextView ayuda = new TextView(this);
        ayuda.setText(hecho ? "Arrastra el círculo a la izquierda para quitar la marca" : "Arrastra el círculo a la derecha para completarlo");
        ayuda.setTextColor(tenue);
        ayuda.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12.5f);
        ayuda.setGravity(Gravity.CENTER);
        ayuda.setPadding(0, px(4), 0, px(14));
        tarjeta.addView(ayuda);

        Deslizador deslizador = new Deslizador(this, d, color, tenue, hecho, ahora -> {
            DatosWidget.marcarHabito(this, id, fecha, ahora);
            Widgets.redibujarTodo(this);
            // Un momento para ver el interruptor completo antes de volver al widget.
            ayuda.setText(ahora ? "¡Hecho!" : "Marca quitada");
            ayuda.postDelayed(this::cerrar, 380);
        });
        tarjeta.addView(deslizador, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, px(52)));

        setContentView(raiz);
    }

    private int px(float dp) {
        return Math.round(dp * d);
    }

    private void cerrar() {
        finish();
        overridePendingTransition(0, 0);
    }

    interface AlCambiar {
        void cambio(boolean hecho);
    }

    /** El interruptor arrastrable: riel, lado izquierdo coloreado hasta el círculo y el círculo con su ✓. */
    static final class Deslizador extends View {
        /** Hasta dónde hay que llevar el círculo para que cuente. */
        private static final float UMBRAL = 0.8f;
        private final float d;
        private final int color, tenue;
        private final AlCambiar alCambiar;
        private boolean hecho;
        /** Avance del círculo: 0 a la izquierda, 1 a la derecha. */
        private float avance;
        private float xInicio, avanceInicio;
        private boolean arrastrando, terminado;
        private final Paint pintura = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint trazo = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF caja = new RectF();
        private final Path tick = new Path();

        Deslizador(Context c, float d, int color, int tenue, boolean hecho, AlCambiar alCambiar) {
            super(c);
            this.d = d;
            this.color = color;
            this.tenue = tenue;
            this.hecho = hecho;
            this.avance = hecho ? 1 : 0;
            this.alCambiar = alCambiar;
            // La sombra del círculo necesita dibujarse por software.
            setLayerType(LAYER_TYPE_SOFTWARE, null);
            trazo.setStyle(Paint.Style.STROKE);
            trazo.setStrokeCap(Paint.Cap.ROUND);
            trazo.setStrokeJoin(Paint.Join.ROUND);
            setContentDescription("Arrastra el círculo para marcar el hábito");
        }

        private float radio() {
            return getHeight() / 2f - 5 * d;
        }

        private float recorrido() {
            return Math.max(1, getWidth() - getHeight());
        }

        private float centro() {
            return getHeight() / 2f + recorrido() * avance;
        }

        @Override
        protected void onDraw(Canvas lienzo) {
            float alto = getHeight(), ancho = getWidth();
            float margen = 2 * d;
            float r = (alto - 2 * margen) / 2f;
            // Riel apagado con borde fino.
            caja.set(margen, margen, ancho - margen, alto - margen);
            pintura.setShader(null);
            pintura.setStyle(Paint.Style.FILL);
            pintura.setColor(Color.argb(40, Color.red(tenue), Color.green(tenue), Color.blue(tenue)));
            lienzo.drawRoundRect(caja, r, r, pintura);
            pintura.setStyle(Paint.Style.STROKE);
            pintura.setStrokeWidth(1.2f * d);
            pintura.setColor(Color.argb(120, Color.red(tenue), Color.green(tenue), Color.blue(tenue)));
            lienzo.drawRoundRect(caja, r, r, pintura);
            pintura.setStyle(Paint.Style.FILL);

            // El lado izquierdo se colorea hasta donde va el círculo.
            float cx = centro();
            if (avance > 0.001f) {
                caja.set(margen, margen, Math.min(ancho - margen, cx + r), alto - margen);
                pintura.setShader(new LinearGradient(margen, 0, ancho - margen, 0, aclarar(color, 0.3f), color, Shader.TileMode.CLAMP));
                lienzo.drawRoundRect(caja, r, r, pintura);
                pintura.setShader(null);
            }

            // Círculo blanco con sombra y su ✓ (del color del hábito cuando ya pasó la mitad).
            float rc = radio();
            float cy = alto / 2f;
            pintura.setColor(Color.WHITE);
            pintura.setShadowLayer(3 * d, 0, 1.2f * d, Color.argb(90, 0, 0, 0));
            lienzo.drawCircle(cx, cy, rc, pintura);
            pintura.clearShadowLayer();
            trazo.setStrokeWidth(2.6f * d);
            trazo.setColor(avance > 0.5f ? color : Color.argb(90, 110, 116, 128));
            tick.reset();
            tick.moveTo(cx - rc * 0.42f, cy + rc * 0.02f);
            tick.lineTo(cx - rc * 0.10f, cy + rc * 0.34f);
            tick.lineTo(cx + rc * 0.44f, cy - rc * 0.30f);
            lienzo.drawPath(tick, trazo);
        }

        private static int aclarar(int color, float cuanto) {
            return Color.rgb(
                    Math.round(Color.red(color) + (255 - Color.red(color)) * cuanto),
                    Math.round(Color.green(color) + (255 - Color.green(color)) * cuanto),
                    Math.round(Color.blue(color) + (255 - Color.blue(color)) * cuanto));
        }

        @Override
        public boolean onTouchEvent(MotionEvent e) {
            if (terminado) return true;
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    // Hay que tomar el círculo (con un poco de holgura para el dedo).
                    if (Math.abs(e.getX() - centro()) > getHeight() * 0.9f) return true;
                    arrastrando = true;
                    xInicio = e.getX();
                    avanceInicio = avance;
                    getParent().requestDisallowInterceptTouchEvent(true);
                    return true;
                case MotionEvent.ACTION_MOVE:
                    if (!arrastrando) return true;
                    avance = Math.max(0, Math.min(1, avanceInicio + (e.getX() - xInicio) / recorrido()));
                    invalidate();
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    if (!arrastrando) return true;
                    arrastrando = false;
                    boolean nuevo = hecho ? avance > 1 - UMBRAL : avance >= UMBRAL;
                    avance = nuevo ? 1 : 0;
                    invalidate();
                    if (nuevo != hecho) {
                        hecho = nuevo;
                        terminado = true;
                        alCambiar.cambio(nuevo);
                    }
                    return true;
                default:
                    return true;
            }
        }
    }
}
