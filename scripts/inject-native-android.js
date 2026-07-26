import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const packageDir = path.join(rootDir, 'android/app/src/main/java/com/meteory/ia');
const layoutDir = path.join(rootDir, 'android/app/src/main/res/layout');
const drawableDir = path.join(rootDir, 'android/app/src/main/res/drawable');
const manifestPath = path.join(rootDir, 'android/app/src/main/AndroidManifest.xml');

// Ensure directories exist
fs.mkdirSync(packageDir, { recursive: true });
fs.mkdirSync(layoutDir, { recursive: true });
fs.mkdirSync(drawableDir, { recursive: true });

// 1. ModoGamingPlugin.java
const modoGamingPluginContent = `package com.meteory.ia;

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
        Intent servicio = new Intent(getContext(), ServicioBolitaFlotante.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(servicio);
        } else {
            getContext().startService(servicio);
        }
        if (getActivity() != null) {
            getActivity().moveTaskToBack(true);
        }
        call.resolve();
    }

    @PluginMethod
    public void desactivarModoGaming(PluginCall call) {
        getContext().stopService(new Intent(getContext(), ServicioBolitaFlotante.class));
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
`;
fs.writeFileSync(path.join(packageDir, 'ModoGamingPlugin.java'), modoGamingPluginContent);

// 2. BaseConocimientoJuegos.java
const baseConocimientoContent = `package com.meteory.ia;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Random;

public class BaseConocimientoJuegos {

    private static final HashMap<String, HashMap<String, List<String>>> BASE = new HashMap<>();
    private static final Random RANDOM = new Random();

    static {
        // Free Fire
        HashMap<String, List<String>> ff = new HashMap<>();
        List<String> ffRec = new ArrayList<>();
        ffRec.add("Usa escopeta M1014 a corta distancia en casas.");
        ffRec.add("Coloca la pared Gloo levantando la mira para cubrirte al instante.");
        ffRec.add("Mantén el chaleco al nivel 3 antes de buscar enfrentamientos finales.");
        ff.put("REC", ffRec);

        List<String> ffRisa = new ArrayList<>();
        ffRisa.add("¡Tu personaje corre más rápido que yo cuando hay pizza! 🍕");
        ffRisa.add("Esa pared Gloo pareció una cortina de baño 🛁");
        ff.put("RISA", ffRisa);

        List<String> ffBurla = new ArrayList<>();
        ffBurla.add("¿Te eliminaron con una sartén? ¡Eso sí es nivel leyenda! 😂");
        ffBurla.add("Tranquilo, la pared Gloo te protege del viento por lo menos 😏");
        ff.put("BURLA", ffBurla);
        BASE.put("FREE_FIRE", ff);

        // Minecraft
        HashMap<String, List<String>> mc = new HashMap<>();
        List<String> mcRec = new ArrayList<>();
        mcRec.add("Nunca caves directamente hacia abajo.");
        mcRec.add("Lleva siempre un cubo de agua en el acceso rápido.");
        mc.put("REC", mcRec);

        List<String> mcRisa = new ArrayList<>();
        mcRisa.add("Ese creeper te miró con amor explosivo 🧨");
        mc.put("RISA", mcRisa);

        List<String> mcBurla = new ArrayList<>();
        mcBurla.add("¿Otra vez te explotó la base? Ya eres experto en demoliciones 😏");
        mc.put("BURLA", mcBurla);
        BASE.put("MINECRAFT", mc);

        // Generico
        HashMap<String, List<String>> gen = new HashMap<>();
        List<String> genRec = new ArrayList<>();
        genRec.add("FPS estables: cierra aplicaciones en segundo plano.");
        genRec.add("Activa la optimización gráfica si la batería se agota rápido.");
        gen.put("REC", genRec);

        List<String> genRisa = new ArrayList<>();
        genRisa.add("Tu procesador pide un refresco helado 🍦");
        gen.put("RISA", genRisa);

        List<String> genBurla = new ArrayList<>();
        genBurla.add("Jugaste con tanto estilo que asustaste a tus propios FPS 😏");
        gen.put("BURLA", genBurla);
        BASE.put("GENERICO", gen);
    }

    public static String obtenerFrase(String juego, String tipo) {
        String key = juego != null ? juego.toUpperCase().replace(" ", "_") : "GENERICO";
        if (!BASE.containsKey(key)) {
            key = "GENERICO";
        }
        HashMap<String, List<String>> categorias = BASE.get(key);
        if (categorias != null && categorias.containsKey(tipo)) {
            List<String> lista = categorias.get(tipo);
            if (lista != null && !lista.isEmpty()) {
                return lista.get(RANDOM.nextInt(lista.size()));
            }
        }
        return "¡Sigue jugando con todo el poder de Meteory IA! 🚀";
    }
}
`;
fs.writeFileSync(path.join(packageDir, 'BaseConocimientoJuegos.java'), baseConocimientoContent);

