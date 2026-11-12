package cl.andamia.app;

import android.content.Intent;
import android.app.PendingIntent;
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
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;

/**
 * Tema, transparencia y esquinas de cada widget. Cada widget tiene los suyos (se eligen en el
 * apartado Widgets de la app); mientras no se elijan, usa el tema por defecto que manda la app.
 * Antes de dibujar un widget se llama a usar(), y desde ahí color() devuelve los de ese widget.
 */
final class TemaWidget {
    private TemaWidget() {}

    static final class Paleta {
        boolean hay;
        int fondo, texto, tenue, suave, acento, sobreAcento;
        /** 0 = fondo opaco, 90 = casi invisible. */
        int transparencia = 0;
        /** Radio de las esquinas, en dp. */
        int esquinas = 20;
    }

    private static final Map<Integer, Paleta> porWidget = new HashMap<>();
    private static Paleta porDefecto;
    private static final ThreadLocal<Paleta> actual = new ThreadLocal<>();

    /** La app mandó datos o configuración nuevos: se vuelven a leer en el próximo dibujo. */
    static synchronized void olvidar() {
        porWidget.clear();
        porDefecto = null;
    }

    private static int colorDe(JSONObject o, String clave, int otro) {
        try {
            String c = o.optString(clave);
            return c.isEmpty() ? otro : Color.parseColor(c);
        } catch (IllegalArgumentException e) {
            return otro;
        }
    }

    private static void leerColores(Paleta p, JSONObject t) {
        if (t == null) return;
        p.fondo = colorDe(t, "fondo", Color.WHITE);
        p.texto = colorDe(t, "texto", Color.BLACK);
        p.tenue = colorDe(t, "tenue", Color.GRAY);
        p.suave = colorDe(t, "suave", Color.LTGRAY);
        p.acento = colorDe(t, "acento", Color.BLUE);
        p.sobreAcento = colorDe(t, "sobreAcento", Color.WHITE);
        p.hay = true;
    }

    private static synchronized Paleta defecto(Context c) {
        if (porDefecto != null) return porDefecto;
        Paleta p = new Paleta();
        try {
            String json = DatosWidget.leerTema(c);
            if (json != null) leerColores(p, new JSONObject(json).optJSONObject("tema"));
        } catch (Exception e) {
            p.hay = false;
        }
        porDefecto = p;
        return p;
    }

    static synchronized Paleta paleta(Context c, int idWidget) {
        Paleta guardada = porWidget.get(idWidget);
        if (guardada != null) return guardada;
        Paleta p = defecto(c);
        String json = DatosWidget.leerConfig(c, idWidget);
        if (json == null) {
            // Recién puesto: usa los ajustes de su tipo, si se eligieron en el apartado Widgets.
            String tipo = WidgetPlugin.tipoDe(c, idWidget);
            if (tipo != null) json = DatosWidget.leerConfigTipo(c, tipo);
        }
        if (json != null) {
            try {
                JSONObject o = new JSONObject(json);
                Paleta propia = new Paleta();
                propia.hay = p.hay;
                propia.fondo = p.fondo; propia.texto = p.texto; propia.tenue = p.tenue;
                propia.suave = p.suave; propia.acento = p.acento; propia.sobreAcento = p.sobreAcento;
                leerColores(propia, o.optJSONObject("tema"));
                propia.transparencia = Math.max(0, Math.min(90, o.optInt("transparencia", 0)));
                propia.esquinas = Math.max(0, Math.min(48, o.optInt("esquinas", 20)));
                p = propia;
            } catch (Exception e) {
                // Configuración dañada: queda la de por defecto.
            }
        }
        porWidget.put(idWidget, p);
        return p;
    }

    /** Desde aquí, en este hilo, color() devuelve los colores de ese widget. */
    static Paleta usar(Context c, int idWidget) {
        Paleta p = paleta(c, idWidget);
        actual.set(p);
        return p;
    }

    /** El color del tema que reemplaza a ese recurso, o null si se usa el del recurso. */
    static Integer color(Context c, int recurso) {
        Paleta p = actual.get();
        if (p == null) p = defecto(c);
        if (!p.hay) return null;
        if (recurso == R.color.widget_texto) return p.texto;
        if (recurso == R.color.widget_texto_tenue) return p.tenue;
        if (recurso == R.color.widget_acento) return p.acento;
        if (recurso == R.color.widget_boton_texto) return p.sobreAcento;
        if (recurso == R.color.widget_barra_fondo || recurso == R.color.widget_evento_suave) return p.suave;
        if (recurso == R.color.widget_fondo) return p.fondo;
        return null;
    }

    private static int de(Context c, int recurso) {
        return FabricaListaHoy.color(c, recurso);
    }

    /** Tiñe el fondo de una vista (botón, insignia, tarjeta…). Solo desde Android 12. */
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

    /** Dibuja el fondo del widget (color de su tema, transparencia y esquinas) en la imagen fondo_widget. */
    static void fondo(Context c, AppWidgetManager gestor, int idWidget, RemoteViews vista) {
        Paleta p = usar(c, idWidget);
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
        int alfa = Math.round(255 * (1 - p.transparencia / 100f));
        pintura.setColor(Color.argb(alfa, Color.red(base), Color.green(base), Color.blue(base)));
        float radio = Math.min(p.esquinas * escala, Math.min(ancho, alto) / 2f);
        lienzo.drawRoundRect(new RectF(0, 0, ancho, alto), radio, radio, pintura);
        vista.setImageViewBitmap(R.id.fondo_widget, imagen);
        // Tocar cualquier parte libre del widget abre Andamia.
        vista.setOnClickPendingIntent(R.id.fondo_widget, abrirAndamia(c));
    }

    static PendingIntent abrirAndamia(Context c) {
        Intent intent = new Intent(c, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        return PendingIntent.getActivity(c, 90, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
