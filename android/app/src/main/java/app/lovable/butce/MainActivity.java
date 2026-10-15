package app.lovable.butce;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Explicit registration so sign-in and OTA work even if plugin auto-discovery is empty.
        registerPlugin(com.capacitorjs.plugins.browser.BrowserPlugin.class);
        registerPlugin(com.capacitorjs.plugins.app.AppPlugin.class);
        registerPlugin(ee.forgr.capacitor_updater.CapacitorUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