// 3. ServicioBolitaFlotante.java
const servicioBolitaContent = `package com.meteory.ia;

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
`;
fs.writeFileSync(path.join(packageDir, 'ServicioBolitaFlotante.java'), servicioBolitaContent);

// 4. VozPlugin.java
const vozPluginContent = `package com.meteory.ia;

import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashMap;
import java.util.Locale;

@CapacitorPlugin(name = "Voz")
public class VozPlugin extends Plugin {

    private TextToSpeech tts;
    private AudioManager am;
    private AudioFocusRequest foco;

    @Override
    public void load() {
        super.load();
        Context ctx = getContext();
        am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        tts = new TextToSpeech(ctx, new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                if (status == TextToSpeech.SUCCESS) {
                    int result = tts.setLanguage(new Locale("es", "ES"));
                    if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                ctx.startForegroundService(new Intent(ctx, ServicioAudioVoz.class));
            } catch (Exception e) {}
        }
    }

    @PluginMethod
    public void hablar(PluginCall call) {
        String texto = call.getString("texto", "");
        if (tts == null || texto == null || texto.isEmpty()) {
            call.resolve();
            return;
        }

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
            tts.speak(texto, TextToSpeech.QUEUE_FLUSH, b, "METEORY");
        } else {
            HashMap<String, String> p = new HashMap<>();
            p.put(TextToSpeech.Engine.KEY_PARAM_STREAM, String.valueOf(AudioManager.STREAM_MUSIC));
            tts.speak(texto, TextToSpeech.QUEUE_FLUSH, p);
        }
        call.resolve();
    }

    @PluginMethod
    public void callar(PluginCall call) {
        if (tts != null) {
            tts.stop();
        }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && foco != null && am != null) {
            am.abandonAudioFocusRequest(foco);
        }
        try {
            getContext().stopService(new Intent(getContext(), ServicioAudioVoz.class));
        } catch (Exception e) {}
        super.handleOnDestroy();
    }
}
`;
fs.writeFileSync(path.join(packageDir, 'VozPlugin.java'), vozPluginContent);

// 5. ServicioAudioVoz.java
const servicioVozContent = `package com.meteory.ia;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

public class ServicioAudioVoz extends Service {
    private static final String CANAL = "CANAL_VOZ_METEORY";

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
            NotificationChannel channel = new NotificationChannel(CANAL, "Voz Meteory", NotificationManager.IMPORTANCE_LOW);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private void iniciarForeground() {
        Notification.Builder notifBuilder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ?
                new Notification.Builder(this, CANAL) : new Notification.Builder(this);
        Notification notif = notifBuilder
            .setContentTitle("Meteory IA")
            .setContentText("Asistente de voz activo")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .build();
        startForeground(7777, notif);
    }
}
`;
fs.writeFileSync(path.join(packageDir, 'ServicioAudioVoz.java'), servicioVozContent);

