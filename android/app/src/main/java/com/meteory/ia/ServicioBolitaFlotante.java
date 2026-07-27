package com.meteory.ia;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import android.text.method.ScrollingMovementMethod;
import android.view.Choreographer;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
import android.widget.AdapterView;
import java.util.HashMap;
import java.util.Locale;

public class ServicioBolitaFlotante extends Service {

    private WindowManager wm;
    private View bolita;
    private View panelChat;
    private TextView tvFps;
    private View viewEstadoEscaneo;
    private EditText etPregunta;
    private TextView tvRespuesta;
    
    // HUD panel views
    private TextView tvRendimiento;
    private TextView tvFpsPanel;
    private TextView tvGama;
    private Button btnEco;
    private TextView tvJuegoDetectado;
    private Spinner spinnerJuego;
    
    private WindowManager.LayoutParams params;
    private WindowManager.LayoutParams chatParams;
    private final Handler ui = new Handler(Looper.getMainLooper());

    private Choreographer.FrameCallback frameCallback;
    private long lastFrameTimeNanos = 0;
    private int frameCount = 0;

    private GestureDetector gestureDetector;
    private TextToSpeech tts;
    private AudioManager am;
    private AudioFocusRequest foco;
    private Vibrator vibrator;
    private boolean isChatOpen = false;
    private boolean isScanningActive = true;
    private boolean isEcoMode = false;
    private long lastSpeakTime = 0;
    private String manualGameSelect = "Auto-Detectar";

    private View burbuja;
    private WindowManager.LayoutParams burbujaParams;
    private boolean isBurbujaVisible = false;

