package com.meteory.ia;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

public class ServicioEscaneoPantalla extends Service {
    private static final String CANAL = "CANAL_ESCANEO_METEORY";

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        crearCanal();
        iniciarForeground();
    }

    private void crearCanal() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CANAL, "Escaneo Meteory", NotificationManager.IMPORTANCE_LOW);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private void iniciarForeground() {
        Notification.Builder notifBuilder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ?
                new Notification.Builder(this, CANAL) : new Notification.Builder(this);
        Notification notif = notifBuilder
            .setContentTitle("Meteory IA Vision")
            .setContentText("Análisis de pantalla activo")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .build();
        startForeground(8888, notif);
    }
}
