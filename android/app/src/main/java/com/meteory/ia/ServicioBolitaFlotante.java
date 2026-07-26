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
import java.util.HashMap;
import java.util.Locale;

public class ServicioBolitaFlotante extends Service {

    private WindowManager wm;
    private View bolita;
    private View panelChat;
    private TextView tvFps;
    private EditText etPregunta;
    private TextView tvRespuesta;
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

    private BroadcastReceiver receptorRespuesta = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent != null && "METEORY_RESPUESTA_GEMINI".equals(intent.getAction())) {
                String resp = intent.getStringExtra("respuesta");
                if (resp != null && !resp.isEmpty()) {
                    mostrarRespuesta(resp);
                }
            }
        }
    };

    @Override
    public IBinder onBind(Intent intent) { return null; }

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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(receptorRespuesta, new IntentFilter("METEORY_RESPUESTA_GEMINI"), Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(receptorRespuesta, new IntentFilter("METEORY_RESPUESTA_GEMINI"));
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
                    tts.setPitch(1.05f);
                    tts.setSpeechRate(1.0f);
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Bundle b = new Bundle();
            b.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_MUSIC);
            tts.speak(texto, TextToSpeech.QUEUE_FLUSH, b, "METEORY_BOLITA");
        } else {
            HashMap<String, String> p = new HashMap<>();
            p.put(TextToSpeech.Engine.KEY_PARAM_STREAM, String.valueOf(AudioManager.STREAM_MUSIC));
            tts.speak(texto, TextToSpeech.QUEUE_FLUSH, p);
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
        startForeground(3030, nb.setContentTitle("🎮 Meteory IA Modo Gaming")
                .setContentText("Monitor FPS y Asistente activo")
                .setSmallIcon(android.R.drawable.ic_menu_view).build());
    }

    private void crearBolita() {
        int layoutResId = getResources().getIdentifier("vista_bolita_fps", "layout", getPackageName());
        if (layoutResId != 0) {
            bolita = LayoutInflater.from(this).inflate(layoutResId, null);
            tvFps = bolita.findViewById(getResources().getIdentifier("tv_fps", "id", getPackageName()));
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
            else tvFps.setBackgroundColor(Color.parseColor("#E6000000"));
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
                if (vibrator != null) vibrator.vibrate(20);
                return true;
            }

            @Override
            public void onLongPress(MotionEvent e) {
                isScanningActive = !isScanningActive;
                if (vibrator != null) vibrator.vibrate(40);
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
                        if (txt.isEmpty()) txt = "Dame un consejo para ganar";
                        procesarConsulta(txt);
                        if (etPregunta != null) etPregunta.setText("");
                    }
                });
            }

            if (btnConsejo != null) {
                btnConsejo.setOnClickListener(new View.OnClickListener() {
                    @Override public void onClick(View v) {
                        String frase = BaseConocimientoJuegos.obtenerFrase("FREE_FIRE", "REC");
                        mostrarRespuesta("✨ Consejo: " + frase);
                    }
                });
            }

            if (btnRisa != null) {
                btnRisa.setOnClickListener(new View.OnClickListener() {
                    @Override public void onClick(View v) {
                        String frase = BaseConocimientoJuegos.obtenerFrase("FREE_FIRE", "RISA");
                        mostrarRespuesta("😂 " + frase);
                    }
                });
            }

            if (btnBurla != null) {
                btnBurla.setOnClickListener(new View.OnClickListener() {
                    @Override public void onClick(View v) {
                        String frase = BaseConocimientoJuegos.obtenerFrase("FREE_FIRE", "BURLA");
                        mostrarRespuesta("😏 " + frase);
                    }
                });
            }

            if (btnAnalizar != null) {
                btnAnalizar.setOnClickListener(new View.OnClickListener() {
                    @Override public void onClick(View v) {
                        procesarConsulta("Analiza lo que ves en mi pantalla ahora mismo y dame un resumen muy corto");
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

    private void procesarConsulta(String prompt) {
        if (tvRespuesta != null) tvRespuesta.setText("⏳ Meteory IA procesando...");
        Intent i = new Intent("METEORY_ENVIAR_GEMINI");
        i.putExtra("prompt", prompt);
        sendBroadcast(i);

        ui.postDelayed(new Runnable() {
            @Override public void run() {
                if (tvRespuesta != null && tvRespuesta.getText().toString().startsWith("⏳")) {
                    String fallback = BaseConocimientoJuegos.obtenerFrase("FREE_FIRE", "REC");
                    mostrarRespuesta("✨ Meteory: " + fallback);
                }
            }
        }, 1200);
    }

    private void mostrarRespuesta(String texto) {
        if (tvRespuesta != null) {
            tvRespuesta.setText(texto);
        }
        hablarTexto(texto);
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
                                    String scanIcon = isScanningActive ? " 🟢" : " 🔴";
                                    tvFps.setText(realFps + " FPS" + scanIcon);
                                    int color = realFps >= 55 ? Color.parseColor("#00FF88") :
                                                realFps >= 35 ? Color.parseColor("#FFD700") :
                                                Color.parseColor("#FF4444");
                                    tvFps.setTextColor(color);
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
