package cl.andamia.app;

import android.content.Context;
import android.graphics.Color;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Filas de los widgets "Semana" y "Matriz". La app ya las manda armadas (secciones,
 * eventos y tareas) bajo la clave "semana" o "matriz"; aquí solo se dibujan.
 */
class FabricaFilas implements RemoteViewsService.RemoteViewsFactory {
    private static final int TIPO_SECCION = 0;
    private static final int TIPO_EVENTO = 1;
    private static final int TIPO_TAREA = 2;

    private static final class Seccion {
        String titulo = "";
        boolean hoy;
        int nivel;
    }

    private final Context contexto;
    private final String clave;
    private final List<Object> filas = new ArrayList<>();
    private int acento;

    /** En Semana (vista Día): solo las filas de ese día (0 = lunes), sin su título. -1 = todo. */
    private final int dia;

    FabricaFilas(Context contexto, String clave, int dia) {
        this.contexto = contexto;
        this.clave = clave == null ? "semana" : clave;
        this.dia = dia;
    }

    private void cargar() {
        filas.clear();
        acento = FabricaListaHoy.color(contexto, R.color.widget_acento);
        String json = DatosWidget.leerTareas(contexto);
        if (json == null) return;
        Set<String> marcadas = DatosWidget.leerCompletadas(contexto);
        try {
            JSONObject datos = new JSONObject(json);
            String colorAcento = datos.optString("acento");
            if (!colorAcento.isEmpty()) acento = Color.parseColor(colorAcento);
            JSONArray lista = datos.optJSONArray(clave);
            if (lista == null) return;
            int seccionActual = -1;
            for (int i = 0; i < lista.length(); i++) {
                JSONObject o = lista.getJSONObject(i);
                String tipo = o.optString("tipo");
                if ("seccion".equals(tipo)) seccionActual++;
                if (dia >= 0) {
                    // Vista Día: se saltan los títulos y lo de los otros días.
                    if ("seccion".equals(tipo) || seccionActual != dia) continue;
                }
                if ("seccion".equals(tipo)) {
                    Seccion s = new Seccion();
                    s.titulo = o.optString("titulo");
                    s.hoy = o.optBoolean("hoy");
                    s.nivel = o.optInt("nivel", -1);
                    filas.add(s);
                } else {
                    FabricaListaHoy.Fila f = new FabricaListaHoy.Fila();
                    f.id = o.optString("id");
                    f.titulo = o.optString("titulo");
                    if ("evento".equals(tipo)) {
                        f.tipo = TIPO_EVENTO;
                        f.detalle = o.optString("hora");
                        f.color = o.optString("color");
                    } else {
                        f.tipo = TIPO_TAREA;
                        f.detalle = o.optString("detalle");
                        f.hecha = o.optBoolean("hecha") || marcadas.contains(f.id);
                        f.atrasada = !f.hecha && o.optBoolean("atrasada");
                        f.prioridad = o.optInt("prioridad");
                        f.dificultad = o.optInt("dificultad");
                        f.etiqueta = o.optString("etiqueta");
                        f.colorEtiqueta = o.optString("colorEtiqueta");
                    }
                    filas.add(f);
                }
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
    @Override public int getViewTypeCount() { return 3; }
    @Override public long getItemId(int posicion) { return posicion; }
    @Override public boolean hasStableIds() { return false; }

    private RemoteViews seccion(Seccion s) {
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_seccion);
        vista.setTextViewText(R.id.seccion_titulo, s.titulo);
        int color = s.hoy ? acento
                : s.nivel >= 0 ? FabricaListaHoy.colorNivel(contexto, s.nivel)
                : FabricaListaHoy.color(contexto, R.color.widget_texto);
        vista.setTextColor(R.id.seccion_titulo, color);
        return vista;
    }

    @Override
    public RemoteViews getViewAt(int posicion) {
        if (posicion >= filas.size()) return new RemoteViews(contexto.getPackageName(), R.layout.widget_seccion);
        Object fila = filas.get(posicion);
        if (fila instanceof Seccion) return seccion((Seccion) fila);
        FabricaListaHoy.Fila f = (FabricaListaHoy.Fila) fila;
        return f.tipo == TIPO_EVENTO ? FabricaListaHoy.filaEvento(contexto, f) : FabricaListaHoy.filaTarea(contexto, f);
    }
}
