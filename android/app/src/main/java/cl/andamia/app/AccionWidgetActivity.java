package cl.andamia.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/**
 * Recibe los toques en las filas del widget. "Completar" (o marcar un hábito) se anota y el widget se
 * redibuja sin abrir la app; "abrir" lleva a la tarea dentro de Andamia.
 */
public class AccionWidgetActivity extends Activity {
    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        Uri datos = getIntent().getData();
        if (datos != null && "completar".equals(datos.getHost())) {
            String id = datos.getLastPathSegment();
            if (id != null) {
                DatosWidget.marcarCompletada(this, id);
                Widgets.redibujarTodo(this);
            }
        } else if (datos != null && "habito".equals(datos.getHost())) {
            // andamia://habito/ID/AAAA-MM-DD/1 (hecho) o /0 (sin marcar).
            java.util.List<String> partes = datos.getPathSegments();
            if (partes.size() == 3) {
                DatosWidget.marcarHabito(this, partes.get(0), partes.get(1), "1".equals(partes.get(2)));
                Widgets.redibujarTodo(this);
            }
        } else if (datos != null) {
            Intent abrir = new Intent(Intent.ACTION_VIEW, datos, this, MainActivity.class);
            abrir.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(abrir);
        }
        finish();
        overridePendingTransition(0, 0);
    }
}
