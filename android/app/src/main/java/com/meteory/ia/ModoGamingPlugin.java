package com.meteory.ia;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ModoGaming")
public class ModoGamingPlugin extends Plugin {

    private static final int CODIGO_PERMISO = 1234;
    private static final int CODIGO_PANTALLA = 5678;
    private PluginCall llamadaGuardada;

    @PluginMethod
    public void verificarPermiso(PluginCall call) {
        boolean tienePermiso = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            tienePermiso = Settings.canDrawOverlays(getContext());
        }
        JSObject res = new JSObject();
        res.put("activo", tienePermiso);
        call.resolve(res);
    }

    @PluginMethod
    public void solicitarPermiso(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
            llamadaGuardada = call;
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            if (Build.MANUFACTURER.toUpperCase().contains("HONOR") || 
                Build.MANUFACTURER.toUpperCase().contains("HUAWEI")) {
                intent.putExtra("com.huawei.permission.overlay", true);
            }
            startActivityForResult(call, intent, CODIGO_PERMISO);
        } else {
            call.resolve();
        }
    }

    @PluginMethod
    public void activarModoGaming(final PluginCall call) {
        String serverUrl = call.getString("serverUrl", "http://10.0.2.2:3000");
        getContext().getSharedPreferences("MeteoryPrefs", Context.MODE_PRIVATE)
            .edit()
            .putString("serverUrl", serverUrl)
            .apply();

        if (getActivity() != null && getActivity() instanceof MainActivity) {
            final MainActivity act = (MainActivity) getActivity();
            getActivity().runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    act.verificarPermisosYIniciarModoGaming(call);
                }
            });
        } else {
            call.reject("MainActivity no disponible");
        }
    }

    @PluginMethod
    public void desactivarModoGaming(PluginCall call) {
        getContext().stopService(new Intent(getContext(), ServicioBolitaFlotante.class));
        getContext().stopService(new Intent(getContext(), ServicioEscaneoPantalla.class));
        call.resolve();
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode == CODIGO_PERMISO && llamadaGuardada != null) {
            boolean ok = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(getContext());
            if (ok) llamadaGuardada.resolve();
            else llamadaGuardada.reject("PERMISO_DENEGADO");
            llamadaGuardada = null;
        }
    }
}