    private BroadcastReceiver receptorRespuesta = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent != null) {
                if ("METEORY_RESPUESTA_GEMINI".equals(intent.getAction())) {
                    String resp = intent.getStringExtra("respuesta");
                    if (resp != null && !resp.isEmpty()) {
                        mostrarRespuesta(resp);
                    }
                } else if ("METEORY_MOSTRAR_BURBUJA".equals(intent.getAction())) {
                    String texto = intent.getStringExtra("texto");
                    boolean autoSpeak = intent.getBooleanExtra("autoSpeak", false);
                    if (texto != null && !texto.isEmpty()) {
                        long now = System.currentTimeMillis();
                        // Enforce 20-second interval only on spontaneous comments, not direct button clicks
                        if (!autoSpeak || (now - lastSpeakTime >= 20000)) {
                            if (autoSpeak) {
                                lastSpeakTime = now;
                            }
                            mostrarBurbujaFlotante(texto);
                        }
                    }
                } else if ("METEORY_OCULTAR_BOLITA".equals(intent.getAction())) {
                    if (bolita != null && wm != null) {
                        try {
                            wm.removeView(bolita);
                        } catch (Exception e) {}
                    }
                    if (panelChat != null && wm != null && isChatOpen) {
                        try {
                            wm.removeView(panelChat);
                        } catch (Exception e) {}
                        isChatOpen = false;
                    }
                    ocultarBurbujaFlotante();
                } else if ("METEORY_MOSTRAR_BOLITA".equals(intent.getAction())) {
                    if (bolita != null && wm != null) {
                        try {
                            wm.removeView(bolita);
                        } catch (Exception e) {}
                        try {
                            wm.addView(bolita, params);
                        } catch (Exception e) {}
                    }
                } else if ("METEORY_RESULTADO_VISION".equals(intent.getAction())) {
                    String jsonStr = intent.getStringExtra("json");
                    if (jsonStr != null && !jsonStr.isEmpty()) {
                        try {
                            org.json.JSONObject data = new org.json.JSONObject(jsonStr);
                            String app = data.optString("app_o_juego", "desconocido");
                            String queHace = data.optString("que_hace", "");
                            String bienMal = data.optString("bien_mal_normal", "NORMAL");
                            String comentario = data.optString("comentario_meteory", "");
                            boolean hablar = data.optBoolean("deberia_hablar", false);

                            // Update detected App text in our HUD panel
                            if (tvJuegoDetectado != null) {
                                String juegoActual = "Auto-Detectar".equals(manualGameSelect) ? app : manualGameSelect;
                                String conEmoji = obtenerEmojiJuego(juegoActual) + juegoActual;
                                if (!"Auto-Detectar".equals(manualGameSelect)) {
                                    conEmoji += " (Manual)";
                                }
                                tvJuegoDetectado.setText(conEmoji);
                            }

                            // Update performance text
                            if (tvRendimiento != null) {
                                tvRendimiento.setText("Rendimiento: " + bienMal);
                            }

                            // Trigger spontaneous speech bubbles
                            if (hablar && !comentario.isEmpty()) {
                                Intent bubbleIntent = new Intent("METEORY_MOSTRAR_BURBUJA");
                                bubbleIntent.putExtra("texto", comentario);
                                bubbleIntent.putExtra("autoSpeak", true);
                                sendBroadcast(bubbleIntent);
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                }
            }
        }
    };

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            isScanningActive = intent.getBooleanExtra("isScanningActive", true);
        }
        return START_STICKY;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        am = (AudioManager) getSystemService(AUDIO_SERVICE);
        vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);

        inicializarTTS();
        crearNotificacionPrimerPlano();
        crearBolita();
        crearPanelChat();
        iniciarMedidorFPS();

        IntentFilter filter = new IntentFilter();
        filter.addAction("METEORY_RESPUESTA_GEMINI");
        filter.addAction("METEORY_MOSTRAR_BURBUJA");
        filter.addAction("METEORY_RESULTADO_VISION");
        filter.addAction("METEORY_OCULTAR_BOLITA");
        filter.addAction("METEORY_MOSTRAR_BOLITA");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(receptorRespuesta, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(receptorRespuesta, filter);
        }
    }

    private void inicializarTTS() {
        tts = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                if (status == TextToSpeech.SUCCESS && tts != null) {
                    int r = tts.setLanguage(new Locale("es", "ES"));
                    if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                        tts.setLanguage(Locale.getDefault());
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        tts.setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
                    }
                    tts.setPitch(0.92f); // Male pitch
                    tts.setSpeechRate(0.98f); // Humans rate
                }
            }
        });
    }

    private void hablarTexto(String texto) {
        if (tts == null || texto == null || texto.trim().isEmpty()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && am != null) {
            foco = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()).build();
            am.requestAudioFocus(foco);
        }
        String cleanText = texto.replaceAll("\\*+", "").replaceAll("#+", "").replaceAll("\\u0060+", "").trim();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Bundle b = new Bundle();
            b.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_MUSIC);
            tts.speak(cleanText, TextToSpeech.QUEUE_FLUSH, b, "METEORY_BOLITA");
        } else {
            HashMap<String, String> p = new HashMap<>();
            p.put(TextToSpeech.Engine.KEY_PARAM_STREAM, String.valueOf(AudioManager.STREAM_MUSIC));
            tts.speak(cleanText, TextToSpeech.QUEUE_FLUSH, p);
        }
    }

    private void crearNotificacionPrimerPlano() {
        String id = "CANAL_FPS";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel c = new NotificationChannel(id, "FPS Meteory", NotificationManager.IMPORTANCE_LOW);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(c);
        }
        Notification.Builder nb = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ?
                new Notification.Builder(this, id) : new Notification.Builder(this);
        
        Notification notif = nb.setContentTitle("🎮 Meteory IA Modo Gaming")
                .setContentText("Monitor FPS y Asistente activo")
                .setSmallIcon(android.R.drawable.ic_menu_view)
                .build();

        if (Build.VERSION.SDK_INT >= 34) { // Android 14+ (UPSIDE_DOWN_CAKE)
            startForeground(3030, notif, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(3030, notif);
        }
    }

    private void crearBolita() {
        int layoutResId = getResources().getIdentifier("vista_bolita_fps", "layout", getPackageName());
        if (layoutResId != 0) {
            bolita = LayoutInflater.from(this).inflate(layoutResId, null);
            tvFps = bolita.findViewById(getResources().getIdentifier("tv_fps", "id", getPackageName()));
            viewEstadoEscaneo = bolita.findViewById(getResources().getIdentifier("view_estado_escaneo", "id", getPackageName()));
        }
        if (tvFps == null) {
            tvFps = new TextView(this);
            bolita = tvFps;
            tvFps.setText("60 FPS");
            tvFps.setTextColor(Color.parseColor("#00FF88"));
            tvFps.setTextSize(13);
            tvFps.setTypeface(null, android.graphics.Typeface.BOLD);
            tvFps.setPadding(24, 14, 24, 14);
            int resId = getResources().getIdentifier("fondo_bolita", "drawable", getPackageName());
            if (resId != 0) tvFps.setBackgroundResource(resId);
            else tvFps.setBackgroundColor(Color.parseColor("#E60A0E1A"));
        }

        int tipo = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_PHONE;

        params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                tipo,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = 60;
        params.y = 250;

        gestureDetector = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onSingleTapConfirmed(MotionEvent e) {
                togglePanelChat();
                return true;
            }

            @Override
            public boolean onDoubleTap(MotionEvent e) {
                if (tts != null) tts.stop();
                if (vibrator != null) {
                    vibrator.vibrate(20);
                }
                return true;
            }

            @Override
            public void onLongPress(MotionEvent e) {
                isScanningActive = !isScanningActive;
                if (vibrator != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        vibrator.vibrate(android.os.VibrationEffect.createOneShot(30, android.os.VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        vibrator.vibrate(30);
                    }
                }
                
                if (viewEstadoEscaneo != null) {
                    int drawId = getResources().getIdentifier(isScanningActive ? "fondo_estado_activo" : "fondo_estado_pausado", "drawable", getPackageName());
                    if (drawId != 0) {
                        viewEstadoEscaneo.setBackgroundResource(drawId);
                    }
                }
                
                Intent scanStateIntent = new Intent("METEORY_SET_SCANNING_ACTIVE");
                scanStateIntent.putExtra("active", isScanningActive);
                sendBroadcast(scanStateIntent);
                
                String msg = isScanningActive ? "🟢 Escaneo activado" : "🔴 Escaneo pausado";
                hablarTexto(msg);
            }
        });

        bolita.setOnTouchListener(new View.OnTouchListener() {
            int xIni, yIni; float xT, yT;
            @Override public boolean onTouch(View v, MotionEvent e) {
                gestureDetector.onTouchEvent(e);
                switch (e.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        xIni = params.x; yIni = params.y; xT = e.getRawX(); yT = e.getRawY();
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        int dx = (int)(e.getRawX() - xT);
                        int dy = (int)(e.getRawY() - yT);
                        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                            params.x = xIni + dx;
                            params.y = yIni + dy;
                            if (wm != null && bolita != null) {
                                wm.updateViewLayout(bolita, params);
                            }
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (wm != null && bolita != null) {
                            int screenWidth = getResources().getDisplayMetrics().widthPixels;
                            params.x = (params.x < screenWidth / 2) ? 30 : (screenWidth - bolita.getWidth() - 30);
                            try { wm.updateViewLayout(bolita, params); } catch (Exception ex) {}
                        }
                        return true;
                }
                return false;
            }
        });

        if (wm != null) {
            wm.addView(bolita, params);
        }
    }

    private void crearPanelChat() {
        int chatLayoutId = getResources().getIdentifier("vista_panel_chat_flotante", "layout", getPackageName());
        if (chatLayoutId != 0) {
            panelChat = LayoutInflater.from(this).inflate(chatLayoutId, null);
            etPregunta = panelChat.findViewById(getResources().getIdentifier("et_pregunta", "id", getPackageName()));
            tvRespuesta = panelChat.findViewById(getResources().getIdentifier("tv_respuesta", "id", getPackageName()));
            View btnCerrar = panelChat.findViewById(getResources().getIdentifier("btn_cerrar", "id", getPackageName()));
            Button btnEnviar = panelChat.findViewById(getResources().getIdentifier("btn_enviar", "id", getPackageName()));
            Button btnConsejo = panelChat.findViewById(getResources().getIdentifier("btn_consejo", "id", getPackageName()));
            Button btnRisa = panelChat.findViewById(getResources().getIdentifier("btn_risa", "id", getPackageName()));
            Button btnBurla = panelChat.findViewById(getResources().getIdentifier("btn_burla", "id", getPackageName()));
            Button btnAnalizar = panelChat.findViewById(getResources().getIdentifier("btn_analizar", "id", getPackageName()));

            // Find new HUD elements
            tvRendimiento = panelChat.findViewById(getResources().getIdentifier("tv_rendimiento", "id", getPackageName()));
            tvFpsPanel = panelChat.findViewById(getResources().getIdentifier("tv_fps_panel", "id", getPackageName()));
            tvGama = panelChat.findViewById(getResources().getIdentifier("tv_gama", "id", getPackageName()));
            btnEco = panelChat.findViewById(getResources().getIdentifier("btn_eco", "id", getPackageName()));
            tvJuegoDetectado = panelChat.findViewById(getResources().getIdentifier("tv_juego_detectado", "id", getPackageName()));
            spinnerJuego = panelChat.findViewById(getResources().getIdentifier("spinner_juego", "id", getPackageName()));

            if (tvRespuesta != null) tvRespuesta.setMovementMethod(new ScrollingMovementMethod());

            if (btnCerrar != null) {
                btnCerrar.setOnClickListener(new View.OnClickListener() {
                    @Override public void onClick(View v) { togglePanelChat(); }
                });
            }

            if (btnEnviar != null) {
                btnEnviar.setOnClickListener(new View.OnClickListener() {
                    @Override public void onClick(View v) {
                        String txt = etPregunta != null ? etPregunta.getText().toString().trim() : "";
                        if (txt.isEmpty()) txt = "Dame un consejo estelar para ganar.";
                        procesarConsulta(txt);
                        if (etPregunta != null) etPregunta.setText("");
                    }
                });
            }

            if (btnConsejo != null) {
                btnConsejo.setOnClickListener(new View.OnClickListener() {
                    @Override public void onClick(View v) {
                        procesarConsulta("Dame un consejo táctico espacial.");
                    }
                });
            }

            if (btnRisa != null) {
                btnRisa.setOnClickListener(new View.OnClickListener() {
                    @Override public void onClick(View v) {
                        procesarConsulta("Dime un chiste o broma espacial graciosa.");
                    }
                });
            }

            if (btnBurla != null) {
                btnBurla.setOnClickListener(new View.OnClickListener() {
                    @Override public void onClick(View v) {
                        procesarConsulta("Hazme una burla amigable e inteligente sobre mi juego.");
                    }
                });
            }

            if (btnAnalizar != null) {
                btnAnalizar.setOnClickListener(new View.OnClickListener() {
                    @Override public void onClick(View v) {
                        tvRespuesta.setText("⏳ Analizando tu pantalla en vivo...");
                        Intent intent = new Intent("METEORY_FORZAR_ESCANEO");
                        sendBroadcast(intent);
                    }
                });
            }

            // Spinner setup for manual game overrides
            if (spinnerJuego != null) {
                final String[] juegos = {"Auto-Detectar", "Free Fire", "Minecraft", "Roblox", "Call of Duty", "PUBG", "Brawl Stars", "Clash Royale", "TikTok", "Escritorio"};
                ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, juegos);
                adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
                spinnerJuego.setAdapter(adapter);
                spinnerJuego.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
                    @Override
                    public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                        manualGameSelect = juegos[position];
                        if (tvJuegoDetectado != null) {
                            if ("Auto-Detectar".equals(manualGameSelect)) {
                                tvJuegoDetectado.setText("Buscando...");
                            } else {
                                tvJuegoDetectado.setText(manualGameSelect + " (Manual)");
                            }
                        }
                        if (position > 0) {
                            hablarTexto("Cargando perfil táctico para " + manualGameSelect);
                        }
                    }
                    @Override public void onNothingSelected(AdapterView<?> parent) {}
                });
            }

            // ECO Mode button handler
            if (btnEco != null) {
                btnEco.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        isEcoMode = !isEcoMode;
                        if (isEcoMode) {
                            btnEco.setText("ECO: ON");
                            btnEco.setBackgroundColor(Color.parseColor("#00FF88"));
                            hablarTexto("Ahorro estelar encendido.");
                        } else {
                            btnEco.setText("ECO: OFF");
                            btnEco.setBackgroundColor(Color.parseColor("#FF4444"));
                            hablarTexto("Modo rendimiento absoluto.");
                        }
                        Intent ecoIntent = new Intent("METEORY_CAMBIAR_INTERVALO");
                        ecoIntent.putExtra("intervalo", isEcoMode ? 10000 : 5000);
                        sendBroadcast(ecoIntent);
                    }
                });
            }
        }

        int tipo = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_PHONE;

        chatParams = new WindowManager.LayoutParams(
                (int)(getResources().getDisplayMetrics().widthPixels * 0.85),
                WindowManager.LayoutParams.WRAP_CONTENT,
                tipo,
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
        );
        chatParams.gravity = Gravity.TOP | Gravity.START;
    }

    private void togglePanelChat() {
        if (wm == null || panelChat == null) return;
        if (isChatOpen) {
            try { wm.removeView(panelChat); } catch (Exception e) {}
            isChatOpen = false;
        } else {
            int screenWidth = getResources().getDisplayMetrics().widthPixels;
            int screenHeight = getResources().getDisplayMetrics().heightPixels;

            chatParams.x = (params.x < screenWidth / 2) ? params.x + 10 : params.x - chatParams.width + 10;
            if (chatParams.x < 20) chatParams.x = 20;
            if (chatParams.x + chatParams.width > screenWidth - 20) chatParams.x = screenWidth - chatParams.width - 20;

            chatParams.y = params.y + 60;
            if (chatParams.y + 400 > screenHeight) chatParams.y = screenHeight - 450;
            if (chatParams.y < 50) chatParams.y = 50;

            try {
                wm.addView(panelChat, chatParams);
                isChatOpen = true;
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    private void enviarPreguntaBackend(final String prompt) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String serverUrl = getSharedPreferences("MeteoryPrefs", MODE_PRIVATE)
                        .getString("serverUrl", "");
                    if (serverUrl == null || serverUrl.isEmpty()) return;
                    
                    String apiEndPoint = serverUrl + "/api/chat";
                    java.net.URL url = new java.net.URL(apiEndPoint);
                    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setDoOutput(true);
                    
                    String escapedPrompt = prompt.replace("\"", "\\\"");
                    String jsonPayload = "{\"message\":\"" + escapedPrompt + "\"}";
                    
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
                        final String responseText = jsonObj.optString("text", "");
                        
                        ui.post(new Runnable() {
                            @Override
                            public void run() {
                                mostrarRespuesta(responseText);
                            }
                        });
                    }
                    conn.disconnect();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }).start();
    }

    private void procesarConsulta(String prompt) {
        if (tvRespuesta != null) tvRespuesta.setText("⏳ Meteory IA procesando...");
        enviarPreguntaBackend(prompt);
    }

    private void mostrarRespuesta(String texto) {
        if (tvRespuesta != null) {
            tvRespuesta.setText(texto);
        }
        hablarTexto(texto);
    }

    private void mostrarBurbujaFlotante(final String texto) {
        if (wm == null) return;
        
        ocultarBurbujaFlotante();
        
        int bubbleLayoutId = getResources().getIdentifier("vista_burbuja_respuesta", "layout", getPackageName());
        if (bubbleLayoutId == 0) return;
        
        burbuja = LayoutInflater.from(this).inflate(bubbleLayoutId, null);
        TextView tvBurbuja = burbuja.findViewById(getResources().getIdentifier("tv_burbuja_texto", "id", getPackageName()));
        if (tvBurbuja != null) {
            tvBurbuja.setText(texto);
        }
        
        int tipo = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_PHONE;
                
        burbujaParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                tipo,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
        );
        burbujaParams.gravity = Gravity.TOP | Gravity.START;
        
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        if (params.x < screenWidth / 2) {
            burbujaParams.x = params.x + (bolita != null ? bolita.getWidth() : 100) + 15;
        } else {
            burbujaParams.x = params.x - 520;
            if (burbujaParams.x < 15) burbujaParams.x = 15;
        }
        burbujaParams.y = params.y;
        
        try {
            wm.addView(burbuja, burbujaParams);
            isBurbujaVisible = true;
            
            // Speak bubble out loud as well
            hablarTexto(texto);
            
            ui.postDelayed(new Runnable() {
                @Override
                public void run() {
                    ocultarBurbujaFlotante();
                }
            }, 4000);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    private void ocultarBurbujaFlotante() {
        if (isBurbujaVisible && wm != null && burbuja != null) {
            try {
                wm.removeView(burbuja);
            } catch (Exception e) {}
            isBurbujaVisible = false;
            burbuja = null;
        }
    }

    private String obtenerEmojiJuego(String juego) {
        if (juego == null) return "🎮 ";
        String j = juego.toLowerCase(Locale.ROOT);
        if (j.contains("free fire")) return "🔥 ";
        if (j.contains("minecraft")) return "⛏️ ";
        if (j.contains("roblox")) return "🧱 ";
        if (j.contains("call of duty") || j.contains("cod")) return "🔫 ";
        if (j.contains("pubg")) return "🪂 ";
        if (j.contains("brawl stars")) return "🌟 ";
        if (j.contains("clash royale")) return "👑 ";
        if (j.contains("tiktok") || j.contains("youtube")) return "📹 ";
        if (j.contains("escritorio") || j.contains("desktop") || j.contains("inicio")) return "📱 ";
        if (j.contains("desconocido")) return "❓ ";
        return "🎮 ";
    }

    private void iniciarMedidorFPS() {
        frameCallback = new Choreographer.FrameCallback() {
            @Override
            public void doFrame(long frameTimeNanos) {
                if (lastFrameTimeNanos > 0) {
                    frameCount++;
                    long diffNanos = frameTimeNanos - lastFrameTimeNanos;
                    if (diffNanos >= 1000000000L) {
                        final int realFps = (int) Math.round((frameCount * 1000000000.0) / diffNanos);
                        frameCount = 0;
                        lastFrameTimeNanos = frameTimeNanos;
                        ui.post(new Runnable() {
                            @Override public void run() {
                                if (tvFps != null) {
                                    tvFps.setText(String.valueOf(realFps));
                                    int color = realFps >= 55 ? Color.parseColor("#00FF88") :
                                                realFps >= 35 ? Color.parseColor("#FFD700") :
                                                Color.parseColor("#FF4444");
                                    tvFps.setTextColor(color);
                                }
                                // Sync FPS display in the opened panel as well
                                if (tvFpsPanel != null) {
                                    tvFpsPanel.setText(realFps + " FPS");
                                    int color = realFps >= 55 ? Color.parseColor("#00FF88") :
                                                realFps >= 35 ? Color.parseColor("#FFD700") :
                                                Color.parseColor("#FF4444");
                                    tvFpsPanel.setTextColor(color);
                                }
                            }
                        });
                    }
                } else {
                    lastFrameTimeNanos = frameTimeNanos;
                }
                Choreographer.getInstance().postFrameCallback(this);
            }
        };

        ui.post(new Runnable() {
            @Override
            public void run() {
                Choreographer.getInstance().postFrameCallback(frameCallback);
            }
        });
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        ocultarBurbujaFlotante();
        try { unregisterReceiver(receptorRespuesta); } catch (Exception e) {}
        if (frameCallback != null) {
            try { Choreographer.getInstance().removeFrameCallback(frameCallback); } catch (Exception e) {}
        }
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        if (bolita != null && wm != null) {
            try { wm.removeView(bolita); } catch (Exception e) {}
        }
        if (panelChat != null && wm != null && isChatOpen) {
            try { wm.removeView(panelChat); } catch (Exception e) {}
        }
    }
}
