package com.meteory.ia;

import android.content.Intent;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Toast;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginCall;

public class MainActivity extends BridgeActivity {

    private MediaProjectionManager mProjectionManager;
    private MediaProjection mMediaProjection;
    private ActivityResultLauncher<Intent> lanzadorSuperposicion;
    private ActivityResultLauncher<Intent> lanzadorCaptura;
    private PluginCall mCall;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ModoGamingPlugin.class);
        registerPlugin(VozPlugin.class);
        super.onCreate(savedInstanceState);

        // Ocultar bolita al abrir la app en primer plano
        try {
            Intent intentOcultar = new Intent("METEORY_OCULTAR_BOLITA");
            sendBroadcast(intentOcultar);
        } catch (Exception e) {}

        // Registrar lanzador para permiso de superposición
        lanzadorSuperposicion = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    if (Settings.canDrawOverlays(this)) {
                        pedirPermisoCaptura();
                    } else {
                        if (mCall != null) {
                            mCall.reject("SIN_PERMISO_SUPERPOSICION");
                        }
                        Toast.makeText(this, "Permiso de superposición denegado", Toast.LENGTH_SHORT).show();
                    }
                } else {
                    pedirPermisoCaptura();
                }
            }
        );

        // Registrar lanzador para captura de pantalla (MediaProjection)
        lanzadorCaptura = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                int resultCode = result.getResultCode();
                Intent data = result.getData();
                if (resultCode == android.app.Activity.RESULT_OK && data != null) {
                    mProjectionManager = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
                    mMediaProjection = mProjectionManager.getMediaProjection(resultCode, data);
                    iniciarServiciosModoGaming();
                    if (mCall != null) {
                        mCall.resolve();
                    }
                    // Esperar 700ms antes de cerrar la app completamente para que se dibuje la bolita
                    new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                        cerrarAppCompletamente();
                    }, 700);
                } else {
                    if (mCall != null) {
                        mCall.reject("PERMISO_CAPTURA_DENEGADO");
                    }
                    Toast.makeText(this, "Necesitas permitir la captura de pantalla para escanear y recibir consejos en vivo", Toast.LENGTH_LONG).show();
                }
            }
        );
    }

    public void verificarPermisosYIniciarModoGaming(PluginCall call) {
        this.mCall = call;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
            intent.setData(Uri.parse("package:" + getPackageName()));
            lanzadorSuperposicion.launch(intent);
        } else {
            pedirPermisoCaptura();
        }
    }

    private void pedirPermisoCaptura() {
        mProjectionManager = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        if (mProjectionManager != null) {
            lanzadorCaptura.launch(mProjectionManager.createScreenCaptureIntent());
        }
    }

    private void iniciarServiciosModoGaming() {
        Intent iBolita = new Intent(this, ServicioBolitaFlotante.class);
        iBolita.putExtra("isScanningActive", true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(iBolita);
        } else {
            startService(iBolita);
        }

        ServicioEscaneoPantalla.tokenMediaProjection = mMediaProjection;
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            Intent iEscaneo = new Intent(this, ServicioEscaneoPantalla.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(iEscaneo);
            } else {
                startService(iEscaneo);
            }
        }, 300);
    }

    private void cerrarAppCompletamente() {
        try {
            Intent intentMostrar = new Intent("METEORY_MOSTRAR_BOLITA");
            sendBroadcast(intentMostrar);
        } catch (Exception e) {}
        moveTaskToBack(true);
        finishAffinity();
        finishAndRemoveTask();
    }

    @Override
    protected void onResume() {
        super.onResume();
        try {
            Intent intentOcultar = new Intent("METEORY_OCULTAR_BOLITA");
            sendBroadcast(intentOcultar);
        } catch (Exception e) {}
    }

    @Override
    protected void onPause() {
        super.onPause();
        try {
            Intent intentMostrar = new Intent("METEORY_MOSTRAR_BOLITA");
            sendBroadcast(intentMostrar);
        } catch (Exception e) {}
    }
}
