package br.com.cobeb.ciclocarretas;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CobebGpsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
