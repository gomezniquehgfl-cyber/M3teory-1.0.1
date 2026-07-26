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
    public void activarModoGaming(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
            call.reject("SIN_PERMISO");
            return;
        }

        String serverUrl = call.getString("serverUrl", "http://10.0.2.2:3000");
        getContext().getSharedPreferences("MeteoryPrefs", Context.MODE_PRIVATE)
            .edit()
            .putString("serverUrl", serverUrl)
            .apply();

        llamadaGuardada = call;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            android.media.projection.MediaProjectionManager mpm = (android.media.projection.MediaProjectionManager) 
                getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            Intent captureIntent = mpm.createScreenCaptureIntent();
            startActivityForResult(call, captureIntent, CODIGO_PANTALLA);
        } else {
            iniciarServicios(android.app.Activity.RESULT_CANCELED, null);
            call.resolve();
        }
    }

    @PluginMethod
    public void desactivarModoGaming(PluginCall call) {
        getContext().stopService(new Intent(getContext(), ServicioBolitaFlotante.class));
        getContext().stopService(new Intent(getContext(), ServicioEscaneoPantalla.class));
        call.resolve();
    }

    private void iniciarServicios(int resultCode, Intent data) {
        Context ctx = getContext();
        boolean isScanningActive = (resultCode == android.app.Activity.RESULT_OK && data != null);

        // Start ServicioBolitaFlotante
        Intent bolitaIntent = new Intent(ctx, ServicioBolitaFlotante.class);
        bolitaIntent.putExtra("isScanningActive", isScanningActive);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(bolitaIntent);
        } else {
            ctx.startService(bolitaIntent);
        }

        // Start ServicioEscaneoPantalla if accepted
        if (isScanningActive) {
            Intent escaneoIntent = new Intent(ctx, ServicioEscaneoPantalla.class);
            escaneoIntent.putExtra("resultCode", resultCode);
            escaneoIntent.putExtra("data", data);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(escaneoIntent);
            } else {
                ctx.startService(escaneoIntent);
            }
        }

        if (getActivity() != null) {
            getActivity().moveTaskToBack(true);
        }
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode == CODIGO_PERMISO && llamadaGuardada != null) {
            boolean ok = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(getContext());
            if (ok) llamadaGuardada.resolve();
            else llamadaGuardada.reject("PERMISO_DENEGADO");
            llamadaGuardada = null;
        } else if (requestCode == CODIGO_PANTALLA && llamadaGuardada != null) {
            iniciarServicios(resultCode, data);
            llamadaGuardada.resolve();
            llamadaGuardada = null;
        }
    }
}
