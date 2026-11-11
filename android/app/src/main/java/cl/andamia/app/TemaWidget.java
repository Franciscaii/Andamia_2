package cl.andamia.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Build;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONObject;

/**
 * Colores del tema elegido en la app y el aspecto de los widgets (transparencia y esquinas),
 * tal como los manda la app. Sin datos todavía, quedan los colores de res/values.
 */
final class TemaWidget {
    private TemaWidget() {}

    private static boolean cargado;
    private static boolean hay;
    private static int fondo, texto, tenue, suave, acento, sobreAcento;
    /** 0 = fondo opaco, 90 = casi invisible. */
    private static int transparencia = 5;
    /** Radio de las esquinas, en dp. */
    private static int esquinas = 20;

    /** La app mandó tema o aspecto nuevos: se vuelven a leer en el próximo dibujo. */
    static synchronized void olvidar() {
        cargado = false;
    }

    private static int colorDe(JSONObject o, String clave, int otro) {
        try {
            String c = o.optString(clave);
            return c.isEmpty() ? otro : Color.parseColor(c);
        } catch (IllegalArgumentException e) {
            return otro;
        }
    }

    private static synchronized void cargar(Context c) {
        if (cargado) return;
        cargado = true;
        hay = false;
        String json = DatosWidget.leerTema(c);
        if (json == null) return;
        try {
            JSONObject o = new JSONObject(json);
            JSONObject t = o.optJSONObject("tema");
            if (t != null) {
                fondo = colorDe(t, "fondo", Color.WHITE);
                texto = colorDe(t, "texto", Color.BLACK);
                tenue = colorDe(t, "tenue", Color.GRAY);
                suave = colorDe(t, "suave", Color.LTGRAY);
                acento = colorDe(t, "acento", Color.BLUE);
                sobreAcento = colorDe(t, "sobreAcento", Color.WHITE);
                hay = true;
            }
            JSONObject a = o.optJSONObject("aspecto");
            if (a != null) {
                transparencia = Math.max(0, Math.min(90, a.optInt("transparencia", transparencia)));
                esquinas = Math.max(0, Math.min(48, a.optInt("esquinas", esquinas)));
            }
        } catch (Exception e) {
            hay = false;
        }
    }

    /** El color del tema que reemplaza a ese recurso, o null si se usa el del recurso. */
    static Integer color(Context c, int recurso) {
        cargar(c);
        if (!hay) return null;
        if (recurso == R.color.widget_texto) return texto;
        if (recurso == R.color.widget_texto_tenue) return tenue;
        if (recurso == R.color.widget_acento) return acento;
        if (recurso == R.color.widget_boton_texto) return sobreAcento;
        if (recurso == R.color.widget_barra_fondo || recurso == R.color.widget_evento_suave) return suave;
        if (recurso == R.color.widget_fondo) return fondo;
        return null;
    }

    private static int de(Context c, int recurso) {
        return FabricaListaHoy.color(c, recurso);
    }

    /** Tiñe el fondo de una vista (botón, insignia, día de la tira…). Solo desde Android 12. */
    static void tenirFondo(RemoteViews vista, int id, int color) {
        if (Build.VERSION.SDK_INT >= 31) vista.setColorStateList(id, "setBackgroundTintList", ColorStateList.valueOf(color));
    }

    /** Título, botón "+" y texto de "vacío" de un widget de lista. */
    static void cabecera(Context c, RemoteViews vista, int titulo, int boton, int vacio) {
        vista.setTextColor(titulo, de(c, R.color.widget_texto));
        vista.setTextColor(boton, de(c, R.color.widget_boton_texto));
        tenirFondo(vista, boton, de(c, R.color.widget_acento));
        vista.setTextColor(vacio, de(c, R.color.widget_texto_tenue));
    }

    /** Barra de progreso con los colores del tema. */
    static void barra(Context c, RemoteViews vista, int id) {
        if (Build.VERSION.SDK_INT >= 31) {
            vista.setColorStateList(id, "setProgressTintList", ColorStateList.valueOf(de(c, R.color.widget_acento)));
            vista.setColorStateList(id, "setProgressBackgroundTintList", ColorStateList.valueOf(de(c, R.color.widget_barra_fondo)));
        }
    }

    /** Dibuja el fondo del widget (color del tema, transparencia y esquinas) en la imagen fondo_widget. */
    static void fondo(Context c, AppWidgetManager gestor, int idWidget, RemoteViews vista) {
        cargar(c);
        float densidad = c.getResources().getDisplayMetrics().density;
        Bundle opciones = gestor.getAppWidgetOptions(idWidget);
        int anchoDp = opciones.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
        int altoDp = opciones.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 250);
        if (anchoDp <= 0) anchoDp = 250;
        if (altoDp <= 0) altoDp = 250;
        // La imagen se estira entera: misma proporción que el widget y tamaño acotado para no gastar memoria.
        float escala = Math.min(densidad, 700f / Math.max(anchoDp, altoDp));
        int ancho = Math.max(1, Math.round(anchoDp * escala));
        int alto = Math.max(1, Math.round(altoDp * escala));
        Bitmap imagen = Bitmap.createBitmap(ancho, alto, Bitmap.Config.ARGB_8888);
        Canvas lienzo = new Canvas(imagen);
        Paint pintura = new Paint(Paint.ANTI_ALIAS_FLAG);
        int base = de(c, R.color.widget_fondo);
        int alfa = Math.round(255 * (1 - transparencia / 100f));
        pintura.setColor(Color.argb(alfa, Color.red(base), Color.green(base), Color.blue(base)));
        float radio = Math.min(esquinas * escala, Math.min(ancho, alto) / 2f);
        lienzo.drawRoundRect(new RectF(0, 0, ancho, alto), radio, radio, pintura);
        vista.setImageViewBitmap(R.id.fondo_widget, imagen);
    }
}
