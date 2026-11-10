package cl.andamia.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StrikethroughSpan;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Arma las filas del widget a partir de lo que guardó la app, igual que la semana:
 * primero los eventos, luego la barra de progreso del día y después las tareas.
 */
class FabricaListaHoy implements RemoteViewsService.RemoteViewsFactory {
    private static final int TIPO_EVENTO = 0;
    private static final int TIPO_PROGRESO = 1;
    private static final int TIPO_TAREA = 2;
    private static final int TIPO_SECCION = 3;

    static final class Fila {
        int tipo;
        String id = "";
        String titulo = "";
        String detalle = "";
        boolean atrasada;
        boolean hecha;
        int prioridad;
        int dificultad;
        String etiqueta = "";
        String colorEtiqueta = "";
        String color = "";
    }

    private final Context contexto;
    private final List<Fila> filas = new ArrayList<>();
    private int hechas;
    private int total;

    FabricaListaHoy(Context contexto) {
        this.contexto = contexto;
    }

    private void cargar() {
        filas.clear();
        hechas = 0;
        total = 0;
        String json = DatosWidget.leerTareas(contexto);
        if (json == null) return;
        Set<String> marcadas = DatosWidget.leerCompletadas(contexto);
        try {
            JSONObject datos = new JSONObject(json);
            String hoy = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            boolean deOtroDia = !hoy.equals(datos.optString("fecha"));

            JSONArray eventos = datos.optJSONArray("eventos");
            // Los eventos de otro día ya pasaron.
            if (eventos != null && !deOtroDia) {
                for (int i = 0; i < eventos.length(); i++) {
                    JSONObject e = eventos.getJSONObject(i);
                    Fila f = new Fila();
                    f.tipo = TIPO_EVENTO;
                    f.id = e.optString("id");
                    f.titulo = e.optString("titulo");
                    f.detalle = e.optString("hora");
                    f.color = e.optString("color");
                    filas.add(f);
                }
            }

            List<Fila> deTareas = new ArrayList<>();
            JSONArray tareas = datos.optJSONArray("tareas");
            if (tareas != null) {
                for (int i = 0; i < tareas.length(); i++) {
                    JSONObject t = tareas.getJSONObject(i);
                    String id = t.optString("id");
                    if (id.isEmpty()) continue;
                    boolean hecha = t.optBoolean("hecha") || marcadas.contains(id);
                    // De un día anterior solo queda lo pendiente, que ya está atrasado.
                    if (deOtroDia && hecha) continue;
                    Fila f = new Fila();
                    f.tipo = TIPO_TAREA;
                    f.id = id;
                    f.titulo = t.optString("titulo");
                    f.detalle = t.optString("detalle");
                    f.hecha = hecha;
                    f.atrasada = !hecha && (t.optBoolean("atrasada") || deOtroDia);
                    f.prioridad = t.optInt("prioridad");
                    f.dificultad = t.optInt("dificultad");
                    f.etiqueta = t.optString("etiqueta");
                    f.colorEtiqueta = t.optString("colorEtiqueta");
                    deTareas.add(f);
                    total++;
                    if (hecha) hechas++;
                }
            }

            if (total > 0) {
                Fila progreso = new Fila();
                progreso.tipo = TIPO_PROGRESO;
                filas.add(progreso);
            }
            // Pendientes primero; las completadas abajo, bajo "Completada".
            boolean conSeccion = false;
            for (Fila f : deTareas) if (!f.hecha) filas.add(f);
            for (Fila f : deTareas) {
                if (!f.hecha) continue;
                if (!conSeccion) {
                    Fila seccion = new Fila();
                    seccion.tipo = TIPO_SECCION;
                    filas.add(seccion);
                    conSeccion = true;
                }
                filas.add(f);
            }
        } catch (Exception e) {
            filas.clear();
            hechas = 0;
            total = 0;
        }
    }

    @Override public void onCreate() { cargar(); }
    @Override public void onDataSetChanged() { cargar(); }
    @Override public void onDestroy() { filas.clear(); }
    @Override public int getCount() { return filas.size(); }
    @Override public RemoteViews getLoadingView() { return null; }
    @Override public int getViewTypeCount() { return 4; }
    @Override public long getItemId(int posicion) { return posicion; }
    @Override public boolean hasStableIds() { return false; }

    static int color(Context contexto, int recurso) {
        return contexto.getResources().getColor(recurso, contexto.getTheme());
    }

    /** Rojo, amarillo o azul según el nivel (3 alta, 2 media, 1 baja). */
    static int colorNivel(Context contexto, int nivel) {
        switch (nivel) {
            case 3: return color(contexto, R.color.widget_nivel_alta);
            case 2: return color(contexto, R.color.widget_nivel_media);
            case 1: return color(contexto, R.color.widget_nivel_baja);
            default: return color(contexto, R.color.widget_texto_tenue);
        }
    }

    static String nombreNivel(int nivel) {
        switch (nivel) {
            case 3: return "Alta";
            case 2: return "Media";
            case 1: return "Baja";
            default: return "";
        }
    }

