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

    /** Si el confeti al completar ese hábito está activado (por defecto sí; se elige en el detalle de cada hábito). */
    static boolean confetiActivo(Context c, String habitoId) {
        try {
            String json = leerTareas(c);
            if (json == null) return true;
            org.json.JSONArray defs = new org.json.JSONObject(json).optJSONArray("habitosDef");
            for (int i = 0; defs != null && i < defs.length(); i++) {
                org.json.JSONObject h = defs.optJSONObject(i);
                if (h != null && habitoId.equals(h.optString("id"))) return h.optBoolean("confeti", true);
            }
            return true;
        } catch (Exception e) {
            return true;
        }
    }

    static String leerTareas(Context c) {
        return prefs(c).getString(CLAVE_TAREAS, null);
    }

    /** Tema, transparencia y esquinas propios de un widget (JSON que arma la app). */
    static void guardarConfig(Context c, int idWidget, String json) {
        prefs(c).edit().putString("config_" + idWidget, json).apply();
    }

    static String leerConfig(Context c, int idWidget) {
        return prefs(c).getString("config_" + idWidget, null);
    }

    /** Ajustes de un tipo de widget (Semana, Calendario...): valen para todos los de ese tipo. */
    static void guardarConfigTipo(Context c, String tipo, String json) {
        prefs(c).edit().putString("config_tipo_" + tipo, json).apply();
    }

    static String leerConfigTipo(Context c, String tipo) {
        return prefs(c).getString("config_tipo_" + tipo, null);
    }

    /** Filtro del widget Semana: "tareas", "eventos" o "todos". */
    static boolean habitosAbiertos(Context c, int idWidget) {
        return prefs(c).getBoolean("habitos_abiertos_" + idWidget, false);
    }

    static void alternarHabitos(Context c, int idWidget) {
        prefs(c).edit().putBoolean("habitos_abiertos_" + idWidget, !habitosAbiertos(c, idWidget)).apply();
    }

    static void elegirFiltro(Context c, int idWidget, String filtro) {
        prefs(c).edit().putString("filtro_" + idWidget, filtro).apply();
    }

    static String filtro(Context c, int idWidget) {
        return prefs(c).getString("filtro_" + idWidget, "todos");
    }

    /** Día (AAAA-MM-DD) que se eligió en un widget Semana. */
    static void elegirDia(Context c, int idWidget, String fecha) {
        prefs(c).edit().putString("dia_" + idWidget, fecha).apply();
    }

    static String diaElegido(Context c, int idWidget) {
        return prefs(c).getString("dia_" + idWidget, "");
    }

    /** Etiqueta (o hábito) destacada en un widget de estadísticas; -1 si ninguna. */
    static void elegirEtiqueta(Context c, int idWidget, int indice) {
        prefs(c).edit().putInt("etiqueta_" + idWidget, indice).apply();
    }

    static int etiquetaElegida(Context c, int idWidget) {
        return prefs(c).getInt("etiqueta_" + idWidget, -1);
    }

    /** Período de un widget de estadísticas: "dia", "semana", "mes" o "anio". */
    static void elegirPeriodo(Context c, int idWidget, String periodo) {
        prefs(c).edit().putString("periodo_" + idWidget, periodo).apply();
    }

    static String periodo(Context c, int idWidget) {
        return prefs(c).getString("periodo_" + idWidget, "anio");
    }

    /** Cuánto se movió con las flechas un widget de estadísticas: "pasos|día en que se movió". */
    static void guardarPasoEstadistica(Context c, int idWidget, String paso) {
        prefs(c).edit().putString("paso_est_" + idWidget, paso).apply();
    }

    static String pasoEstadistica(Context c, int idWidget) {
        return prefs(c).getString("paso_est_" + idWidget, "");
    }

    /**
     * Hábitos marcados (o desmarcados) desde el widget Semana, hasta que la app los anote:
     * un JSON {"idHabito|AAAA-MM-DD": true o false}.
     */
    static synchronized org.json.JSONObject habitosMarcados(Context c) {
        try {
            return new org.json.JSONObject(prefs(c).getString("habitos_marcados", "{}"));
        } catch (Exception e) {
            return new org.json.JSONObject();
        }
    }

    static synchronized void marcarHabito(Context c, String id, String fecha, boolean hecho) {
        org.json.JSONObject o = habitosMarcados(c);
        try {
            o.put(id + "|" + fecha, hecho);
        } catch (Exception e) {
            return;
        }
        prefs(c).edit().putString("habitos_marcados", o.toString()).commit();
    }

    static synchronized String tomarHabitosMarcados(Context c) {
        String s = habitosMarcados(c).toString();
        prefs(c).edit().remove("habitos_marcados").commit();
        return s;
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
