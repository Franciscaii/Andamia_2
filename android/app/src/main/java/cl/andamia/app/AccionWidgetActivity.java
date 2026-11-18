package cl.andamia.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/**
 * Recibe los toques en las filas del widget. "Completar" se anota y el widget se redibuja sin abrir
 * la app; el interruptor de un hábito lo marca igual, directo desde el widget; "abrir" lleva a la tarea
 * dentro de Andamia.
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
            // andamia://habito/ID/AAAA-MM-DD/1 (hecho) o /0 (sin marcar): se anota y el widget se redibuja,
            // sin abrir nada (dentro de un widget Android solo deja tocar, no arrastrar).
            java.util.List<String> partes = datos.getPathSegments();
            if (partes.size() == 3) {
                boolean hecho = "1".equals(partes.get(2));
                DatosWidget.marcarHabito(this, partes.get(0), partes.get(1), hecho);
                Widgets.redibujarTodo(this);
                WidgetPlugin.avisarRapida();
                // Al completar un hábito, confeti sobre la pantalla de inicio.
                if (hecho && DatosWidget.confetiActivo(this)) {
                    Intent confeti = new Intent(this, ConfetiActivity.class);
                    confeti.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION);
                    // El confeti sale del círculo del interruptor (a la derecha del cuadro tocado), si la pantalla de inicio dice dónde fue el toque.
                    android.graphics.Rect zona = getIntent().getSourceBounds();
                    if (zona != null && zona.width() > 0) {
                        float d = getResources().getDisplayMetrics().density;
                        confeti.putExtra("x", zona.right - 15 * d);
                        confeti.putExtra("y", zona.exactCenterY());
                    }
                    startActivity(confeti);
                }
            }
        } else if (datos != null && "desplegar".equals(datos.getHost())) {
            // andamia://desplegar/habitos/ID_WIDGET: abre o cierra el desplegable de hábitos del widget Semana.
            java.util.List<String> partes = datos.getPathSegments();
            if (partes.size() == 2) {
                try {
                    DatosWidget.alternarHabitos(this, Integer.parseInt(partes.get(1)));
                    Widgets.redibujarTodo(this);
                } catch (NumberFormatException e) {
                    // Dirección mal formada: no se hace nada.
                }
            }
        } else if (datos != null && "editar".equals(datos.getHost())) {
            // andamia://editar/tarea|evento|habito/ID: la ventana para cambiarlo o borrarlo, sin abrir Andamia.
            java.util.List<String> partes = datos.getPathSegments();
            if (partes.size() == 2) {
                Intent editar = new Intent(this, NuevaRapidaActivity.class);
                editar.putExtra("editar_tipo", partes.get(0));
                editar.putExtra("editar_id", partes.get(1));
                editar.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(editar);
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