    static RemoteViews filaEvento(Context contexto, Fila f) {
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_evento);
        vista.setTextViewText(R.id.evento_titulo, f.titulo);
        vista.setTextViewText(R.id.evento_hora, f.detalle);
        vista.setViewVisibility(R.id.evento_hora, f.detalle.isEmpty() ? View.GONE : View.VISIBLE);
        int colorEvento = color(contexto, R.color.widget_evento);
        try {
            if (!f.color.isEmpty()) colorEvento = Color.parseColor(f.color);
        } catch (IllegalArgumentException e) {
            // Color desconocido: se queda el morado.
        }
        vista.setInt(R.id.evento_color, "setBackgroundColor", colorEvento);
        Intent abrir = new Intent();
        abrir.setData(Uri.parse("andamia://tarea/" + Uri.encode(f.id)));
        vista.setOnClickFillInIntent(R.id.evento_fila, abrir);
        return vista;
    }

    private RemoteViews filaProgreso() {
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_progreso);
        int porcentaje = total == 0 ? 0 : Math.round(hechas * 100f / total);
        vista.setProgressBar(R.id.progreso_barra, 100, porcentaje, false);
        vista.setTextViewText(R.id.progreso_texto, hechas + "/" + total + " (" + porcentaje + "%)");
        Intent abrir = new Intent();
        abrir.setData(Uri.parse("andamia://hoy"));
        vista.setOnClickFillInIntent(R.id.progreso_fila, abrir);
        return vista;
    }

    static RemoteViews filaTarea(Context contexto, Fila f) {
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_fila);

        if (f.hecha) {
            SpannableString tachado = new SpannableString(f.titulo);
            tachado.setSpan(new StrikethroughSpan(), 0, tachado.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            vista.setTextViewText(R.id.fila_titulo, tachado);
            vista.setTextColor(R.id.fila_titulo, color(contexto, R.color.widget_texto_tenue));
        } else {
            vista.setTextViewText(R.id.fila_titulo, f.titulo);
            vista.setTextColor(R.id.fila_titulo, color(contexto, R.color.widget_texto));
        }

        // Casilla: color de la importancia.
        vista.setTextViewText(R.id.fila_circulo, f.hecha ? "☑" : "☐");
        vista.setTextColor(R.id.fila_circulo, colorNivel(contexto, f.prioridad));

        // Insignia bajo el título: dificultad.
        String dificultad = nombreNivel(f.dificultad);
        vista.setTextViewText(R.id.fila_importancia, dificultad);
        vista.setTextColor(R.id.fila_importancia, colorNivel(contexto, f.dificultad));
        vista.setViewVisibility(R.id.fila_importancia, dificultad.isEmpty() ? View.GONE : View.VISIBLE);

        String detalle = f.atrasada ? (f.detalle.isEmpty() ? "Atrasada" : "Atrasada · " + f.detalle) : f.detalle;
        vista.setTextViewText(R.id.fila_detalle, detalle);
        vista.setViewVisibility(R.id.fila_detalle, detalle.isEmpty() ? View.GONE : View.VISIBLE);
        vista.setTextColor(R.id.fila_detalle, color(contexto, f.atrasada ? R.color.widget_atrasada : R.color.widget_texto_tenue));

        // Etiqueta del ámbito, con su color.
        vista.setTextViewText(R.id.fila_etiqueta, f.etiqueta);
        vista.setViewVisibility(R.id.fila_etiqueta, f.etiqueta.isEmpty() ? View.GONE : View.VISIBLE);
        int colorEtiqueta = color(contexto, R.color.widget_texto_tenue);
        try {
            if (!f.colorEtiqueta.isEmpty()) colorEtiqueta = Color.parseColor(f.colorEtiqueta);
        } catch (IllegalArgumentException e) {
            // Color desconocido: se queda el gris.
        }
        vista.setTextColor(R.id.fila_etiqueta, colorEtiqueta);

        if (!f.hecha) {
            Intent marcar = new Intent();
            marcar.setData(Uri.parse("andamia://completar/" + Uri.encode(f.id)));
            vista.setOnClickFillInIntent(R.id.fila_circulo, marcar);
        }

        Intent abrir = new Intent();
        abrir.setData(Uri.parse("andamia://tarea/" + Uri.encode(f.id)));
        vista.setOnClickFillInIntent(R.id.fila_texto, abrir);
        return vista;
    }

    @Override
    public RemoteViews getViewAt(int posicion) {
        if (posicion >= filas.size()) return new RemoteViews(contexto.getPackageName(), R.layout.widget_fila);
        Fila f = filas.get(posicion);
        switch (f.tipo) {
            case TIPO_EVENTO: return filaEvento(contexto, f);
            case TIPO_PROGRESO: return filaProgreso();
            case TIPO_SECCION: return new RemoteViews(contexto.getPackageName(), R.layout.widget_seccion);
            default: return filaTarea(contexto, f);
        }
    }
}
