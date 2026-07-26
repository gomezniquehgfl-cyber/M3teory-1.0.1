package com.meteory.ia;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.WindowManager;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

public class ServicioEscaneoPantalla extends Service {
    private static final String CANAL = "CANAL_ESCANEO_METEORY";
    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private boolean isScanningActive = true;
    private final Handler handler = new Handler(Looper.getMainLooper());
    
    private int screenDensity = 320;
    private static final int captureWidth = 720;
    private static final int captureHeight = 1280;

    private final Runnable captureRunnable = new Runnable() {
        @Override
        public void run() {
            if (isScanningActive) {
                capturarYAnalizar();
            }
            handler.postDelayed(this, 5000);
        }
    };

    private final BroadcastReceiver scanStateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent != null) {
                if ("METEORY_SET_SCANNING_ACTIVE".equals(intent.getAction())) {
                    isScanningActive = intent.getBooleanExtra("active", true);
                } else if ("METEORY_FORZAR_ESCANEO".equals(intent.getAction())) {
                    capturarYAnalizar();
                }
            }
        }
    };

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        crearCanal();
        iniciarForeground();
        
        IntentFilter filter = new IntentFilter();
        filter.addAction("METEORY_SET_SCANNING_ACTIVE");
        filter.addAction("METEORY_FORZAR_ESCANEO");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(scanStateReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(scanStateReceiver, filter);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            int resultCode = intent.getIntExtra("resultCode", 0);
            Intent data = intent.getParcelableExtra("data");
            if (resultCode != 0 && data != null) {
                iniciarMediaProjection(resultCode, data);
            }
        }
        return START_NOT_STICKY;
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
            
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(8888, notif, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(8888, notif);
        }
    }

    private void iniciarMediaProjection(int resultCode, Intent data) {
        try {
            MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
            mediaProjection = mpm.getMediaProjection(resultCode, data);
            if (mediaProjection != null) {
                WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
                DisplayMetrics metrics = new DisplayMetrics();
                wm.getDefaultDisplay().getRealMetrics(metrics);
                screenDensity = metrics.densityDpi;
                
                imageReader = ImageReader.newInstance(captureWidth, captureHeight, PixelFormat.RGBA_8888, 2);
                virtualDisplay = mediaProjection.createVirtualDisplay(
                    "MeteoryIAVision",
                    captureWidth, captureHeight, screenDensity,
                    DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                    imageReader.getSurface(), null, null
                );
                
                handler.postDelayed(captureRunnable, 5000);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void capturarYAnalizar() {
        if (imageReader == null) return;
        Image image = null;
        try {
            image = imageReader.acquireLatestImage();
            if (image != null) {
                Image.Plane[] planes = image.getPlanes();
                ByteBuffer buffer = planes[0].getBuffer();
                int pixelStride = planes[0].getPixelStride();
                int rowStride = planes[0].getRowStride();
                int rowPadding = rowStride - pixelStride * captureWidth;
                
                Bitmap bitmap = Bitmap.createBitmap(
                    captureWidth + rowPadding / pixelStride,
                    captureHeight,
                    Bitmap.Config.ARGB_8888
                );
                bitmap.copyPixelsFromBuffer(buffer);
                
                Bitmap cleanBitmap = Bitmap.createBitmap(bitmap, 0, 0, captureWidth, captureHeight);
                
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                cleanBitmap.compress(Bitmap.CompressFormat.JPEG, 65, baos);
                byte[] jpegBytes = baos.toByteArray();
                
                bitmap.recycle();
                cleanBitmap.recycle();
                
                enviarAGeminiVision(jpegBytes);
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (image != null) {
                image.close();
            }
        }
    }

    private void enviarAGeminiVision(final byte[] jpegBytes) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String serverUrl = getSharedPreferences("MeteoryPrefs", MODE_PRIVATE)
                        .getString("serverUrl", "");
                    if (serverUrl == null || serverUrl.isEmpty()) return;
                    
                    String apiEndPoint = serverUrl + "/api/analyze-screen";
                    java.net.URL url = new java.net.URL(apiEndPoint);
                    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setDoOutput(true);
                    
                    String base64Image = Base64.encodeToString(jpegBytes, Base64.NO_WRAP);
                    String jsonPayload = "{\"image\":\"" + base64Image + "\"}";
                    
                    java.io.OutputStream os = conn.getOutputStream();
                    os.write(jsonPayload.getBytes("UTF-8"));
                    os.close();
                    
                    int responseCode = conn.getResponseCode();
                    if (responseCode == 200) {
                        java.io.InputStream is = conn.getInputStream();
                        java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(is));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            sb.append(line);
                        }
                        reader.close();
                        
                        org.json.JSONObject jsonObj = new org.json.JSONObject(sb.toString());
                        boolean detected = jsonObj.optBoolean("detected", false);
                        String text = jsonObj.optString("text", "");
                        
                        if (detected && !text.isEmpty()) {
                            Intent intent = new Intent("METEORY_MOSTRAR_BURBUJA");
                            intent.putExtra("texto", text);
                            sendBroadcast(intent);
                        }
                    }
                    conn.disconnect();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }).start();
    }

    private void detenerCaptura() {
        handler.removeCallbacks(captureRunnable);
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
        if (imageReader != null) {
            imageReader.close();
            imageReader = null;
        }
        if (mediaProjection != null) {
            mediaProjection.stop();
            mediaProjection = null;
        }
    }

    @Override
    public void onDestroy() {
        detenerCaptura();
        try { unregisterReceiver(scanStateReceiver); } catch (Exception e) {}
        super.onDestroy();
    }
}
