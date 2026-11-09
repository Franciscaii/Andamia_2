package cl.andamia.app;

import android.content.Context;
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
        HoyWidget.redibujarTodos(contexto);
        call.resolve();
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
