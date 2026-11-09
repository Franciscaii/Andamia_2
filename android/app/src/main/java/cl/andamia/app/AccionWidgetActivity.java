package cl.andamia.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/**
 * Recibe los toques en las filas del widget. "Completar" se anota y el widget se
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
                HoyWidget.redibujarTodos(this);
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
