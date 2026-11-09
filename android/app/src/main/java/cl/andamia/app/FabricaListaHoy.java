package cl.andamia.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
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

/** Arma las filas de la lista del widget a partir de lo que guardó la app. */
class FabricaListaHoy implements RemoteViewsService.RemoteViewsFactory {
    private static final class Fila {
        String id;
        String titulo;
        String detalle;
        boolean atrasada;
        int prioridad;
    }

    private final Context contexto;
    private final List<Fila> filas = new ArrayList<>();

    FabricaListaHoy(Context contexto) {
        this.contexto = contexto;
    }

    int cantidadVisible() {
        cargar();
        return filas.size();
    }

    private void cargar() {
        filas.clear();
        String json = DatosWidget.leerTareas(contexto);
        if (json == null) return;
        Set<String> hechas = DatosWidget.leerCompletadas(contexto);
        try {
            JSONObject datos = new JSONObject(json);
            String hoy = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            boolean deOtroDia = !hoy.equals(datos.optString("fecha"));
            JSONArray tareas = datos.optJSONArray("tareas");
            if (tareas == null) return;
            for (int i = 0; i < tareas.length(); i++) {
                JSONObject t = tareas.getJSONObject(i);
                String id = t.optString("id");
                if (id.isEmpty() || hechas.contains(id)) continue;
                Fila f = new Fila();
                f.id = id;
                f.titulo = t.optString("titulo");
                f.detalle = t.optString("detalle");
                // Si los datos son de un día anterior, todo lo pendiente ya está atrasado.
                f.atrasada = t.optBoolean("atrasada") || deOtroDia;
                f.prioridad = t.optInt("prioridad");
                filas.add(f);
            }
        } catch (Exception e) {
            filas.clear();
        }
    }

    @Override public void onCreate() { cargar(); }
    @Override public void onDataSetChanged() { cargar(); }
    @Override public void onDestroy() { filas.clear(); }
    @Override public int getCount() { return filas.size(); }
    @Override public RemoteViews getLoadingView() { return null; }
    @Override public int getViewTypeCount() { return 1; }
    @Override public long getItemId(int posicion) { return posicion; }
    @Override public boolean hasStableIds() { return false; }

    private int colorCirculo(int prioridad) {
        switch (prioridad) {
            case 3: return R.color.widget_prioridad_alta;
            case 2: return R.color.widget_prioridad_media;
            case 1: return R.color.widget_prioridad_baja;
            default: return R.color.widget_texto_tenue;
        }
    }

    @Override
    public RemoteViews getViewAt(int posicion) {
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_fila);
        if (posicion >= filas.size()) return vista;
        Fila f = filas.get(posicion);
        vista.setTextViewText(R.id.fila_titulo, f.titulo);
        String detalle = f.atrasada ? (f.detalle.isEmpty() ? "Atrasada" : "Atrasada · " + f.detalle) : f.detalle;
        vista.setTextViewText(R.id.fila_detalle, detalle);
        vista.setViewVisibility(R.id.fila_detalle, detalle.isEmpty() ? android.view.View.GONE : android.view.View.VISIBLE);
        vista.setTextColor(R.id.fila_detalle, contexto.getResources().getColor(
                f.atrasada ? R.color.widget_atrasada : R.color.widget_texto_tenue, contexto.getTheme()));
        vista.setTextColor(R.id.fila_circulo, contexto.getResources().getColor(colorCirculo(f.prioridad), contexto.getTheme()));

        Intent marcar = new Intent();
        marcar.setData(Uri.parse("andamia://completar/" + Uri.encode(f.id)));
        vista.setOnClickFillInIntent(R.id.fila_circulo, marcar);

        Intent abrir = new Intent();
        abrir.setData(Uri.parse("andamia://tarea/" + Uri.encode(f.id)));
        vista.setOnClickFillInIntent(R.id.fila_texto, abrir);
        return vista;
    }
}
