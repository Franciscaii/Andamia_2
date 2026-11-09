package cl.andamia.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Puente con el widget "Hoy" de la pantalla de inicio.
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
