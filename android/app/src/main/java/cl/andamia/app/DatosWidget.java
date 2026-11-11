package cl.andamia.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.HashSet;
import java.util.Set;

/** Lo que el widget necesita guardar entre una apertura de la app y la siguiente. */
final class DatosWidget {
    private static final String ARCHIVO = "andamia_widget";
    private static final String CLAVE_TAREAS = "tareas";
    private static final String CLAVE_COMPLETADAS = "completadas";

    private DatosWidget() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE);
    }

    static void guardarTareas(Context c, String json) {
        prefs(c).edit().putString(CLAVE_TAREAS, json).apply();
    }

    static void guardarTema(Context c, String json) {
        prefs(c).edit().putString("tema", json).apply();
    }

    static String leerTema(Context c) {
        return prefs(c).getString("tema", null);
    }

    static String leerTareas(Context c) {
        return prefs(c).getString(CLAVE_TAREAS, null);
    }

    /** Día (AAAA-MM-DD) que se eligió en un widget Semana. */
    static void elegirDia(Context c, int idWidget, String fecha) {
        prefs(c).edit().putString("dia_" + idWidget, fecha).apply();
    }

    static String diaElegido(Context c, int idWidget) {
        return prefs(c).getString("dia_" + idWidget, "");
    }

    static synchronized void marcarCompletada(Context c, String id) {
        Set<String> ids = new HashSet<>(prefs(c).getStringSet(CLAVE_COMPLETADAS, new HashSet<>()));
        ids.add(id);
        prefs(c).edit().putStringSet(CLAVE_COMPLETADAS, ids).apply();
    }

    static synchronized Set<String> leerCompletadas(Context c) {
        return new HashSet<>(prefs(c).getStringSet(CLAVE_COMPLETADAS, new HashSet<>()));
    }

    static synchronized Set<String> tomarCompletadas(Context c) {
        Set<String> ids = leerCompletadas(c);
        prefs(c).edit().remove(CLAVE_COMPLETADAS).apply();
        return ids;
    }
}
