package cl.andamia.app;

import android.content.Intent;
import android.widget.RemoteViewsService;

/** Entrega las filas de los widgets "Semana" y "Matriz" (la clave, y en Semana el día, vienen en el intent). */
public class ServicioFilas extends RemoteViewsService {
    static final String EXTRA_CLAVE = "cl.andamia.app.CLAVE";
    static final String EXTRA_DIA = "cl.andamia.app.DIA_LISTA";

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new FabricaFilas(getApplicationContext(), intent.getStringExtra(EXTRA_CLAVE), intent.getIntExtra(EXTRA_DIA, -1));
    }
}
