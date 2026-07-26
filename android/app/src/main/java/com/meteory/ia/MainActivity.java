package com.meteory.ia;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ModoGamingPlugin.class);
        registerPlugin(VozPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