// 6. ServicioEscaneoPantalla.java
const servicioEscaneoContent = `package com.meteory.ia;

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
`;
fs.writeFileSync(path.join(packageDir, 'ServicioEscaneoPantalla.java'), servicioEscaneoContent);

// 7. MainActivity.java
const mainActivityContent = `package com.meteory.ia;

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
`;
fs.writeFileSync(path.join(packageDir, 'MainActivity.java'), mainActivityContent);

// 8. Layout XMLs & Drawables
const vistaBolitaXml = `<?xml version="1.0" encoding="utf-8"?>
<TextView xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/tv_fps"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:paddingHorizontal="12dp"
    android:paddingVertical="7dp"
    android:background="@drawable/fondo_bolita"
    android:text="60 FPS"
    android:textColor="#00FF88"
    android:textSize="13sp"
    android:textStyle="bold"
    android:elevation="12dp"
    android:fontFamily="monospace" />
`;
fs.writeFileSync(path.join(layoutDir, 'vista_bolita_fps.xml'), vistaBolitaXml);

const vistaBurbujaXml = `<?xml version="1.0" encoding="utf-8"?>
<TextView xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/tv_burbuja_texto"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:maxWidth="260dp"
    android:paddingHorizontal="14dp"
    android:paddingVertical="10dp"
    android:background="@drawable/fondo_bolita"
    android:textColor="#FFFFFF"
    android:textSize="12sp"
    android:elevation="14dp" />
`;
fs.writeFileSync(path.join(layoutDir, 'vista_burbuja_respuesta.xml'), vistaBurbujaXml);

const vistaPanelChatXml = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="vertical"
    android:padding="12dp"
    android:background="@drawable/fondo_panel_chat"
    android:elevation="16dp">

    <RelativeLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginBottom="8dp">

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="💬 Meteory IA"
            android:textColor="#00FF88"
            android:textSize="14sp"
            android:textStyle="bold"
            android:layout_alignParentLeft="true"
            android:layout_centerVertical="true" />

        <TextView
            android:id="@+id/btn_cerrar"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="✕"
            android:textColor="#FF4444"
            android:textSize="18sp"
            android:textStyle="bold"
            android:paddingHorizontal="8dp"
            android:layout_alignParentRight="true"
            android:layout_centerVertical="true"
            android:clickable="true"
            android:focusable="true" />
    </RelativeLayout>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:layout_marginBottom="8dp">

        <EditText
            android:id="@+id/et_pregunta"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:hint="Pregúntame lo que quieras..."
            android:textColorHint="#88FFFFFF"
            android:textColor="#FFFFFF"
            android:textSize="12sp"
            android:background="#3300E5FF"
            android:padding="8dp"
            android:maxLines="2" />

        <Button
            android:id="@+id/btn_enviar"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="➤"
            android:textColor="#000000"
            android:textSize="14sp"
            android:backgroundTint="#00FF88"
            android:minWidth="40dp"
            android:layout_marginLeft="4dp" />
    </LinearLayout>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:weightSum="4"
        android:layout_marginBottom="8dp">

        <Button
            android:id="@+id/btn_consejo"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="✨ Consejo"
            android:textColor="#00FF88"
            android:textSize="9sp"
            android:backgroundTint="#1A00FF88"
            android:padding="2dp"
            android:insetTop="0dp"
            android:insetBottom="0dp" />

        <Button
            android:id="@+id/btn_risa"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="😂 Risa"
            android:textColor="#FFD700"
            android:textSize="9sp"
            android:backgroundTint="#1AFFD700"
            android:padding="2dp"
            android:insetTop="0dp"
            android:insetBottom="0dp" />

        <Button
            android:id="@+id/btn_burla"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="😏 Burla"
            android:textColor="#FF8800"
            android:textSize="9sp"
            android:backgroundTint="#1AFF8800"
            android:padding="2dp"
            android:insetTop="0dp"
            android:insetBottom="0dp" />

        <Button
            android:id="@+id/btn_analizar"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="📊 Analizar"
            android:textColor="#00E5FF"
            android:textSize="9sp"
            android:backgroundTint="#1A00E5FF"
            android:padding="2dp"
            android:insetTop="0dp"
            android:insetBottom="0dp" />
    </LinearLayout>

    <TextView
        android:id="@+id/tv_respuesta"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:minHeight="60dp"
        android:maxHeight="150dp"
        android:text="Toca una opción o escribe para comenzar."
        android:textColor="#E0FFFFFF"
        android:textSize="11sp"
        android:padding="8dp"
        android:background="#22000000"
        android:scrollbars="vertical" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="💡 Responde con voz en alto"
        android:textColor="#88FFFFFF"
        android:textSize="9sp"
        android:layout_marginTop="4dp"
        android:layout_gravity="right" />
