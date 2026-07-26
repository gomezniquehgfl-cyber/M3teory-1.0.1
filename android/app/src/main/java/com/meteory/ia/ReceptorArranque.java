package com.meteory.ia;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class ReceptorArranque extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String accion = intent.getAction();
        if (accion != null && (
            accion.equals(Intent.ACTION_BOOT_COMPLETED) ||
            accion.equals(Intent.ACTION_LOCKED_BOOT_COMPLETED) ||
            accion.equals(Intent.ACTION_MY_PACKAGE_REPLACED)
        )) {
            // ✅ AL ENCENDER EL CELULAR O ACTUALIZAR APP: INICIA LA BOLITA SOLA
            Intent servicio = new Intent(context, ServicioBolitaFlotante.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(servicio);
            } else {
                context.startService(servicio);
            }
        }
    }
}
