package cl.andamia.app;

import android.content.Intent;
import android.widget.RemoteViewsService;

/** Entrega las filas de los widgets "Semana" y "Matriz" (la clave viene en el intent). */
public class ServicioFilas extends RemoteViewsService {
    static final String EXTRA_CLAVE = "cl.andamia.app.CLAVE";

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new FabricaFilas(getApplicationContext(), intent.getStringExtra(EXTRA_CLAVE));
    }
}
