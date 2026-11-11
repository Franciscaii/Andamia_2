package cl.andamia.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Set;

/** Puente entre la app (JavaScript) y el widget "Hoy" de la pantalla de inicio. */
@CapacitorPlugin(name = "AndamiaWidget")
public class WidgetPlugin extends Plugin {

    /** Guarda las tareas de hoy que mostrará el widget y lo redibuja. */
    @PluginMethod
    public void actualizar(PluginCall call) {
        String datos = call.getString("datos");
        if (datos == null) {
            call.reject("Faltan los datos del widget");
            return;
        }
        Context contexto = getContext();
        DatosWidget.guardarTareas(contexto, datos);
        try {
            // Tema y aspecto aparte, para leerlos rápido en cada dibujo.
            org.json.JSONObject todo = new org.json.JSONObject(datos);
            org.json.JSONObject tema = new org.json.JSONObject();
            tema.put("tema", todo.optJSONObject("tema"));
            tema.put("aspecto", todo.optJSONObject("aspecto"));
            DatosWidget.guardarTema(contexto, tema.toString());
        } catch (Exception e) {
            // Sin tema: los widgets usan sus colores de siempre.
        }
        TemaWidget.olvidar();
        Widgets.redibujarTodo(contexto);
        call.resolve();
    }

    /** ¿Este celular deja poner widgets en la pantalla de inicio desde la app? */
    @PluginMethod
    public void puedeAnclar(PluginCall call) {
        JSObject respuesta = new JSObject();
        respuesta.put("puede", Build.VERSION.SDK_INT >= 26
                && AppWidgetManager.getInstance(getContext()).isRequestPinAppWidgetSupported());
        call.resolve(respuesta);
    }

    /** Pide al celular poner un widget en la pantalla de inicio (el celular muestra su propio aviso). */
    @PluginMethod
    public void anclar(PluginCall call) {
        String tipo = call.getString("tipo", "");
        Class<?> clase;
        switch (tipo) {
            case "hoy": clase = HoyWidget.class; break;
            case "semana": clase = WidgetSemana.class; break;
            case "matriz": clase = WidgetMatriz.class; break;
            case "calendario": clase = WidgetCalendario.class; break;
            case "estadistica-tareas": clase = WidgetEstadisticaTareas.class; break;
            case "estadistica-habitos": clase = WidgetEstadisticaHabitos.class; break;
            default:
                call.reject("Widget desconocido: " + tipo);
                return;
        }
        JSObject respuesta = new JSObject();
        boolean pedido = false;
        if (Build.VERSION.SDK_INT >= 26) {
            AppWidgetManager gestor = AppWidgetManager.getInstance(getContext());
            if (gestor.isRequestPinAppWidgetSupported()) {
                pedido = gestor.requestPinAppWidget(new ComponentName(getContext(), clase), null, null);
            }
        }
        respuesta.put("pedido", pedido);
        call.resolve(respuesta);
    }

    /** Devuelve (y olvida) las tareas marcadas como hechas desde el widget. */
    @PluginMethod
    public void pendientes(PluginCall call) {
        Set<String> ids = DatosWidget.tomarCompletadas(getContext());
        JSArray lista = new JSArray();
        for (String id : ids) lista.put(id);
        JSObject respuesta = new JSObject();
        respuesta.put("ids", lista);
        call.resolve(respuesta);
    }
}
