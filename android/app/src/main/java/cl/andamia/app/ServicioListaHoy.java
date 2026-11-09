package cl.andamia.app;

import android.content.Intent;
import android.widget.RemoteViewsService;

public class ServicioListaHoy extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new FabricaListaHoy(getApplicationContext());
    }
}