</LinearLayout>
`;
fs.writeFileSync(path.join(layoutDir, 'vista_panel_chat_flotante.xml'), vistaPanelChatXml);

const fondoPanelChatXml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#F20B1021" />
    <corners android:radius="16dp" />
    <stroke
        android:width="2dp"
        android:color="#00E5FF" />
</shape>
`;
fs.writeFileSync(path.join(drawableDir, 'fondo_panel_chat.xml'), fondoPanelChatXml);

const fondoBolitaXml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#E60A0E1A" />
    <corners android:radius="100dp" />
    <stroke
        android:width="2dp"
        android:color="#00E5FF" />
</shape>
`;
fs.writeFileSync(path.join(drawableDir, 'fondo_bolita.xml'), fondoBolitaXml);
fs.writeFileSync(path.join(drawableDir, 'fondo_bolita_fps.xml'), fondoBolitaXml);

// 9. Update AndroidManifest.xml
if (fs.existsSync(manifestPath)) {
  let xml = fs.readFileSync(manifestPath, 'utf8');

  const permissions = `
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.ACCESS_NOTIFICATION_POLICY" />
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.ACTION_MANAGE_OVERLAY_PERMISSION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROCESSING" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
    <uses-permission android:name="android.permission.REAL_GET_PACKAGE_NAME" />
    <uses-permission android:name="android.permission.GET_TOP_ACTIVITY_INFO" />
    <uses-permission android:name="android.permission.KILL_BACKGROUND_PROCESSES" />
    <uses-permission android:name="moe.shizuku.manager.permission.API_V23" />
    <uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />
    <uses-permission android:name="android.permission.WRITE_SETTINGS" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.VIBRATE" />
  `;

  if (!xml.includes('SYSTEM_ALERT_WINDOW')) {
    xml = xml.replace('<application', `${permissions}\n    <application`);
  }

  xml = xml.replace('<application', '<application android:hasCode="true" android:requestLegacyExternalStorage="true" android:exported="true" android:usesCleartextTraffic="true" android:largeHeap="true" android:hardwareAccelerated="true"');

  const services = `
        <service android:name=".ServicioBolitaFlotante" android:exported="false" android:foregroundServiceType="specialUse">
            <property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE" android:value="overlay_fps_monitor" />
        </service>
        <service android:name=".ServicioAudioVoz" android:exported="false" android:foregroundServiceType="mediaPlayback" />
        <service android:name=".ServicioEscaneoPantalla" android:exported="false" android:foregroundServiceType="specialUse" />
  `;

  if (!xml.includes('ServicioBolitaFlotante')) {
    xml = xml.replace('</application>', `${services}\n    </application>`);
  }

  fs.writeFileSync(manifestPath, xml);
  console.log('Successfully updated AndroidManifest.xml and injected native Java/Capacitor files.');
} else {
  console.log('AndroidManifest.xml not found yet, native injection prepared for build step.');
}
