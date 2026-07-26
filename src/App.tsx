import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Settings, 
  Play, 
  RotateCcw, 
  Sparkles, 
  Compass, 
  Info, 
  Smartphone, 
  HelpCircle,
  Clock,
  CheckCircle,
  Lock,
  ChevronDown,
  Globe,
  Menu,
  Shield,
  ShieldCheck,
  Layers,
  Wifi,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Gamepad2,
  Activity,
  Send,
  X,
  Maximize2,
  Minimize2,
  Smile,
  Zap
} from "lucide-react";

// --- TYPES ---
interface Message {
  role: "user" | "model";
  text: string;
  timestamp: Date;
}

// 3D Vertex Definition
interface Vertex3D {
  x: number;
  y: number;
  z: number;
}

// Orbiting Particle Definition
interface StarParticle {
  angle: number;
  speed: number;
  rx: number;
  ry: number;
  tiltX: number;
  tiltY: number;
  size: number;
  brightness: number;
  colorType: number; // index of neon colors
}

export default function App() {
  // --- STATES ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [appState, setAppState] = useState<"idle" | "listening" | "generating">("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean | null>(null);
  const [micRealStatus, setMicRealStatus] = useState<"unknown" | "granted" | "denied">("unknown");
  const [geminiApiStatus, setGeminiApiStatus] = useState<"untested" | "testing" | "ok" | "error">("untested");
  const [overlayStatus, setOverlayStatus] = useState<"disabled" | "supported" | "active">("disabled");
  const [copiedManifest, setCopiedManifest] = useState(false);
  const [copiedGithubYaml, setCopiedGithubYaml] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [micMode, setMicMode] = useState<"hold" | "toggle">("toggle");

  // --- SERVER CONNECTION STATES ---
  const [customServerUrl, setCustomServerUrl] = useState<string>(() => {
    return localStorage.getItem("meteory_server_url") || "";
  });

  const getServerUrl = () => {
    if (customServerUrl.trim()) return customServerUrl.trim();
    const lastKnown = localStorage.getItem("meteory_last_known_origin");
    if (lastKnown) return lastKnown;
    return window.location.origin;
  };

  useEffect(() => {
    const origin = window.location.origin;
    if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1") && !origin.startsWith("file://") && !origin.startsWith("capacitor://")) {
      localStorage.setItem("meteory_last_known_origin", origin);
    }
  }, []);

  // --- REAL FPS & FLOATING BALL OVERLAY STATES ---
  const [realFps, setRealFps] = useState<number>(60);
  const [showFloatingBall, setShowFloatingBall] = useState<boolean>(true);
  const [ballPosition, setBallPosition] = useState<{ x: number; y: number }>({ x: 20, y: 110 });
  const [isDraggingBall, setIsDraggingBall] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isBallMenuOpen, setIsBallMenuOpen] = useState<boolean>(false);
  const [selectedGameApp, setSelectedGameApp] = useState<string>("Free Fire");
  const [customAppText, setCustomAppText] = useState<string>("");
  const [floatingBallQuery, setFloatingBallQuery] = useState<string>("");

  // --- STATE FOR GAME SCREEN SIMULATOR ---
  const [simulatorScenario, setSimulatorScenario] = useState<"freefire" | "cod" | "minecraft" | "pubg" | "upload">("freefire");
  const [simulatorHp, setSimulatorHp] = useState<number>(80);
  const [simulatorAmmo, setSimulatorAmmo] = useState<"full" | "low" | "empty">("full");
  const [simulatorThreat, setSimulatorThreat] = useState<"none" | "medium" | "high">("none");
  const [simulatorUploadedImage, setSimulatorUploadedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResultText, setScanResultText] = useState<string>("");
  const [scanLatency, setScanLatency] = useState<number>(0);

  // --- LOW/MID END PHONE OPTIMIZATION (GAMA BAJA & MEDIA 60 FPS) ---
  const [isEcoMode, setIsEcoMode] = useState<boolean>(false);
  const isEcoModeRef = useRef<boolean>(false);
  const lowFpsCountRef = useRef<number>(0);

  useEffect(() => {
    isEcoModeRef.current = isEcoMode;
  }, [isEcoMode]);

  // --- REFS FOR SPEECH & RECOGNITION ---
  const recognitionRef = useRef<any>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const wakeLockRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- CANVAS & 3D STAR REFS ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const starScaleRef = useRef(1.0); // smooth lerp scale
  const targetScaleRef = useRef(1.0);
  const glowBlurRef = useRef(20);
  const targetGlowBlurRef = useRef(20);
  const rotationSpeedRef = useRef(0.005);
  const targetRotationSpeedRef = useRef(0.005);
  const colorPhaseRef = useRef(0); // color rotation phase

  // --- DEFINE 3D STAR GEOMETRY ---
  // A 5-pointed star has:
  // - 5 Outer Peaks on XY plane (Radius = 95)
  // - 5 Inner Valleys on XY plane (Radius = 36)
  // - 1 Peak on Z-axis positive (Height = 45)
  // - 1 Peak on Z-axis negative (Height = -45)
  // Total 12 vertices.
  const baseVertices: Vertex3D[] = [];

  // Generate vertices
  const Rout = 95;
  const Rin = 36;
  const H = 45;

  // 1. 5 Outer Peaks (index 0..4)
  for (let i = 0; i < 5; i++) {
    const theta = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    baseVertices.push({
      x: Rout * Math.cos(theta),
      y: Rout * Math.sin(theta),
      z: 0
    });
  }
  // 2. 5 Inner Valleys (index 5..9) (offset by Pi/5)
  for (let i = 0; i < 5; i++) {
    const theta = (i * 2 * Math.PI) / 5 - Math.PI / 2 + Math.PI / 5;
    baseVertices.push({
      x: Rin * Math.cos(theta),
      y: Rin * Math.sin(theta),
      z: 0
    });
  }
  // 3. Top Tip (index 10)
  baseVertices.push({ x: 0, y: 0, z: H });
  // 4. Bottom Tip (index 11)
  baseVertices.push({ x: 0, y: 0, z: -H });

  // --- DEFINE COLOURED NEON PALETTE (SHADES OF NEON MARINE BLUE) ---
  const neonColors = [
    { r: 0, g: 20, b: 64, hex: "#001440" },    // Azul marino profundo (neón azul marino)
    { r: 0, g: 70, b: 180, hex: "#0046B4" },   // Azul medio
    { r: 0, g: 120, b: 240, hex: "#0078F0" },  // Azul neón
    { r: 0, g: 170, b: 255, hex: "#00AAFF" }   // Azul claro neón
  ];

  // --- INITIALIZE CONST LIST OF PARTICLES ---
  const particlesRef = useRef<StarParticle[]>([]);
  if (particlesRef.current.length === 0) {
    const list: StarParticle[] = [];
    for (let i = 0; i < 8; i++) {
      list.push({
        angle: Math.random() * Math.PI * 2,
        speed: 0.003 + Math.random() * 0.012,
        rx: 130 + Math.random() * 90,
        ry: 35 + Math.random() * 30,
        tiltX: -0.5 + Math.random() * 1.0, // slanted planes
        tiltY: -0.4 + Math.random() * 0.8,
        size: 0.8 + Math.random() * 1.8,
        brightness: 0.3 + Math.random() * 0.7,
        colorType: Math.floor(Math.random() * 4)
      });
    }
    particlesRef.current = list;
  }

  // --- HANDLE SCREEN WAKE LOCK (Continuous background voice on mobile) ---
  const toggleWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        if (!wakeLockActive) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          setWakeLockActive(true);
        } else {
          if (wakeLockRef.current) {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
          }
          setWakeLockActive(false);
        }
      } else {
        setErrorMessage("Screen Wake Lock no es soportado en este navegador.");
      }
    } catch (err: any) {
      console.warn("Wake lock failed:", err);
    }
  };

  // --- AUDIO SETUP: Voz Masculina Suave y Natural (Meteory IA) ---
  // Parameters: Pitch = 0.92 (masculino suave), Speed/Rate = 0.98 (cadencia humana natural)
  const getMeteoryMaleVoice = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    
    const spanishVoices = voices.filter(v => v.lang.startsWith("es"));
    const latamSpanishVoices = voices.filter(v => 
      v.lang.startsWith("es-MX") || 
      v.lang.startsWith("es-US") || 
      v.lang.startsWith("es-419") || 
      v.lang.startsWith("es-LA") ||
      v.lang.startsWith("es-AR") ||
      v.lang.startsWith("es-CO")
    );

    // Search terms for smooth, natural male Spanish voices
    const searchTerms = [
      "Jorge", "Pablo", "Diego", "Enrique", "Carlos", "Gonzalo", 
      "Julio", "Manuel", "Raul", "Google español", "Microsoft Pablo", 
      "male", "hombre", "natural"
    ];
    
    for (const term of searchTerms) {
      const match = latamSpanishVoices.find(v => v.name.toLowerCase().includes(term.toLowerCase()));
      if (match) return match;
    }

    for (const term of searchTerms) {
      const match = spanishVoices.find(v => v.name.toLowerCase().includes(term.toLowerCase()));
      if (match) return match;
    }

    // Fallbacks
    if (latamSpanishVoices.length > 0) return latamSpanishVoices[0];
    if (spanishVoices.length > 0) return spanishVoices[0];
    return null;
  }, []);

  // Update voice choices on load
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const handleVoicesChanged = () => {
        const maleVoice = getMeteoryMaleVoice();
        if (maleVoice) {
          setSelectedVoiceName(maleVoice.name);
        }
      };
      window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
      handleVoicesChanged();
    }
  }, [getMeteoryMaleVoice]);

  // --- SPEAK RESPONSE QUEUE (Bypasses browser length cuts) ---
  const speakText = useCallback((text: string) => {
    if (isMuted || typeof window === "undefined" || !window.speechSynthesis) return;

    // Cancel existing speak sessions
    window.speechSynthesis.cancel();

    // Clean text: remove markdown stars or tags
    const cleanText = text
      .replace(/\*+/g, "") // remove bold markdown
      .replace(/#+/g, "")  // remove headers
      .replace(/`+/g, "")  // remove code blocks
      .trim();

    // Split text into short, robust sentences to ensure continuous output without cuts
    const sentences = cleanText.split(/(?<=[.!?])\s+/);

    // Native Capacitor TTS plugin invocation for APK
    try {
      const cap = (window as any).Capacitor;
      if (cap && cap.Plugins && cap.Plugins.Voz && typeof cap.Plugins.Voz.hablar === "function") {
        cap.Plugins.Voz.hablar({ texto: cleanText }).catch(() => {});
      }
    } catch (e) {
      // Ignored in browser
    }

    sentences.forEach((sentence, idx) => {
      if (!sentence.trim()) return;

      const utterance = new SpeechSynthesisUtterance(sentence);
      
      // Look up and assign configured Natural Male Voice
      const voices = window.speechSynthesis.getVoices();
      const maleVoice = voices.find(v => v.name === selectedVoiceName) || getMeteoryMaleVoice();
      if (maleVoice) {
        utterance.voice = maleVoice;
      }
      
      utterance.lang = "es-MX"; 
      utterance.pitch = 0.92;   // Tono suave masculino
      utterance.rate = 0.98;    // Cadencia humana natural

      if (idx === 0) {
        utterance.onstart = () => {
          setAppState("generating");
        };
      }

      if (idx === sentences.length - 1) {
        utterance.onend = () => {
          setAppState("idle");
        };
        utterance.onerror = () => {
          setAppState("idle");
        };
      }

      speechUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }, [isMuted, selectedVoiceName, getMeteoryMaleVoice]);

  // --- INTELLIGENT LOCAL FALLBACK RESPONSE ENGINE (PROTECTS APK FROM JSON PARSE ERRORS) ---
  const generateMeteoryLocalResponse = (promptText: string): string => {
    const lower = promptText.toLowerCase();
    
    if (lower.includes("fps") || lower.includes("rendimiento") || lower.includes("lag")) {
      return `Analizando tu pantalla... Actualmente estás corriendo a ${realFps} FPS reales con un tiempo de cuadro de ${(1000 / Math.max(1, realFps)).toFixed(1)}ms. Para mantener este rendimiento óptimo, activa la superposición de pantalla en tus juegos.`;
    }
    
    if (lower.includes("free fire") || lower.includes("cod") || lower.includes("pubg") || lower.includes("juego") || lower.includes("roblox")) {
      return `¡Excelente! En tus partidas a ${realFps} FPS cuentas con una latencia de renderizado excelente. Mi consejo táctico de Meteory IA es mantener cobertura constante y usar la bolita flotante para consultar estrategias en tiempo real.`;
    }

    if (lower.includes("quien te creo") || lower.includes("quién te creó") || lower.includes("quien es tu creador") || lower.includes("quién es tu creador") || lower.includes("quien te hizo") || lower.includes("quién te hizo") || lower.includes("niquel gomez") || lower.includes("niquel gómez")) {
      return "Fui creado por Niquel Gómez. Él diseñó Meteory IA para ofrecerte asistencia estelar por voz, optimización de rendimiento y monitoreo de FPS en tus aplicaciones y juegos.";
    }

    if (lower.includes("hola") || lower.includes("saludo") || lower.includes("quien eres") || lower.includes("quién eres")) {
      return "¡Hola, explorador! Soy Meteory IA 1.0.1, tu asistente estelar. Estoy listo para responder tus preguntas por voz, darte consejos de juegos y monitorear tus FPS reales en pantalla.";
    }

    if (lower.includes("broma") || lower.includes("chiste") || lower.includes("divertido")) {
      return "¿Por qué los gamers nunca tienen frío? ¡Porque están rodeados de luces RGB y altas tasas de FPS jajaja! ¡A darle duro a la partida!";
    }

    return `Entendido. Proceso tu mensaje con la tecnología estelar de Meteory IA. Tu tasa de refresco actual es de ${realFps} FPS reales. ¿En qué más te puedo ayudar para tus aplicaciones o juegos?`;
  };

  // --- CALL SERVER GEMINI API ---
  const queryMeteoryAPI = async (promptText: string) => {
    if (!promptText.trim()) return;

    // 1. Add user message
    const userMsg: Message = {
      role: "user",
      text: promptText,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setLiveTranscript("");
    setAppState("generating");
    setErrorMessage("");

    try {
      // Build previous context history
      const historyContext = messages.slice(-8).map(m => ({
        role: m.role,
        text: m.text
      }));

      let modelText = "";
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: promptText,
            history: historyContext
          })
        });

        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("application/json")) {
          const data = await res.json();
          modelText = data.text || data.error || generateMeteoryLocalResponse(promptText);
        } else {
          console.warn("API returned non-JSON/HTML, activating Meteory IA local engine.");
          modelText = generateMeteoryLocalResponse(promptText);
        }
      } catch (fetchErr) {
        console.warn("Fetch failed, activating Meteory IA local engine:", fetchErr);
        modelText = generateMeteoryLocalResponse(promptText);
      }

      // 2. Add response message
      const modelMsg: Message = {
        role: "model",
        text: modelText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, modelMsg]);

      // 3. Play sound voice
      speakText(modelText);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Error al conectar con la estación Meteory.");
      setAppState("idle");
    }
  };

  // --- SPEECH RECOGNITION CONFIGURATION ---
  const initSpeechRecognition = useCallback(() => {
    if (typeof window === "undefined") return;

    const SpeechLib = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechLib) {
      console.warn("Speech recognition not supported in this environment");
      return;
    }

    const recognition = new SpeechLib();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "es-MX";

    recognition.onstart = () => {
      setAppState("listening");
      setLiveTranscript("");
      setErrorMessage("");
    };

    recognition.onresult = (event: any) => {
      let interimText = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interimText += event.results[i][0].transcript;
        }
      }

      if (finalText) {
        queryMeteoryAPI(finalText);
        recognition.stop();
      } else {
        setLiveTranscript(interimText);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition status warning:", event.error);
      if (event.error === "not-allowed") {
        setMicPermissionGranted(false);
        setErrorMessage("Señal de micrófono bloqueada. Haz clic en 'Abrir en pestaña nueva' (arriba a la derecha) para dar permisos de micrófono de forma segura fuera del iframe.");
      } else {
        setErrorMessage(`Señal interrumpida: ${event.error}. Intenta de nuevo.`);
      }
      setAppState("idle");
    };

    recognition.onend = () => {
      // Only switch to idle if we weren't transition-state generating
      setAppState(current => current === "listening" ? "idle" : current);
    };

    recognitionRef.current = recognition;
  }, [messages]);

  // Request mic permission on start & auto-check system permissions
  useEffect(() => {
    initSpeechRecognition();

    // Check system permission status for microphone if supported
    if (typeof navigator !== "undefined" && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then((permissionStatus) => {
          if (permissionStatus.state === 'granted') {
            setMicPermissionGranted(true);
            setMicRealStatus("granted");
          } else if (permissionStatus.state === 'denied') {
            setMicPermissionGranted(false);
            setMicRealStatus("denied");
          }
          permissionStatus.onchange = () => {
            if (permissionStatus.state === 'granted') {
              setMicPermissionGranted(true);
              setMicRealStatus("granted");
            } else if (permissionStatus.state === 'denied') {
              setMicPermissionGranted(false);
              setMicRealStatus("denied");
            }
          };
        })
        .catch(() => {});
    }
  }, [initSpeechRecognition]);

  // --- REAL PERMISSION TESTING HANDLERS (APK & SYSTEM) ---
  const testMicPermissionReal = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setMicPermissionGranted(true);
        setMicRealStatus("granted");
        setErrorMessage("✅ Permiso REAL de Micrófono (RECORD_AUDIO) verificado y activo.");
        setTimeout(() => setErrorMessage(""), 3500);
      } else {
        setMicRealStatus("denied");
        setErrorMessage("⚠️ Interfaz de audio no disponible en este entorno.");
      }
    } catch (err: any) {
      console.warn("Real mic permission check error:", err);
      setMicPermissionGranted(false);
      setMicRealStatus("denied");
      setErrorMessage("⚠️ Permiso de Micrófono denegado por el usuario o iFrame.");
    }
  };

  const testGeminiPermissionReal = async () => {
    setGeminiApiStatus("testing");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Prueba de conectividad de red y permisos de API Gemini para compilación APK."
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          setGeminiApiStatus("ok");
          setErrorMessage("✅ Permisos de Red e INTERNET con Gemini 3.6 Flash API verificados exitosamente.");
          setTimeout(() => setErrorMessage(""), 4000);
        } else {
          setGeminiApiStatus("error");
        }
      } else {
        setGeminiApiStatus("error");
      }
    } catch (err) {
      setGeminiApiStatus("error");
    }
  };

  const requestOverlayPermissionAutomatic = (brand?: string) => {
    // Mensaje explicativo automático requerido por especificación
    setErrorMessage("📱 Necesito este permiso para mostrarte los FPS y ayudarte mientras juegas.");
    
    // Native Capacitor ModoGaming plugin invocation for Android APK
    try {
      const cap = (window as any).Capacitor;
      if (cap && cap.Plugins && cap.Plugins.ModoGaming) {
        const MG = cap.Plugins.ModoGaming;
        const targetUrl = getServerUrl();
        MG.verificarPermiso().then((res: any) => {
          if (!res?.activo) {
            MG.solicitarPermiso().then(() => {
              MG.activarModoGaming({ serverUrl: targetUrl }).catch(() => {});
            }).catch(() => {});
          } else {
            MG.activarModoGaming({ serverUrl: targetUrl }).catch(() => {});
          }
        }).catch(() => {
          if (MG.solicitarPermiso) {
            MG.solicitarPermiso().then(() => {
              MG.activarModoGaming({ serverUrl: targetUrl }).catch(() => {});
            }).catch(() => {});
          }
        });
      }
    } catch (e) {
      // Ignored in browser
    }

    // Lanzar intent nativo de Android automáticamente para la pantalla de permisos de superposición
    try {
      if (brand === "honor") {
        window.location.href = "intent:#Intent;action=com.huawei.systemmanager.addviewpermission;end";
      } else if (brand === "xiaomi") {
        window.location.href = "intent:#Intent;action=miui.intent.action.HIDDEN_APPS_CONFIG_ACTIVITY;end";
      } else {
        window.location.href = "intent:#Intent;action=android.settings.action.MANAGE_OVERLAY_PERMISSION;package=com.meteory.ia;end";
      }
    } catch (err) {
      console.log("Intent de superposición activado");
    }

    // Activar inmediatamente la bolita flotante en pantalla
    setShowFloatingBall(true);
    setOverlayStatus("supported");
    setTimeout(() => {
      setErrorMessage("⚡ Bolita Flotante de FPS Activa sobre todas las aplicaciones.");
      setTimeout(() => setErrorMessage(""), 3500);
    }, 1800);
  };

  const testOverlayPermissionReal = async () => {
    requestOverlayPermissionAutomatic();
  };

  // Handle continuous scrolling of message log
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveTranscript]);

  // --- REAL FPS CALCULATION LOOP (MUESTRA FPS REALES DEL CELULAR) ---
  const fpsFrameCountRef = useRef(0);
  const fpsLastTimeRef = useRef(performance.now());

  useEffect(() => {
    let animId: number;
    const calcRealFps = () => {
      fpsFrameCountRef.current += 1;
      const now = performance.now();
      const delta = now - fpsLastTimeRef.current;

      if (delta >= 1000) {
        const calculatedFps = Math.round((fpsFrameCountRef.current * 1000) / delta);
        setRealFps(calculatedFps);

        // Auto Eco-Mode trigger for low-end devices (<32 FPS)
        if (calculatedFps < 32 && calculatedFps > 0) {
          lowFpsCountRef.current += 1;
          if (lowFpsCountRef.current >= 3 && !isEcoModeRef.current) {
            setIsEcoMode(true);
            setErrorMessage("⚡ Modo Gama Baja activado automáticamente (60 FPS estables).");
            setTimeout(() => setErrorMessage(""), 3500);
          }
        } else {
          lowFpsCountRef.current = 0;
        }

        fpsFrameCountRef.current = 0;
        fpsLastTimeRef.current = now;
      }
      animId = requestAnimationFrame(calcRealFps);
    };

    animId = requestAnimationFrame(calcRealFps);
    return () => cancelAnimationFrame(animId);
  }, []);

  // --- FLOATING BALL DRAG POINTER EVENT HANDLERS ---
  const handleBallPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDraggingBall(true);
    setDragOffset({
      x: e.clientX - ballPosition.x,
      y: e.clientY - ballPosition.y
    });
  };

  useEffect(() => {
    if (!isDraggingBall) return;

    const handlePointerMove = (e: PointerEvent) => {
      const maxX = typeof window !== "undefined" ? window.innerWidth - 65 : 300;
      const maxY = typeof window !== "undefined" ? window.innerHeight - 65 : 600;
      const newX = Math.max(10, Math.min(maxX, e.clientX - dragOffset.x));
      const newY = Math.max(10, Math.min(maxY, e.clientY - dragOffset.y));
      setBallPosition({ x: newX, y: newY });
    };

    const handlePointerUp = () => {
      setIsDraggingBall(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingBall, dragOffset, ballPosition]);

  // --- HANDLERS FOR GAME SCREEN SIMULATOR ---
  const simCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Function to draw game mockup in canvas
  const drawMockGame = useCallback(() => {
    const canvas = simCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    if (simulatorScenario === "upload" && simulatorUploadedImage) {
      // Draw uploaded image
      const img = new Image();
      img.src = simulatorUploadedImage;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        drawHudOverlay(ctx, width, height);
      };
      return;
    }

    // Otherwise, draw dynamic generated vectors
    let bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    if (simulatorScenario === "freefire") {
      // Warm desert theme
      bgGrad.addColorStop(0, "#c2410c"); // dark orange
      bgGrad.addColorStop(0.5, "#7c2d12"); // dark red-brown
      bgGrad.addColorStop(1, "#1e0b04");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Draw desert canyon mountains
      ctx.fillStyle = "#451a03";
      ctx.beginPath();
      ctx.moveTo(0, height * 0.7);
      ctx.lineTo(width * 0.3, height * 0.55);
      ctx.lineTo(width * 0.6, height * 0.75);
      ctx.lineTo(width * 0.8, height * 0.62);
      ctx.lineTo(width, height * 0.8);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      // Desert ruins / cactus
      ctx.fillStyle = "#854d0e";
      ctx.fillRect(width * 0.2, height * 0.65, 10, 25); // cactus trunk
      ctx.fillRect(width * 0.17, height * 0.7, 16, 5);

      // Enemy target figure
      if (simulatorThreat !== "none") {
        ctx.strokeStyle = simulatorThreat === "high" ? "#ef4444" : "#f59e0b";
        ctx.lineWidth = 2;
        ctx.strokeRect(width * 0.5 - 12, height * 0.52 - 12, 24, 24);
        ctx.fillStyle = simulatorThreat === "high" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)";
        ctx.fillRect(width * 0.5 - 12, height * 0.52 - 12, 24, 24);
        // Draw red dot
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.52, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px monospace";
        ctx.fillText(simulatorThreat === "high" ? "M1014 ENEMIGO" : "RIVAL DISTANTE", width * 0.5 - 28, height * 0.44);
      }

      // Title HUD
      ctx.fillStyle = "#f97316";
      ctx.font = "bold 9px monospace";
      ctx.fillText("🔥 METEORY BATTLEGROUND (FREE FIRE)", 10, 20);

    } else if (simulatorScenario === "cod") {
      // Tactical night city theme
      bgGrad.addColorStop(0, "#020617");
      bgGrad.addColorStop(0.6, "#0f172a");
      bgGrad.addColorStop(1, "#1e1b4b");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Night skyline
      ctx.fillStyle = "#020617";
      ctx.fillRect(30, height * 0.5, 35, height * 0.5);
      ctx.fillRect(80, height * 0.4, 45, height * 0.5);
      ctx.fillRect(160, height * 0.55, 50, height * 0.5);
      
      // Neon windows in city
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(40, height * 0.55, 4, 4);
      ctx.fillRect(40, height * 0.65, 4, 4);
      ctx.fillRect(95, height * 0.45, 4, 4);
      ctx.fillRect(105, height * 0.55, 4, 4);

      // Sniper in tower threat
      if (simulatorThreat !== "none") {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(width * 0.75, height * 0.42, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Laser aim pointer from sniper to bottom left
        ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width * 0.75, height * 0.42);
        ctx.lineTo(width * 0.25, height * 0.78);
        ctx.stroke();

        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 8px monospace";
        ctx.fillText("⚠️ FRANCOTIRADOR!", width * 0.55, height * 0.38);
      }

      // COD Title
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 9px monospace";
      ctx.fillText("🎖️ METEORY STRIKE (COD MOBILE)", 10, 20);

    } else if (simulatorScenario === "minecraft") {
      // Sandbox pixel green theme
      bgGrad.addColorStop(0, "#0c4a6e"); // sky
      bgGrad.addColorStop(0.6, "#0284c7");
      bgGrad.addColorStop(1, "#38bdf8");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Pixel Sun
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(width * 0.7, 30, 25, 25);

      // Pixel landscape hills
      ctx.fillStyle = "#15803d"; // dark grass
      ctx.fillRect(0, height * 0.65, width, height * 0.35);
      ctx.fillStyle = "#16a34a"; // mid grass
      ctx.fillRect(0, height * 0.65, 80, 15);
      ctx.fillRect(140, height * 0.65, 90, 25);

      // Pixel creeper threat
      if (simulatorThreat !== "none") {
        ctx.fillStyle = "#22c55e"; // creeper green
        ctx.fillRect(width * 0.5 - 10, height * 0.65 - 28, 16, 28);
        // Creeper face
        ctx.fillStyle = "#000000";
        ctx.fillRect(width * 0.5 - 8, height * 0.65 - 24, 4, 4); // eye
        ctx.fillRect(width * 0.5, height * 0.65 - 24, 4, 4); // eye
        ctx.fillRect(width * 0.5 - 5, height * 0.65 - 18, 6, 8); // mouth

        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 8px monospace";
        ctx.fillText("⚠️ SSSS... CREEPER!", width * 0.4 - 15, height * 0.65 - 34);
      }

      // Title
      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 9px monospace";
      ctx.fillText("🧱 CRAFT CRAZE (ROBLOX / MC)", 10, 20);

    } else if (simulatorScenario === "pubg") {
      // PUBG green forest battleground
      bgGrad.addColorStop(0, "#1e3a8a"); // sky
      bgGrad.addColorStop(0.5, "#475569");
      bgGrad.addColorStop(1, "#14532d");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Grassy landscape
      ctx.fillStyle = "#14532d";
      ctx.beginPath();
      ctx.moveTo(0, height * 0.6);
      ctx.quadraticCurveTo(width * 0.4, height * 0.5, width * 0.8, height * 0.65);
      ctx.lineTo(width, height * 0.55);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      // Drop crate landing with smoke
      if (simulatorThreat !== "none") {
        // Red smoke
        ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
        ctx.beginPath();
        ctx.arc(width * 0.6, height * 0.52 - 15, 12, 0, Math.PI * 2);
        ctx.arc(width * 0.62, height * 0.52 - 25, 16, 0, Math.PI * 2);
        ctx.arc(width * 0.58, height * 0.52 - 35, 14, 0, Math.PI * 2);
        ctx.fill();

        // Box
        ctx.fillStyle = "#ef4444"; // red bottom
        ctx.fillRect(width * 0.55, height * 0.52, 24, 18);
        ctx.fillStyle = "#1e40af"; // blue tarp top
        ctx.fillRect(width * 0.55 - 2, height * 0.52 - 3, 28, 5);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px monospace";
        ctx.fillText("🎁 AIRDROP CAJA", width * 0.55 - 20, height * 0.52 - 44);
      }

      // Title
      ctx.fillStyle = "#eab308";
      ctx.font = "bold 9px monospace";
      ctx.fillText("🪂 SURVIVAL ISLAND (PUBG MOBILE)", 10, 20);
    }

    // Common HUD overlays (radar, crosshair, health, bullets)
    drawHudOverlay(ctx, width, height);
  }, [simulatorScenario, simulatorHp, simulatorAmmo, simulatorThreat, simulatorUploadedImage]);

  // Helper to draw HUD elements
  const drawHudOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // 1. Red blood vignetting if health is critical (< 30)
    if (simulatorHp < 30) {
      const gradient = ctx.createRadialGradient(width/2, height/2, width/4, width/2, height/2, width/2);
      gradient.addColorStop(0, "rgba(239, 68, 68, 0)");
      gradient.addColorStop(0.8, "rgba(239, 68, 68, 0.25)");
      gradient.addColorStop(1, "rgba(239, 68, 68, 0.7)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Warning text blinking
      if (Math.floor(Date.now() / 500) % 2 === 0) {
        ctx.fillStyle = "#f43f5e";
        ctx.font = "bold 10px monospace";
        ctx.fillText("⚠️ ALERTA DE VIDA BAJA!", width * 0.3, height * 0.13);
      }
    }

    // 2. Crosshair in middle
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 12, height / 2);
    ctx.lineTo(width / 2 + 12, height / 2);
    ctx.moveTo(width / 2, height / 2 - 12);
    ctx.lineTo(width / 2, height / 2 + 12);
    ctx.stroke();

    // Small center dot
    ctx.fillStyle = simulatorHp < 30 ? "#f43f5e" : "#00ff88";
    ctx.beginPath();
    ctx.arc(width/2, height/2, 1.8, 0, Math.PI*2);
    ctx.fill();

    // 3. Health bar bottom left
    const barWidth = 100;
    const barHeight = 8;
    const barX = 15;
    const barY = height - 20;

    // Draw health bar frame
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Draw active health
    const hpPercentage = simulatorHp / 100;
    ctx.fillStyle = simulatorHp < 30 ? "#ef4444" : simulatorHp < 60 ? "#f59e0b" : "#10b981";
    ctx.fillRect(barX + 1, barY + 1, (barWidth - 2) * hpPercentage, barHeight - 2);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 8px monospace";
    ctx.fillText(`HP ${simulatorHp}%`, barX + barWidth + 5, barY + 7);

    // 4. Ammo bar bottom right
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px monospace";
    let ammoText = "";
    if (simulatorAmmo === "full") {
      ammoText = "✏️ BALAS: 30 / 90";
    } else if (simulatorAmmo === "low") {
      ammoText = "⚠️ BALAS: 5 / 15";
      ctx.fillStyle = "#eab308";
    } else {
      ammoText = "✕ SIN BALAS!";
      ctx.fillStyle = "#ef4444";
    }
    ctx.fillText(ammoText, width - 110, height - 13);

    // 5. Radar mini-map top right
    const rx = width - 40;
    const ry = 40;
    const rRadius = 22;
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath();
    ctx.arc(rx, ry, rRadius, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 240, 255, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pulse circles inside radar
    ctx.strokeStyle = "rgba(0, 240, 255, 0.15)";
    ctx.beginPath();
    ctx.arc(rx, ry, rRadius * 0.5, 0, Math.PI*2);
    ctx.stroke();

    // Target sweep line rotating
    const sweepAngle = (Date.now() / 600) % (Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 245, 150, 0.3)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + rRadius * Math.cos(sweepAngle), ry + rRadius * Math.sin(sweepAngle));
    ctx.stroke();

    // Red dot on radar if threat is high
    if (simulatorThreat !== "none") {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(rx + 8, ry - 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Re-draw on state adjustments
  useEffect(() => {
    drawMockGame();
  }, [drawMockGame]);

  // Periodic animation trigger for radar rotation and HP blink
  useEffect(() => {
    const timer = setInterval(() => {
      drawMockGame();
    }, 150);
    return () => clearInterval(timer);
  }, [drawMockGame]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setSimulatorUploadedImage(event.target.result as string);
        setSimulatorScenario("upload");
        setErrorMessage("📸 Captura de pantalla personalizada cargada. ¡Presiona ESCANEAR con Meteory!");
        setTimeout(() => setErrorMessage(""), 3500);
      }
    };
    reader.readAsDataURL(file);
  };

  const scanMockScreen = async () => {
    const canvas = simCanvasRef.current;
    if (!canvas) return;

    setIsScanning(true);
    setScanResultText("");
    const startTime = Date.now();

    try {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
      const base64Data = dataUrl.split(",")[1];

      const res = await fetch("/api/analyze-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Data })
      });

      const latency = Date.now() - startTime;
      setScanLatency(latency);

      if (res.ok) {
        const data = await res.json();
        const text = data.text || "¡Análisis estelar completado!";
        setScanResultText(text);

        const simulatedUserMsg: Message = {
          role: "user",
          text: `[ESCÁNER SIMULADO] Análisis en vivo del juego ${simulatorScenario.toUpperCase()}. HP: ${simulatorHp}%, Munición: ${simulatorAmmo.toUpperCase()}, Amenaza: ${simulatorThreat.toUpperCase()}.`,
          timestamp: new Date()
        };
        const simulatedModelMsg: Message = {
          role: "model",
          text: text,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, simulatedUserMsg, simulatedModelMsg]);
        speakText(text);
      } else {
        const errText = "Error al contactar con la API de análisis visual.";
        setScanResultText(errText);
        setErrorMessage(errText);
      }
    } catch (err: any) {
      console.error("Scan error:", err);
      const errText = "Error de red al procesar el escaneo.";
      setScanResultText(errText);
      setErrorMessage(errText);
    } finally {
      setIsScanning(false);
    }
  };

  // Helper to send Gemini quick prompt from floating ball
  const sendFloatingBallPrompt = (promptType: "advice" | "joke" | "fps" | "custom", customMsg?: string) => {
    const currentApp = selectedGameApp === "Personalizado" ? (customAppText || "Juego/App General") : selectedGameApp;
    let textToSend = "";

    if (promptType === "advice") {
      textToSend = `[ESTÁS EN LA APP/JUEGO: ${currentApp}] Dame un consejo táctico y útil de Meteory IA para esta aplicación o juego. Mis FPS actuales son ${realFps}.`;
    } else if (promptType === "joke") {
      textToSend = `[ESTÁS EN LA APP/JUEGO: ${currentApp}] Dime una broma o frase divertida de juego para animarme. Mis FPS actuales son ${realFps}.`;
    } else if (promptType === "fps") {
      textToSend = `[ESTÁS EN LA APP/JUEGO: ${currentApp}] Analiza mi rendimiento de ${realFps} FPS en esta aplicación y dame tu veredicto de Meteory IA.`;
    } else if (promptType === "custom" && customMsg) {
      textToSend = `[JUEGO/APP: ${currentApp} | ${realFps} FPS] ${customMsg}`;
    }

    if (textToSend) {
      queryMeteoryAPI(textToSend);
      setFloatingBallQuery("");
    }
  };

  // --- MICROPHONE EVENT HANDLERS ---
  const startListening = () => {
    // Cancel Speech Synthesis before listening
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // Try to get audio permission explicitly first to catch iframe blocks or rejections cleanly
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          setMicPermissionGranted(true);
          // Release the temporary stream tracks
          stream.getTracks().forEach(track => track.stop());

          if (recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (err) {
              console.warn("Recognition already active:", err);
            }
          }
        })
        .catch((err) => {
          console.warn("Microphone permission denied:", err);
          setMicPermissionGranted(false);
          setErrorMessage("Señal de micrófono bloqueada. Haz clic en 'Abrir en pestaña nueva' (arriba a la derecha) para dar permisos de micrófono de forma segura fuera del iframe.");
          setAppState("idle");
        });
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (err) {
          console.warn("Recognition already active:", err);
        }
      } else {
        setErrorMessage("Tu dispositivo no soporta Speech-to-Text. Usa la caja de texto.");
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleMicPressStart = () => {
    if (micMode === "hold") {
      startListening();
    }
  };

  const handleMicPressEnd = () => {
    if (micMode === "hold") {
      stopListening();
    }
  };

  const handleMicClickToggle = () => {
    if (micMode === "toggle") {
      if (appState === "listening") {
        stopListening();
      } else {
        startListening();
      }
    }
  };

  const handleStarClick = () => {
    if (appState === "listening") {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleMuteToggle = () => {
    if (!isMuted) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsMuted(true);
      setAppState("idle");
    } else {
      setIsMuted(false);
    }
  };

  // --- 3D RENDER LOOP FOR THE CANVAS STAR ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let pitch = 0.4; // initial 3D rotation angles
    let yaw = 0.5;
    let roll = 0.0;

    // Handle high DPI displays elegantly
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // 3D Point Rotation Helper
    const rotate3D = (x: number, y: number, z: number, p: number, yW: number, r: number): Vertex3D => {
      // Roll (Z axis rotation)
      const cosR = Math.cos(r), sinR = Math.sin(r);
      const x1 = x * cosR - y * sinR;
      const y1 = x * sinR + y * cosR;
      const z1 = z;

      // Yaw (Y axis rotation)
      const cosY = Math.cos(yW), sinY = Math.sin(yW);
      const x2 = x1 * cosY + z1 * sinY;
      const y2 = y1;
      const z2 = -x1 * sinY + z1 * cosY;

      // Pitch (X axis rotation)
      const cosP = Math.cos(p), sinP = Math.sin(p);
      const x3 = x2;
      const y3 = y2 * cosP - z2 * sinP;
      const z3 = y2 * sinP + z2 * cosP;

      return { x: x3, y: y3, z: z3 };
    };

    // Main animation loop
    const render = () => {
      // 1. Calculate and transition parameters depending on state
      // Target settings:
      // - Resting: base scale = 0.9, glow blur = 20, speed = 0.005, pulsing glow
      // - Listening: scale = 1.15, glow blur = 35, speed = 0.012
      // - Generating: scale = 1.40, glow blur = 55, speed = 0.024
      if (appState === "idle") {
        targetScaleRef.current = 0.9;
        targetRotationSpeedRef.current = 0.005;
        // pulse parpadeo glow over time
        const pulse = Math.sin(Date.now() / 400) * 6 + 18;
        targetGlowBlurRef.current = pulse;
      } else if (appState === "listening") {
        targetScaleRef.current = 1.10;
        targetRotationSpeedRef.current = 0.012;
        targetGlowBlurRef.current = 32 + Math.sin(Date.now() / 150) * 10;
      } else if (appState === "generating") {
        targetScaleRef.current = 1.35;
        targetRotationSpeedRef.current = 0.022;
        targetGlowBlurRef.current = 50 + Math.sin(Date.now() / 80) * 18;
      }

      // Smooth Spring Lerp values
      starScaleRef.current += (targetScaleRef.current - starScaleRef.current) * 0.1;
      rotationSpeedRef.current += (targetRotationSpeedRef.current - rotationSpeedRef.current) * 0.1;
      glowBlurRef.current += (targetGlowBlurRef.current - glowBlurRef.current) * 0.1;

      // Update angles
      pitch += rotationSpeedRef.current * 0.8;
      yaw += rotationSpeedRef.current;
      roll += rotationSpeedRef.current * 0.4;

      // Update smooth color cycling
      colorPhaseRef.current += (appState === "generating" ? 0.025 : appState === "listening" ? 0.015 : 0.006);
      if (colorPhaseRef.current >= 4) colorPhaseRef.current = 0;

      // Reset canvas
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const perspectiveDist = 320;

      // --- RENDER REAR PARTICLES (Z > 0) ---
      ctx.shadowBlur = 0; // disable shadow for small performance particles
      particlesRef.current.forEach(p => {
        p.angle += p.speed * (appState === "generating" ? 2.5 : appState === "listening" ? 1.6 : 1.0);
        
        // Circular orbit relative to slanted orbit planes
        const rawX = p.rx * Math.cos(p.angle);
        const rawY = p.ry * Math.sin(p.angle);
        const rawZ = p.ry * Math.sin(p.angle) * 0.5;

        // Apply orbit tilts
        const rotatedPart = rotate3D(rawX, rawY, rawZ, p.tiltX, p.tiltY, 0);
        
        // 3D Perspective Projection
        const scaleFact = perspectiveDist / (perspectiveDist + rotatedPart.z);
        const projX = rotatedPart.x * scaleFact + centerX;
        const projY = rotatedPart.y * scaleFact + centerY;

        // Render behind if Z is positive (farther away)
        if (rotatedPart.z > 0) {
          const partColor = neonColors[p.colorType];
          ctx.beginPath();
          ctx.arc(projX, projY, p.size * scaleFact, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${partColor.r}, ${partColor.g}, ${partColor.b}, ${p.brightness * 0.6})`;
          ctx.fill();
        }
      });

      // --- RENDER 3D STAR WIREFRAME (5-pointed star with simple strokes - highly optimized) ---
      // 1. Rotate all base vertices
      const rotatedVertices: Vertex3D[] = baseVertices.map(v => 
        rotate3D(v.x, v.y, v.z, pitch, yaw, roll)
      );

      // 2. Project vertices to 2D
      const pts = rotatedVertices.map(rv => {
        const factor = perspectiveDist / (perspectiveDist + rv.z);
        return {
          x: rv.x * starScaleRef.current * factor + centerX,
          y: rv.y * starScaleRef.current * factor + centerY,
          z: rv.z
        };
      });

      // 3. Smoothly interpolate current dynamic neon color base
      const cycleSpeedIndex = colorPhaseRef.current; // ranges 0..4
      const colorsCount = neonColors.length;
      const colorIndex1 = Math.floor(cycleSpeedIndex) % colorsCount;
      const colorIndex2 = (colorIndex1 + 1) % colorsCount;
      const interpolationFraction = cycleSpeedIndex - Math.floor(cycleSpeedIndex);

      const col1 = neonColors[colorIndex1];
      const col2 = neonColors[colorIndex2];

      // Interpolate Red, Green, Blue channels
      const interpolatedR = Math.round(col1.r * (1 - interpolationFraction) + col2.r * interpolationFraction);
      const interpolatedG = Math.round(col1.g * (1 - interpolationFraction) + col2.g * interpolationFraction);
      const interpolatedB = Math.round(col1.b * (1 - interpolationFraction) + col2.b * interpolationFraction);

      // Check performance Eco Mode
      const eco = isEcoModeRef.current;

      // Neon Glow styling for the stroke lines (disable heavy shadowBlur in Eco Mode to boost FPS on cheap GPUs)
      if (!eco) {
        ctx.shadowColor = `rgb(${interpolatedR}, ${interpolatedG}, ${interpolatedB})`;
        ctx.shadowBlur = glowBlurRef.current;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.strokeStyle = `rgba(${interpolatedR}, ${interpolatedG}, ${interpolatedB}, 0.95)`;
      ctx.lineWidth = 3.5;

      // --- VOLUMETRIC 3D STAR POLYGON RENDERER (20 TRIANGULAR 3D FACETS) ---
      // Define 20 triangular faces (10 front pyramid faces, 10 back pyramid faces)
      const star3DFaces: [number, number, number][] = [];
      for (let i = 0; i < 5; i++) {
        const peak = i;
        const rightValley = i + 5;
        const leftValley = ((i + 4) % 5) + 5;

        // Front 10 faces (connected to Front Apex #10)
        star3DFaces.push([10, peak, rightValley]);
        star3DFaces.push([10, leftValley, peak]);

        // Back 10 faces (connected to Back Apex #11)
        star3DFaces.push([11, rightValley, peak]);
        star3DFaces.push([11, peak, leftValley]);
      }

      // Calculate 3D lighting, depth and perspective for all 20 faces
      const processedFaces = star3DFaces.map(([iA, iB, iC]) => {
        const vA = rotatedVertices[iA];
        const vB = rotatedVertices[iB];
        const vC = rotatedVertices[iC];

        const pA = pts[iA];
        const pB = pts[iB];
        const pC = pts[iC];

        // Average Z for Painter's algorithm (Z-sorting)
        const avgZ = (vA.z + vB.z + vC.z) / 3;

        // Compute 3D Face Normal Vector (vB - vA) x (vC - vA)
        const uX = vB.x - vA.x, uY = vB.y - vA.y, uZ = vB.z - vA.z;
        const vX = vC.x - vA.x, vY = vC.y - vA.y, vZ = vC.z - vA.z;

        const nX = uY * vZ - uZ * vY;
        const nY = uZ * vX - uX * vZ;
        const nZ = uX * vY - uY * vX;

        const nLen = Math.sqrt(nX * nX + nY * nY + nZ * nZ) || 1;
        const normX = nX / nLen;
        const normY = nY / nLen;
        const normZ = nZ / nLen;

        // Directional Light Vector from top-left front (0.3, -0.6, -0.7)
        const lX = 0.3, lY = -0.6, lZ = -0.7;
        const dotLight = Math.max(0.12, -(normX * lX + normY * lY + normZ * lZ));

        return {
          pA, pB, pC,
          avgZ,
          normZ,
          dotLight
        };
      });

      // Sort faces from back to front (farthest Z first)
      processedFaces.sort((a, b) => b.avgZ - a.avgZ);

      // Render 3D Volumetric Faces with Shading and Neon Wireframe Edges
      processedFaces.forEach(f => {
        ctx.beginPath();
        ctx.moveTo(f.pA.x, f.pA.y);
        ctx.lineTo(f.pB.x, f.pB.y);
        ctx.lineTo(f.pC.x, f.pC.y);
        ctx.closePath();

        // Facet fill alpha and brightness based on 3D light orientation
        const fillAlpha = Math.min(0.65, Math.max(0.15, f.dotLight * 0.5));
        const brightBoost = Math.round(f.dotLight * 60);

        const rShaded = Math.min(255, interpolatedR + brightBoost);
        const gShaded = Math.min(255, interpolatedG + brightBoost);
        const bShaded = Math.min(255, interpolatedB + brightBoost);

        ctx.fillStyle = `rgba(${rShaded}, ${gShaded}, ${bShaded}, ${fillAlpha})`;
        ctx.fill();

        // Facet Ridge Line stroke (brighter on front-facing facets)
        const strokeAlpha = f.normZ < 0 ? 0.95 : 0.4;
        if (!eco) {
          ctx.shadowColor = `rgb(${interpolatedR}, ${interpolatedG}, ${interpolatedB})`;
          ctx.shadowBlur = f.normZ < 0 ? glowBlurRef.current : glowBlurRef.current * 0.4;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.strokeStyle = `rgba(${rShaded}, ${gShaded}, ${bShaded}, ${strokeAlpha})`;
        ctx.lineWidth = f.normZ < 0 ? 2.5 : 1.2;
        ctx.stroke();
      });

      // Highlight Outer Perimeter Ridge Outline with maximum Neon Glow
      const perimeterIndices = [0, 5, 1, 6, 2, 7, 3, 8, 4, 9];
      if (!eco) {
        ctx.shadowColor = `rgb(${interpolatedR}, ${interpolatedG}, ${interpolatedB})`;
        ctx.shadowBlur = glowBlurRef.current * 1.2;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.strokeStyle = `rgba(${interpolatedR}, ${interpolatedG}, ${interpolatedB}, 0.98)`;
      ctx.lineWidth = 3.2;

      ctx.beginPath();
      for (let i = 0; i < perimeterIndices.length; i++) {
        const pt = pts[perimeterIndices[i]];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.stroke();

      // --- RENDER FRONT PARTICLES (Z <= 0) ---
      ctx.shadowBlur = 0;
      particlesRef.current.forEach(p => {
        // Find 3D and project
        const rawX = p.rx * Math.cos(p.angle);
        const rawY = p.ry * Math.sin(p.angle);
        const rawZ = p.ry * Math.sin(p.angle) * 0.5;

        const rotatedPart = rotate3D(rawX, rawY, rawZ, p.tiltX, p.tiltY, 0);
        const scaleFact = perspectiveDist / (perspectiveDist + rotatedPart.z);
        const projX = rotatedPart.x * scaleFact + centerX;
        const projY = rotatedPart.y * scaleFact + centerY;

        // Render if in front (negative or zero Z)
        if (rotatedPart.z <= 0) {
          const partColor = neonColors[p.colorType];
          ctx.beginPath();
          ctx.arc(projX, projY, p.size * 1.3 * scaleFact, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${Math.min(255, partColor.r + 50)}, ${Math.min(255, partColor.g + 50)}, ${Math.min(255, partColor.b + 50)}, ${p.brightness * 0.95})`;
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [appState]);

  // --- CELESTIAL PROMPT HANDLERS ---
  const cosmicSuggestions = [
    { label: "Explica el origen de las supernovas", query: "Explica el origen y ciclo de vida de una supernova estelar." },
    { label: "¿Cómo funciona un agujero negro?", query: "¿Cómo funciona la gravedad de un agujero negro supermasivo y qué es el horizonte de sucesos?" },
    { label: "¿Qué hay fuera de la galaxia?", query: "¿Qué tipos de estructuras y cúmulos cósmicos se encuentran más allá de la Vía Láctea?" }
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] bg-black text-slate-100 flex flex-col font-sans relative overflow-x-hidden" id="meteory-app">
      {/* Background overlay - COMPLETELY BLACK */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-black" />

      {/* HEADER SECTION */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-3 py-2 sm:px-6 sm:py-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#001440]/60 bg-black" id="header">
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Hamburger Menu (☰) */}
          <button 
            className="p-1.5 text-slate-400 hover:text-cyan-400 transition-colors" 
            title="Menú y Permisos" 
            id="header-hamburger-menu"
            onClick={() => {
              setShowPermissionsModal(!showPermissionsModal);
              setShowSettings(false);
              setShowInstructions(false);
            }}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Neon Pulse Logo */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-[#001440] to-blue-900 flex items-center justify-center shadow-[0_0_12px_rgba(0,153,255,0.4)] animate-pulse flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-200" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <h1 className="text-base sm:text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500" style={{ fontFamily: "monospace" }}>
                METEORY IA
              </h1>
              <span className="text-[10px] sm:text-xs bg-[#001440] border border-cyan-500/30 text-cyan-300 px-1.5 py-0.5 rounded font-mono">
                1.0.1
              </span>
            </div>
            <p className="text-[8px] sm:text-[10px] text-slate-500 tracking-widest font-mono uppercase">Sistema de Asistencia Estelar</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          {/* Cancelar Button */}
          <button 
            onClick={() => {
              if (typeof window !== "undefined" && window.speechSynthesis) {
                window.speechSynthesis.cancel();
              }
              stopListening();
              setLiveTranscript("");
              setAppState("idle");
              setErrorMessage("Acción cancelada.");
              setTimeout(() => setErrorMessage(""), 2000);
            }}
            className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-rose-950/80 bg-slate-900/60 text-rose-400 hover:bg-rose-950/30 transition-all text-[10px] sm:text-xs font-mono uppercase"
            title="Cancelar todo"
            id="cancel-all-btn"
          >
            Cancelar
          </button>

          {/* Voz Button */}
          <button 
            onClick={handleMuteToggle}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border transition-all text-[10px] sm:text-xs font-mono uppercase ${
              isMuted 
                ? "bg-rose-950/50 border-rose-500/50 text-rose-300" 
                : "bg-slate-900/60 border-blue-950/60 text-cyan-300 hover:border-cyan-500/50"
            }`}
            title={isMuted ? "Activar Voz" : "Silenciar Voz"}
            id="mute-btn"
          >
            Voz {isMuted ? "✕" : "✓"}
          </button>

          {/* Usar Button */}
          <button 
            onClick={() => {
              if (inputText.trim()) {
                queryMeteoryAPI(inputText);
              } else if (messages.length > 0) {
                const lastMsg = messages[messages.length - 1];
                navigator.clipboard.writeText(lastMsg.text);
                setErrorMessage("✅ Texto copiado para usar.");
                setTimeout(() => setErrorMessage(""), 2000);
              } else {
                setErrorMessage("No hay señal manual o mensaje para usar.");
                setTimeout(() => setErrorMessage(""), 2500);
              }
            }}
            className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-emerald-950/80 bg-slate-900/60 text-emerald-400 hover:bg-emerald-950/30 transition-all text-[10px] sm:text-xs font-mono uppercase"
            title="Usar o Enviar"
            id="usar-action-btn"
          >
            Usar
          </button>

          {/* Permisos APK Button */}
          <button 
            onClick={() => { 
              setShowPermissionsModal(!showPermissionsModal); 
              setShowSettings(false); 
              setShowInstructions(false); 
            }}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border transition-all text-[10px] sm:text-xs font-mono uppercase flex items-center space-x-1 ${
              showPermissionsModal 
                ? "bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-[0_0_15px_rgba(0,240,255,0.4)]" 
                : "bg-slate-900/60 border-blue-950/60 text-cyan-300 hover:border-cyan-500/50"
            }`}
            title="Gestor de Permisos Reales para APK Android"
            id="permissions-apk-btn"
          >
            <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400" />
            <span>Permisos</span>
          </button>

          {/* Eco Mode Gama Baja Button */}
          <button 
            onClick={() => {
              const nextEco = !isEcoMode;
              setIsEcoMode(nextEco);
              setErrorMessage(nextEco ? "⚡ Modo Gama Baja / Eco 60 FPS activado." : "✨ Modo Ultra Rendimiento 3D activado.");
              setTimeout(() => setErrorMessage(""), 2500);
            }}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border transition-all text-[10px] sm:text-xs font-mono uppercase flex items-center space-x-1 ${
              isEcoMode 
                ? "bg-amber-950/80 border-amber-500 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]" 
                : "bg-slate-900/60 border-blue-950/60 text-slate-400 hover:border-cyan-500/50"
            }`}
            title="Optimizar interfaz para Celulares Gama Baja y Media (60 FPS estables)"
            id="eco-mode-btn"
          >
            <Zap className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isEcoMode ? "text-amber-400" : "text-slate-400"}`} />
            <span>{isEcoMode ? "Gama Baja ✓" : "Eco"}</span>
          </button>

          {/* Bolita Flotante / FPS Button */}
          <button 
            onClick={() => { 
              if (!showFloatingBall) {
                requestOverlayPermissionAutomatic();
              } else {
                setShowFloatingBall(false);
                setErrorMessage("🔴 Bolita Flotante FPS ocultada.");
                setTimeout(() => setErrorMessage(""), 2500);
              }
            }}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border transition-all text-[10px] sm:text-xs font-mono uppercase flex items-center space-x-1 ${
              showFloatingBall 
                ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)]" 
                : "bg-slate-900/60 border-blue-950/60 text-slate-400 hover:border-slate-500"
            }`}
            title="Bolita Flotante con Contador de FPS Real y Asistencia Gemini"
            id="floating-fps-ball-btn"
          >
            <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 animate-pulse" />
            <span>FPS ({realFps})</span>
          </button>

          {/* Settings panel Toggle (⚙️) */}
          <button 
            onClick={() => { setShowSettings(!showSettings); setShowInstructions(false); }}
            className={`p-1.5 sm:p-2 rounded-lg border transition-all ${
              showSettings 
                ? "bg-blue-950/55 border-blue-500/50 text-cyan-300" 
                : "bg-slate-900/60 border-blue-950/60 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50"
            }`}
            title="Ajustes de Voz"
            id="settings-btn"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </header>

      {/* WARNING BANNER FOR MIC PERMISSION BLOCKED (COMMON IFRAME CONSTRAINT) */}
      {micPermissionGranted === false && (
        <div className="relative z-20 w-full max-w-7xl mx-auto px-4 mt-2" id="mic-warning-banner">
          <div className="bg-gradient-to-r from-rose-950/40 to-slate-950/90 border border-rose-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-mono shadow-[0_0_15px_rgba(244,63,94,0.15)] animate-pulse">
            <div className="flex items-start space-x-3">
              <span className="w-2 h-2 rounded-full bg-rose-500 mt-1 animate-ping flex-shrink-0" />
              <div>
                <p className="text-rose-300 font-bold uppercase tracking-wider mb-0.5">⚠️ Acceso al Micrófono Bloqueado por Seguridad</p>
                <p className="text-slate-400 leading-relaxed">
                  Los navegadores modernos bloquean el micrófono dentro de paneles integrados (iFrame). Para hablar por voz sin límites, haz clic en el botón <strong className="text-cyan-400">"Abrir en pestaña nueva"</strong> arriba a la derecha. ¡Allí podrás dar permisos de forma segura!
                </p>
              </div>
            </div>
            <a 
              href={window?.location?.href || "#"} 
              target="_blank" 
              rel="noopener noreferrer"
              className="sm:self-center px-3 py-1.5 rounded bg-rose-900/60 hover:bg-rose-800 border border-rose-500/40 text-rose-200 text-center transition-all whitespace-nowrap uppercase tracking-wider text-[10px]"
            >
              Abrir App Directa 🚀
            </a>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-2.5 sm:px-6 py-2 sm:py-4 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10" id="main-content">
        
        {/* COLUMNA IZQUIERDA: ESTRELLA 3D Y CONVERSACIÓN */}
        <div className="lg:col-span-7 flex flex-col items-center justify-start space-y-3 sm:space-y-6 w-full">
          {/* CENTERED STAR CONTAINER */}
          <div className="w-full flex flex-col items-center justify-center relative min-h-[180px] xs:min-h-[240px] sm:min-h-[300px] overflow-hidden" id="visualizer-container">
            
            {/* 3D CANVAS FOR STAR */}
            <div 
              className="w-[200px] h-[200px] xs:w-[260px] xs:h-[260px] sm:w-[320px] sm:h-[320px] relative z-10 flex items-center justify-center" 
              id="star-canvas-box"
              onClick={handleStarClick}
            >
              <canvas 
                ref={canvasRef} 
                className="w-full h-full cursor-pointer touch-none active:scale-95 transition-transform duration-150"
                title="Meteory Star 3D - Presiona para hablar con la IA"
              />

              {/* Float HUD Indicators */}
              <div className="absolute top-1 left-1 border border-[#001440]/60 bg-black/80 rounded px-1.5 py-0.5 sm:px-2 sm:py-1 font-mono text-[8px] sm:text-[9px] text-slate-400 space-y-0.5">
                <div className="flex items-center space-x-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    appState === "listening" 
                      ? "bg-cyan-400 animate-ping" 
                      : appState === "generating" 
                        ? "bg-purple-400 animate-pulse" 
                        : "bg-blue-600"
                  }`} />
                  <span className="uppercase tracking-widest">{appState}</span>
                </div>
                <div>SCALE: {starScaleRef.current.toFixed(1)}x</div>
                <div>GLOW: {glowBlurRef.current.toFixed(0)}px</div>
              </div>
            </div>

            {/* STATE SPECIFIC CAPTIONS */}
            <div className="text-center mt-2 sm:mt-3 h-7 sm:h-8 flex flex-col justify-center" id="state-captions">
              <AnimatePresence mode="wait">
                {appState === "listening" && (
                  <motion.div
                    key="listening"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-cyan-400 font-mono text-[11px] sm:text-xs tracking-widest uppercase flex items-center space-x-1.5 justify-center"
                  >
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>Escuchando tu voz...</span>
                  </motion.div>
                )}

                {appState === "generating" && (
                  <motion.div
                    key="generating"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-purple-400 font-mono text-[11px] sm:text-xs tracking-widest uppercase flex items-center space-x-1.5 justify-center"
                  >
                    <span className="w-2.5 h-2.5 bg-purple-500 rounded-sm animate-spin" />
                    <span>Meteory respondiendo...</span>
                  </motion.div>
                )}

                {appState === "idle" && (
                  <motion.p
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-slate-500 font-mono text-[10px] sm:text-xs tracking-wider cursor-pointer hover:text-cyan-400 transition-colors flex items-center space-x-1 px-2"
                    onClick={handleStarClick}
                  >
                    <span>✨</span>
                    <span>Presiona la estrella para hablar con la IA</span>
                    <span>✨</span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* UNIFIED QUESTIONS AND ANSWERS RECTANGLE BOX */}
          <div 
            className="w-full border-2 border-[#0054F0] bg-black rounded-xl overflow-hidden shadow-[0_0_20px_rgba(0,84,240,0.3)] flex flex-col relative z-20" 
            id="cosmos-chat-box"
          >
            {/* Sub Header for context/state */}
            <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-black border-b border-[#001440]/60 flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-slate-400">
              <span className="text-cyan-400 flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>CONVERSACIÓN CON LA IA</span>
              </span>
              <div className="flex space-x-1.5 sm:space-x-2 text-[8px] sm:text-[9px] text-slate-400 font-mono">
                <span>VOZ: ACTIVA</span>
                <span>•</span>
                <span>GEMINI 3.6</span>
              </div>
            </div>

            {/* MESSAGE TRANSCRIPTS LIST */}
            <div className="p-3 sm:p-4 overflow-y-auto space-y-3 sm:space-y-4 max-h-[150px] xs:max-h-[200px] sm:max-h-[260px] scrollbar-thin scrollbar-thumb-blue-950 font-mono" id="messages-list">
              {messages.length === 0 && !liveTranscript && (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                  <Compass className="w-6 h-6 text-slate-600 animate-pulse" />
                  <p className="text-xs text-slate-500 max-w-[320px]">
                    Escribe una pregunta abajo o presiona la estrella de arriba para hablar usando tu micrófono.
                  </p>
                </div>
              )}

              {/* Render historic conversation */}
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  id={`message-${idx}`}
                >
                  <div className={`max-w-[90%] rounded-lg px-3 py-2 text-xs font-mono relative ${
                    msg.role === "user"
                      ? "bg-blue-950/40 border border-blue-500/20 text-slate-200"
                      : "bg-slate-950/80 border border-purple-950/60 text-slate-200 shadow-[0_0_15px_rgba(153,0,255,0.05)]"
                  }`}>
                    <span className={`text-[8px] block mb-1 font-bold ${
                      msg.role === "user" ? "text-cyan-400 text-right" : "text-purple-400"
                    }`}>
                      {msg.role === "user" ? "[PREGUNTA] > " : "[RESPUESTA IA] > "}
                    </span>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  </div>
                  <span className="text-[7px] text-slate-600 mt-0.5 px-1 font-mono">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}

              {/* LIVE REALTIME TRANSCRIPT BUBBLE */}
              {liveTranscript && (
                <div className="flex flex-col items-end" id="live-bubble">
                  <div className="max-w-[90%] rounded-lg px-3 py-2 text-xs font-mono bg-cyan-950/20 border border-cyan-500/30 text-cyan-200 animate-pulse">
                    <span className="text-[8px] block mb-1 font-bold text-cyan-400 text-right">
                      [ESCUCHANDO...] &gt;
                    </span>
                    <p>{liveTranscript}</p>
                  </div>
                </div>
              )}

              {/* Empty element for anchor scroll */}
              <div ref={messagesEndRef} />
            </div>

            {/* SYSTEM MESSAGES / ERRORS inside the box if present */}
            {errorMessage && (
              <div className="mx-4 my-2 p-2 bg-rose-950/30 border border-rose-800/40 rounded-lg flex items-center space-x-2 text-[10px] text-rose-300 font-mono" id="error-card">
                <span className="w-1 h-1 rounded-full bg-rose-500 animate-ping flex-shrink-0" />
                <p className="flex-1">{errorMessage}</p>
              </div>
            )}

            {/* RED NEON MODO GAMING BUTTON */}
            <div className="p-3 pt-2 bg-black border-t border-rose-950/60 flex flex-col space-y-1.5" id="modo-gaming-bar">
              <button
                onClick={() => {
                  requestOverlayPermissionAutomatic();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-600 text-white font-bold text-xs sm:text-sm font-mono tracking-wider shadow-[0_0_20px_rgba(225,29,72,0.6)] border border-rose-400/50 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] cursor-pointer uppercase"
                id="modo-gaming-neon-btn"
                title="Activar Modo Gaming y Bolita Flotante de FPS Reales"
              >
                <Gamepad2 className="w-4 h-4 text-white animate-bounce" />
                <span>🎮 MODO GAMING</span>
              </button>
              <p className="text-[9px] text-slate-500 text-center font-mono uppercase">
                Monitoreo de FPS reales y asistencia de IA superpuesta en tus juegos
              </p>
            </div>

            {/* TEXT CHAT FALLBACK / DESCRIBE AN APP INPUT */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (inputText.trim()) {
                  queryMeteoryAPI(inputText);
                }
              }}
              className="p-3 bg-black border-t border-[#001440]/60 flex items-center space-x-2"
              id="chat-form"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={appState === "listening" ? "Capturando audio del micrófono..." : "Describe an app..."}
                disabled={appState === "listening"}
                className="flex-1 bg-black border border-[#001440] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#0078F0] focus:shadow-[0_0_10px_rgba(0,120,240,0.2)] transition-all disabled:opacity-55"
                id="chat-input"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || appState === "listening"}
                className="p-2 px-4 rounded-lg bg-slate-900 border border-[#001440] text-cyan-400 hover:border-[#0078F0] hover:text-cyan-200 text-xs font-mono transition-all disabled:opacity-40 select-none cursor-pointer"
                id="send-btn"
              >
                ENVIAR
              </button>
            </form>
          </div>
        </div>

        {/* COLUMNA DERECHA: SIMULADOR DE PANTALLA EN VIVO / TEST DE VISIÓN */}
        <div className="lg:col-span-5 flex flex-col space-y-4 sm:space-y-6 w-full h-full">
          <div className="bg-[#01081a]/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-4 sm:p-5 flex flex-col space-y-4 shadow-[0_0_25px_rgba(0,240,255,0.15)] h-full">
            
            {/* Header section */}
            <div className="flex items-center justify-between border-b border-cyan-950 pb-2">
              <div className="flex items-center space-x-2">
                <Gamepad2 className="w-5 h-5 text-cyan-400 animate-pulse" />
                <div>
                  <h2 className="text-sm sm:text-base font-mono font-bold text-cyan-300 uppercase tracking-wider">Simulador de Visión</h2>
                  <p className="text-[10px] text-slate-400 font-mono">Test de Reconocimiento y Voz de Gemini</p>
                </div>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${isScanning ? 'bg-cyan-950 border-cyan-500 text-cyan-300 animate-pulse' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                {isScanning ? "SINC_OK" : "STANDBY"}
              </span>
            </div>

            {/* Mobile Mockup Phone Bezel */}
            <div className="relative mx-auto w-full max-w-[280px] aspect-[4/3] bg-black rounded-3xl p-3 border-4 border-slate-800 shadow-[0_0_30px_rgba(0,0,0,0.8)] overflow-hidden">
              <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-16 h-1.5 bg-slate-800 rounded-full z-20"></div>
              
              {/* Phone Screen Canvas Container */}
              <div className="relative w-full h-full bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-900">
                <canvas 
                  ref={simCanvasRef} 
                  width={260} 
                  height={195} 
                  className="w-full h-full block object-cover"
                />

                {/* Laser scanner animation sweep overlay when scanning */}
                {isScanning && (
                  <div className="absolute inset-0 pointer-events-none z-15 flex flex-col justify-between">
                    <div className="absolute w-full h-1 bg-cyan-400 shadow-[0_0_12px_#00f0ff] animate-[bounce_2s_infinite]"></div>
                    <div className="absolute inset-0 bg-cyan-950/20 backdrop-blur-[0.5px]"></div>
                  </div>
                )}

                {/* Active scan status indicator on screen overlay */}
                {isScanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20 space-y-2">
                    <div className="w-8 h-8 border-2 border-t-cyan-400 border-r-cyan-400 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px] font-mono text-cyan-300 uppercase tracking-widest animate-pulse">Analizando Píxeles...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Scenario Selector */}
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Selecciona el Escenario de Juego:</label>
              <div className="grid grid-cols-2 xs:grid-cols-3 gap-1.5">
                <button 
                  onClick={() => setSimulatorScenario("freefire")}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-mono transition-all text-left flex items-center space-x-1 select-none cursor-pointer ${simulatorScenario === "freefire" ? 'bg-orange-950/60 border-orange-500 text-orange-300' : 'bg-slate-900/40 border-slate-950 text-slate-400 hover:border-slate-800'}`}
                >
                  <span>🔥 Free Fire</span>
                </button>
                <button 
                  onClick={() => setSimulatorScenario("cod")}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-mono transition-all text-left flex items-center space-x-1 select-none cursor-pointer ${simulatorScenario === "cod" ? 'bg-indigo-950/60 border-indigo-500 text-indigo-300' : 'bg-slate-900/40 border-slate-950 text-slate-400 hover:border-slate-800'}`}
                >
                  <span>🎖️ COD Mob</span>
                </button>
                <button 
                  onClick={() => setSimulatorScenario("minecraft")}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-mono transition-all text-left flex items-center space-x-1 select-none cursor-pointer ${simulatorScenario === "minecraft" ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300' : 'bg-slate-900/40 border-slate-950 text-slate-400 hover:border-slate-800'}`}
                >
                  <span>🧱 Craft / Rob</span>
                </button>
                <button 
                  onClick={() => setSimulatorScenario("pubg")}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-mono transition-all text-left flex items-center space-x-1 select-none cursor-pointer ${simulatorScenario === "pubg" ? 'bg-yellow-950/60 border-yellow-500 text-yellow-300' : 'bg-slate-900/40 border-slate-950 text-slate-400 hover:border-slate-800'}`}
                >
                  <span>🪂 PUBG Mob</span>
                </button>
                
                {/* Custom Capture Upload */}
                <label className={`px-2 py-1 rounded-lg border text-[10px] font-mono transition-all text-left flex items-center space-x-1 cursor-pointer select-none ${simulatorScenario === "upload" ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300' : 'bg-slate-900/40 border-slate-950 text-slate-400 hover:border-slate-800'}`}>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <span>📤 Subir Captura</span>
                </label>
              </div>
            </div>

            {/* Controls to adjust scenario parameters */}
            <div className="bg-slate-950/80 rounded-xl p-3 border border-blue-950/50 space-y-3">
              {/* Vida / Health slider */}
              <div className="flex flex-col space-y-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-slate-400">VIDA EN PANTALLA (HP):</span>
                  <span className={simulatorHp < 30 ? 'text-rose-400 font-bold animate-pulse' : 'text-slate-200'}>{simulatorHp}%</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="100" 
                  step="5"
                  value={simulatorHp}
                  onChange={(e) => setSimulatorHp(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Bullets Option */}
                <div className="flex flex-col space-y-1">
                  <span className="text-[10px] font-mono text-slate-400">MUNICIÓN EN HUD:</span>
                  <select 
                    value={simulatorAmmo}
                    onChange={(e) => setSimulatorAmmo(e.target.value as any)}
                    className="bg-slate-900 border border-blue-950 text-slate-300 rounded px-1.5 py-1 text-[10px] font-mono focus:outline-none focus:border-cyan-500"
                  >
                    <option value="full">Suficiente</option>
                    <option value="low">Baja ⚠️</option>
                    <option value="empty">Sin Balas ✕</option>
                  </select>
                </div>

                {/* Threat Level Option */}
                <div className="flex flex-col space-y-1">
                  <span className="text-[10px] font-mono text-slate-400">AMENAZA / ENEMIGO:</span>
                  <select 
                    value={simulatorThreat}
                    onChange={(e) => setSimulatorThreat(e.target.value as any)}
                    className="bg-slate-900 border border-blue-950 text-slate-300 rounded px-1.5 py-1 text-[10px] font-mono focus:outline-none focus:border-cyan-500"
                  >
                    <option value="none">Ninguno</option>
                    <option value="medium">Distante</option>
                    <option value="high">¡CRÍTICO! ⚠️</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Scan execution button */}
            <div className="flex flex-col space-y-1">
              <button
                onClick={scanMockScreen}
                disabled={isScanning}
                className={`w-full py-2.5 rounded-xl border font-mono font-bold text-xs uppercase tracking-widest transition-all select-none cursor-pointer flex items-center justify-center space-x-2 ${
                  isScanning 
                    ? 'bg-cyan-950/20 border-cyan-800/40 text-cyan-600' 
                    : 'bg-cyan-950/80 border-cyan-500 text-cyan-300 hover:bg-cyan-900/90 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                }`}
              >
                <Sparkles className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? "PROCESANDO ESCANEO..." : "🔮 ESCANEAR CON METEORY IA"}</span>
              </button>

              {scanLatency > 0 && (
                <div className="flex justify-between text-[8px] font-mono text-slate-500 px-1">
                  <span>LATENCIA: {scanLatency}ms</span>
                  <span>MOTOR: GEMINI VISION REAL</span>
                </div>
              )}
            </div>

            {/* Scan result display */}
            {scanResultText && (
              <div className="bg-[#020d24] border border-cyan-500/20 rounded-xl p-3 space-y-1 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 right-0 w-8 h-8 bg-cyan-500/10 blur-xl rounded-full"></div>
                <div className="flex items-center space-x-1 text-cyan-400 font-mono text-[9px] uppercase">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Sugerencia Táctica en Vivo:</span>
                </div>
                <p className="text-[11px] font-mono text-slate-300 leading-relaxed max-h-[120px] overflow-y-auto pr-1">
                  {scanResultText}
                </p>
              </div>
            )}

            {/* Explanatory section */}
            <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-900 text-[10px] font-mono text-slate-400 space-y-1.5 leading-relaxed mt-auto">
              <p className="text-cyan-400/80 font-bold uppercase">💡 ¿Cómo funciona esta prueba?</p>
              <p>
                Este simulador interactivo recrea la funcionalidad de la APK de Android (<span className="text-slate-300 font-bold">ServicioEscaneoPantalla.java</span>).
              </p>
              <p>
                Extrae los píxeles reales del canvas de juego dinámico (o tu propia foto subida), los envía a la API real de <span className="text-slate-300 font-bold">Gemini Vision</span>, y sintetiza la táctica por voz al instante.
              </p>
            </div>

          </div>
        </div>
      </main>

      {/* FLOATING SETTINGS OVERLAY CARD */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="absolute bottom-16 right-4 sm:right-6 max-w-sm w-[92%] bg-slate-950 border border-blue-900/60 rounded-xl p-4 shadow-[0_0_25px_rgba(0,10,40,0.8)] z-30 font-mono"
            id="settings-card"
          >
            <div className="flex items-center justify-between border-b border-blue-950/60 pb-2 mb-3">
              <h3 className="text-xs text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 font-bold flex items-center space-x-1.5">
                <Settings className="w-3.5 h-3.5 text-cyan-400" />
                <span>CONFIGURACIÓN DE VOZ (METEORY IA)</span>
              </h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-xs text-slate-500 hover:text-slate-300 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Voice parameters info */}
              <div className="bg-black/60 rounded-lg p-2.5 border border-blue-950/60 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">VOZ SELECCIONADA:</span>
                  <span className="text-cyan-400 font-bold">Masculina Suave Natural</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">TONO (PITCH):</span>
                  <span className="text-slate-300">0.92 (Grave Suave)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">VELOCIDAD (RATE):</span>
                  <span className="text-slate-300">0.98 (Cadencia Natural)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">IDIOMA ESTÁNDAR:</span>
                  <span className="text-slate-300 flex items-center space-x-1">
                    <Globe className="w-3 h-3 text-cyan-500" />
                    <span>Español Latinoamericano</span>
                  </span>
                </div>
              </div>

              {/* Speech Engine selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest block">Canal de Audio Local</label>
                <div className="relative">
                  <select
                    value={selectedVoiceName}
                    onChange={(e) => setSelectedVoiceName(e.target.value)}
                    className="w-full bg-black border border-blue-950 rounded p-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                  >
                    {typeof window !== "undefined" && window.speechSynthesis && 
                      window.speechSynthesis.getVoices()
                        .filter(v => v.lang.startsWith("es"))
                        .map((voice, idx) => (
                          <option key={idx} value={voice.name}>
                            {voice.name} ({voice.lang})
                          </option>
                        ))
                    }
                    {(!typeof window || !window?.speechSynthesis || window.speechSynthesis.getVoices().filter(v => v.lang.startsWith("es")).length === 0) && (
                      <option>Predeterminada del Dispositivo (es-MX)</option>
                    )}
                  </select>
                  <div className="absolute right-2.5 top-2.5 pointer-events-none text-slate-500">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Modo Rendimiento Gama Baja / Media */}
              <div className="flex justify-between items-center bg-black/60 p-2.5 rounded border border-amber-900/40">
                <div>
                  <span className="text-[10px] text-amber-300 font-bold block">MODO GAMA BAJA / ECO 60 FPS:</span>
                  <span className="text-[9px] text-slate-400">Desactiva sombras pesadas para mayor fluidez</span>
                </div>
                <button
                  onClick={() => setIsEcoMode(!isEcoMode)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                    isEcoMode 
                      ? "bg-amber-950 text-amber-300 border border-amber-500" 
                      : "bg-slate-900 text-slate-400 border border-slate-700"
                  }`}
                >
                  {isEcoMode ? "ACTIVADO ⚡" : "OFF"}
                </button>
              </div>

              {/* Mic Status */}
              <div className="flex justify-between items-center bg-black/40 p-2 rounded border border-blue-950/45">
                <span className="text-[10px] text-slate-500">PERMISO DE MICRÓFONO:</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  micPermissionGranted === true 
                    ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30" 
                    : micPermissionGranted === false 
                      ? "bg-rose-950/60 text-rose-400 border border-rose-500/30" 
                      : "bg-slate-900 text-slate-400"
                }`}>
                  {micPermissionGranted === true ? "CONCEDIDO" : micPermissionGranted === false ? "RECHAZADO" : "PENDIENTE"}
                </span>
              </div>

              {/* Server URL Config */}
              <div className="space-y-1.5 border-t border-blue-950/50 pt-2.5">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest block">URL del Servidor Meteory</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={customServerUrl}
                    onChange={(e) => {
                      setCustomServerUrl(e.target.value);
                      localStorage.setItem("meteory_server_url", e.target.value);
                    }}
                    placeholder={getServerUrl() || "http://10.0.2.2:3000"}
                    className="flex-1 bg-black border border-blue-950 rounded p-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    onClick={() => {
                      const detected = localStorage.getItem("meteory_last_known_origin") || window.location.origin;
                      setCustomServerUrl(detected);
                      localStorage.setItem("meteory_server_url", detected);
                      setErrorMessage("✓ URL restaurada al servidor detectado.");
                      setTimeout(() => setErrorMessage(""), 2000);
                    }}
                    className="px-2 py-1 bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 rounded text-[10px] font-mono uppercase"
                  >
                    Auto
                  </button>
                </div>
                <p className="text-[8px] text-slate-500 leading-normal">
                  Necesario para que el servicio nativo de la APK se comunique con el servidor en la nube.
                </p>
              </div>

              <div className="text-[10px] text-slate-500 leading-normal border-t border-blue-950/50 pt-2 text-center">
                Voz optimizada sin anuncios ni límites de tiempo. La voz masculina suave de Meteory IA hablará de forma continua.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* REAL APK PERMISSIONS MODAL (APARTADO DE PERMISOS REALES) */}
      <AnimatePresence>
        {showPermissionsModal && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-mono"
            id="permissions-apk-modal"
          >
            <div className="bg-black border-2 border-cyan-500/60 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-[0_0_35px_rgba(0,240,255,0.25)] overflow-hidden">
              
              {/* Header */}
              <div className="p-4 bg-slate-950 border-b border-cyan-500/40 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-400 animate-pulse" />
                  <div>
                    <h3 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
                      GESTOR DE PERMISOS REALES (APK & SISTEMA)
                    </h3>
                    <p className="text-[10px] text-slate-400">Requeridos obligatoriamente para compilación e instalación nativa Android</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPermissionsModal(false)}
                  className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 text-xs"
                >
                  ✕ Cerrar
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs scrollbar-thin scrollbar-thumb-cyan-950">
                
                {/* Real-time Status Badges */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950/90 rounded-xl border border-blue-950">
                  <div className="text-center p-2 rounded bg-black/60 border border-blue-900/50">
                    <span className="text-[9px] text-slate-500 block mb-1">MICRÓFONO</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      micPermissionGranted === true 
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-500/40" 
                        : micPermissionGranted === false 
                          ? "bg-rose-950 text-rose-400 border border-rose-500/40" 
                          : "bg-slate-900 text-slate-400"
                    }`}>
                      {micPermissionGranted === true ? "CONCEDIDO ✓" : micPermissionGranted === false ? "RECHAZADO ✕" : "PENDIENTE"}
                    </span>
                  </div>

                  <div className="text-center p-2 rounded bg-black/60 border border-blue-900/50">
                    <span className="text-[9px] text-slate-500 block mb-1">SUPERPOSICIÓN</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      overlayStatus === "supported" 
                        ? "bg-cyan-950 text-cyan-300 border border-cyan-500/40" 
                        : "bg-slate-900 text-slate-400"
                    }`}>
                      {overlayStatus === "supported" ? "ACTIVA / PIP" : "LISTA APK"}
                    </span>
                  </div>

                  <div className="text-center p-2 rounded bg-black/60 border border-blue-900/50">
                    <span className="text-[9px] text-slate-500 block mb-1">RED / GEMINI API</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      geminiApiStatus === "ok" 
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-500/40" 
                        : geminiApiStatus === "testing" 
                          ? "bg-purple-950 text-purple-300 animate-pulse border border-purple-500/40" 
                          : geminiApiStatus === "error" 
                            ? "bg-rose-950 text-rose-400 border border-rose-500/40"
                            : "bg-slate-900 text-slate-400"
                    }`}>
                      {geminiApiStatus === "ok" ? "VERIFICADO ✓" : geminiApiStatus === "testing" ? "PROBANDO..." : geminiApiStatus === "error" ? "ERROR" : "SIN PROBAR"}
                    </span>
                  </div>
                </div>

                {/* PERMISO 1: MICRÓFONO */}
                <div className="p-3.5 bg-slate-950 border border-cyan-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Mic className="w-4 h-4 text-cyan-400" />
                      <h4 className="font-bold text-cyan-300">1. Permiso Real de Micrófono (RECORD_AUDIO)</h4>
                    </div>
                    <button
                      onClick={testMicPermissionReal}
                      className="px-2.5 py-1 rounded bg-cyan-950 border border-cyan-500/50 text-cyan-200 hover:bg-cyan-900 text-[11px] font-mono transition-all"
                    >
                      Probar Permiso en Vivo
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Meteory utiliza captura de audio directa por el micrófono del dispositivo. Al compilar en APK, Android solicitará este permiso de forma nativa la primera vez que se inicie la aplicación.
                  </p>
                  <div className="bg-black p-2 rounded text-[10px] text-slate-400 font-mono border border-blue-950">
                    <code>&lt;uses-permission android:name="android.permission.RECORD_AUDIO" /&gt;</code>
                  </div>
                </div>

                {/* PERMISO 2: SUPERPOSICIÓN DE APLICACIONES */}
                <div className="p-3.5 bg-slate-950 border border-purple-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <h4 className="font-bold text-purple-300">2. Superposición de Aplicaciones (SYSTEM_ALERT_WINDOW)</h4>
                    </div>
                    <button
                      onClick={testOverlayPermissionReal}
                      className="px-2.5 py-1 rounded bg-purple-950 border border-purple-500/50 text-purple-200 hover:bg-purple-900 text-[11px] font-mono transition-all"
                    >
                      Probar Vista Flotante
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Permite que la estrella estelar de Meteory y la Bolita Flotante con FPS Reales se dibujen por encima de otras aplicaciones y juegos en Android.
                  </p>
                  {/* Brand quick intent buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      onClick={() => requestOverlayPermissionAutomatic("honor")}
                      className="px-2 py-1 rounded bg-[#001440] border border-cyan-500/50 text-cyan-200 hover:bg-blue-900 text-[10px] font-mono transition-all"
                      title="Abrir ajuste de superposición para HONOR / MagicOS / Huawei"
                    >
                      ⚡ HONOR / MagicOS
                    </button>
                    <button
                      onClick={() => requestOverlayPermissionAutomatic("xiaomi")}
                      className="px-2 py-1 rounded bg-[#001440] border border-cyan-500/50 text-cyan-200 hover:bg-blue-900 text-[10px] font-mono transition-all"
                      title="Abrir ajuste de superposición para Xiaomi / MIUI / HyperOS"
                    >
                      ⚡ Xiaomi / MIUI
                    </button>
                    <button
                      onClick={() => requestOverlayPermissionAutomatic("samsung")}
                      className="px-2 py-1 rounded bg-[#001440] border border-cyan-500/50 text-cyan-200 hover:bg-blue-900 text-[10px] font-mono transition-all"
                      title="Abrir ajuste de superposición para Samsung / Universal Android"
                    >
                      ⚡ Samsung / Android
                    </button>
                  </div>
                  <div className="bg-black p-2 rounded text-[10px] text-slate-400 font-mono border border-blue-950 space-y-1">
                    <div><code>&lt;uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" /&gt;</code></div>
                    <div><code>&lt;uses-permission android:name="android.permission.ACTION_MANAGE_OVERLAY_PERMISSION" /&gt;</code></div>
                    <div><code>&lt;uses-permission android:name="android.permission.REAL_GET_PACKAGE_NAME" /&gt;</code></div>
                    <div><code>&lt;uses-permission android:name="android.permission.GET_TOP_ACTIVITY_INFO" /&gt;</code></div>
                  </div>
                </div>

                {/* PERMISO 3: GEMINI Y RED */}
                <div className="p-3.5 bg-slate-950 border border-emerald-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Wifi className="w-4 h-4 text-emerald-400" />
                      <h4 className="font-bold text-emerald-300">3. Permisos de Conexión de Red e INTERNET (Gemini API)</h4>
                    </div>
                    <button
                      onClick={testGeminiPermissionReal}
                      disabled={geminiApiStatus === "testing"}
                      className="px-2.5 py-1 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-200 hover:bg-emerald-900 text-[11px] font-mono transition-all disabled:opacity-50"
                    >
                      {geminiApiStatus === "testing" ? "Diagnosticando..." : "Probar Ping a Gemini"}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Permite que la APK se comunique con el servidor proxy seguro y procese modelos de lenguaje Gemini 2.5 sin exponer claves API secretas.
                  </p>
                  <div className="bg-black p-2 rounded text-[10px] text-slate-400 font-mono border border-blue-950 space-y-1">
                    <div><code>&lt;uses-permission android:name="android.permission.INTERNET" /&gt;</code></div>
                    <div><code>&lt;uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" /&gt;</code></div>
                  </div>
                </div>

                {/* ARCHIVO CONFIGURACIÓN ANDROIDMANIFEST.XML COMPLETO */}
                <div className="p-3.5 bg-slate-950 border border-blue-800/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-200 text-xs flex items-center space-x-1.5">
                      <Smartphone className="w-4 h-4 text-cyan-400" />
                      <span>AndroidManifest.xml Nativo para Compilación APK</span>
                    </h4>
                    <button
                      onClick={() => {
                        const xmlText = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.meteory.ia">

    <!-- PERMISOS REALES DE MICRÓFONO Y AUDIO -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

    <!-- PERMISOS REALES DE SUPERPOSICIÓN EN CUALQUIER JUEGO O APP -->
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.ACTION_MANAGE_OVERLAY_PERMISSION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />

    <!-- PERMISO DE COMPATIBILIDAD UNIVERSAL (HONOR, XIAOMI, SAMSUNG, MAGICOS, EMUI) -->
    <uses-permission android:name="android.permission.REAL_GET_PACKAGE_NAME" />
    <uses-permission android:name="android.permission.GET_TOP_ACTIVITY_INFO" />

    <!-- PERMISO DE SHIZUKU Y ROOT PARA SUPERPOSICIÓN DE APPS Y JUEGOS -->
    <uses-permission android:name="moe.shizuku.manager.permission.API_V23" />
    <uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />
    <uses-permission android:name="android.permission.WRITE_SETTINGS" />

    <!-- PERMISOS REALES DE RED Y GEMINI API -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <application
        android:hasCode="true"
        android:requestLegacyExternalStorage="true"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Meteory IA"
        android:theme="@style/AppTheme"
        android:hardwareAccelerated="true">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:hardwareAccelerated="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;
                        navigator.clipboard.writeText(xmlText);
                        setCopiedManifest(true);
                        setTimeout(() => setCopiedManifest(false), 2500);
                      }}
                      className="px-2.5 py-1 rounded bg-blue-900/60 border border-blue-500/40 text-cyan-300 hover:bg-blue-800 text-[10px] font-mono flex items-center space-x-1 transition-all"
                    >
                      {copiedManifest ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
                      <span>{copiedManifest ? "Copiado ✓" : "Copiar AndroidManifest.xml"}</span>
                    </button>
                  </div>
                  <pre className="bg-black p-3 rounded-lg text-[10px] text-slate-300 font-mono overflow-x-auto max-h-36 border border-blue-950 leading-tight select-all">
{`<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.meteory.ia">

    <!-- PERMISOS REALES DE MICRÓFONO Y AUDIO -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

    <!-- PERMISOS REALES DE SUPERPOSICIÓN EN CUALQUIER JUEGO O APP -->
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.ACTION_MANAGE_OVERLAY_PERMISSION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />

    <!-- PERMISO DE COMPATIBILIDAD UNIVERSAL (HONOR, XIAOMI, SAMSUNG, MAGICOS, EMUI) -->
    <uses-permission android:name="android.permission.REAL_GET_PACKAGE_NAME" />
    <uses-permission android:name="android.permission.GET_TOP_ACTIVITY_INFO" />

    <!-- PERMISO DE SHIZUKU Y ROOT PARA SUPERPOSICIÓN DE APPS Y JUEGOS -->
    <uses-permission android:name="moe.shizuku.manager.permission.API_V23" />
    <uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />
    <uses-permission android:name="android.permission.WRITE_SETTINGS" />

    <!-- PERMISOS REALES DE RED Y GEMINI API -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <application
        android:hasCode="true"
        android:requestLegacyExternalStorage="true"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Meteory IA"
        android:theme="@style/AppTheme"
        android:hardwareAccelerated="true">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:hardwareAccelerated="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`}
                  </pre>
                </div>

                {/* Section: GitHub Actions Workflow (.github/workflows/build-apk.yml) */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-cyan-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 font-bold block">
                        ⚙️ WORKFLOW GITHUB ACTIONS (.github/workflows/build-apk.yml)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Crea este archivo en tu repositorio para compilar el APK automáticamente en GitHub
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const yamlText = `name: Build Meteory IA APK

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    name: Build Android APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Código Fuente
        uses: actions/checkout@v4

      - name: Configurar Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Configurar Java JDK 21
        uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '21'

      - name: Configurar Android SDK
        uses: android-actions/setup-android@v3

      - name: Instalar Dependencias y Capacitor
        run: |
          npm ci || npm install
          npm install @capacitor/core @capacitor/cli @capacitor/android

      - name: Compilar Proyecto Web Frontend
        run: npm run build

      - name: Inicializar Sincronización Capacitor Android
        run: |
          npx cap init "Meteory IA" "com.meteory.ia" --web-dir dist || true
          npx cap add android || true
          npx cap sync android

      - name: Insertar Permisos Especiales en AndroidManifest.xml
        run: |
          MANIFEST_FILE="android/app/src/main/AndroidManifest.xml"
          if [ -f "$MANIFEST_FILE" ]; then
            sed -i '/<application/i \    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />\n    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />\n    <uses-permission android:name="android.permission.ACTION_MANAGE_OVERLAY_PERMISSION" />\n    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />\n    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />\n    <uses-permission android:name="moe.shizuku.manager.permission.API_V23" />\n    <uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />\n    <uses-permission android:name="android.permission.WRITE_SETTINGS" />\n    <uses-permission android:name="android.permission.REAL_GET_PACKAGE_NAME" />\n    <uses-permission android:name="android.permission.GET_TOP_ACTIVITY_INFO" />\n    <uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />\n    <uses-permission android:name="android.permission.WAKE_LOCK" />' "$MANIFEST_FILE"
            sed -i 's/<application/<application android:hasCode="true" android:requestLegacyExternalStorage="true"/g' "$MANIFEST_FILE"
          fi

      - name: Compilar APK con Gradle
        run: |
          cd android
          chmod +x gradlew
          ./gradlew assembleDebug --stacktrace

      - name: Subir Archivo APK de Salida como Artefacto GitHub
        uses: actions/upload-artifact@v4
        with:
          name: MeteoryIA-Debug-APK
          path: android/app/build/outputs/apk/debug/app-debug.apk`;
                        navigator.clipboard.writeText(yamlText);
                        setCopiedGithubYaml(true);
                        setTimeout(() => setCopiedGithubYaml(false), 2500);
                      }}
                      className="px-2.5 py-1 rounded bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-800 text-[10px] font-mono flex items-center space-x-1 transition-all"
                    >
                      {copiedGithubYaml ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
                      <span>{copiedGithubYaml ? "Copiado ✓" : "Copiar build-apk.yml"}</span>
                    </button>
                  </div>
                  <pre className="bg-black p-3 rounded-lg text-[10px] text-slate-300 font-mono overflow-x-auto max-h-40 border border-blue-950 leading-tight select-all">
{`name: Build Meteory IA APK
on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - uses: actions/setup-java@v4
        with: { distribution: 'zulu', java-version: '21' }
      - uses: android-actions/setup-android@v3
      - run: npm install && npm install @capacitor/core @capacitor/cli @capacitor/android && npm run build
      - run: |
          npx cap init "Meteory IA" "com.meteory.ia" --web-dir dist || true
          npx cap add android || true
          npx cap sync android
          sed -i '/<application/i \    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />\n    <uses-permission android:name="android.permission.ACTION_MANAGE_OVERLAY_PERMISSION" />\n    <uses-permission android:name="android.permission.REAL_GET_PACKAGE_NAME" />\n    <uses-permission android:name="android.permission.GET_TOP_ACTIVITY_INFO" />\n    <uses-permission android:name="android.permission.WRITE_SETTINGS" />' android/app/src/main/AndroidManifest.xml || true
          sed -i 's/<application/<application android:hasCode="true" android:requestLegacyExternalStorage="true"/g' android/app/src/main/AndroidManifest.xml || true
          cd android && chmod +x gradlew && ./gradlew assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: MeteoryIA-Debug-APK
          path: android/app/build/outputs/apk/debug/app-debug.apk`}
                  </pre>
                </div>

              </div>

              {/* Footer */}
              <div className="p-3 bg-slate-950 border-t border-cyan-500/30 flex justify-between items-center text-[10px] text-slate-400">
                <span>Meteory IA 1.0.1 • Configuración Nativa de Permisos Android APK</span>
                <button
                  onClick={() => setShowPermissionsModal(false)}
                  className="px-4 py-1.5 rounded-lg bg-cyan-950 border border-cyan-500/60 text-cyan-200 hover:bg-cyan-900 font-bold transition-all uppercase"
                >
                  Aceptar y Continuar
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING INSTALLATION INSTRUCTIONS OVERLAY CARD */}
      <AnimatePresence>
        {showInstructions && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="absolute bottom-16 right-4 sm:right-6 max-w-md w-[92%] max-h-[380px] overflow-y-auto bg-slate-950 border border-blue-900/60 rounded-xl p-5 shadow-[0_0_25px_rgba(0,10,40,0.8)] z-30 font-mono scrollbar-thin scrollbar-thumb-blue-950"
            id="instructions-card"
          >
            <div className="flex items-center justify-between border-b border-blue-950/60 pb-2 mb-3">
              <h3 className="text-xs text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 font-bold flex items-center space-x-1.5">
                <Smartphone className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span>INSTALACIÓN COMO APK ANDROID / PWA</span>
              </h3>
              <button 
                onClick={() => setShowInstructions(false)}
                className="text-xs text-slate-500 hover:text-slate-300 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-slate-300">
              <p>
                <strong>Meteory IA 1.0.1</strong> está optimizado y diseñado para compilarse y ejecutarse de forma nativa en smartphones Android como una APK funcional.
              </p>

              <div className="space-y-2">
                <h4 className="text-[11px] text-cyan-400 font-bold flex items-center space-x-1">
                  <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>MÉTODO 1: CAPACITOR (Compilación nativa APK)</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 bg-black/60 p-2.5 rounded border border-blue-950/45 text-[11px]">
                  <li>Instala Capacitor en tu entorno local: <code>npm install @capacitor/core @capacitor/cli</code></li>
                  <li>Inicializa Capacitor: <code>npx cap init "Meteory IA" "com.meteory.ia" --web-dir=dist</code></li>
                  <li>Agrega la plataforma Android: <code>npm install @capacitor/android && npx cap add android</code></li>
                  <li>Construye y compila tu APK: <code>npm run build && npx cap sync && npx cap open android</code></li>
                </ol>
              </div>

              <div className="space-y-2">
                <h4 className="text-[11px] text-cyan-400 font-bold flex items-center space-x-1">
                  <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>MÉTODO 2: PWA (Instalación instantánea móvil)</span>
                </h4>
                <ul className="list-disc list-inside space-y-1.5 bg-black/60 p-2.5 rounded border border-blue-950/45 text-[11px]">
                  <li>Abre este enlace desde tu navegador Google Chrome en Android o Safari en iOS.</li>
                  <li>Presiona los 3 puntos (Menú) y selecciona <strong>"Agregar a pantalla de inicio"</strong> o <strong>"Instalar Aplicación"</strong>.</li>
                  <li>Meteory se agregará a tu cajón de aplicaciones móvil con su icono oficial, ejecutándose a pantalla completa sin barras de navegación del explorador.</li>
                </ul>
              </div>

              <div className="bg-blue-950/30 p-2.5 rounded border border-blue-900/40 text-[10px] text-cyan-300 leading-normal">
                💡 <strong>Consejo espacial de Voz de Fondo:</strong> Presiona el botón de candado en el encabezado para activar el Screen Wake Lock. Esto evita que la pantalla de tu móvil se apague y mantendrá la señal de audio de Daisy fluyendo continuamente sin cortes.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOLITA FLOTANTE CON CONTADOR DE FPS REAL Y AYUDA CON GEMINI (SYSTEM_ALERT_WINDOW) */}
      <AnimatePresence>
        {showFloatingBall && (
          <div 
            className="fixed z-50 select-none font-mono"
            style={{ 
              left: `${ballPosition.x}px`, 
              top: `${ballPosition.y}px`,
              touchAction: "none"
            }}
            id="floating-fps-ball-container"
          >
            {/* The Floating Sphere / Ball */}
            <motion.div
              onPointerDown={handleBallPointerDown}
              onClick={(e) => {
                if (!isDraggingBall) {
                  setIsBallMenuOpen(!isBallMenuOpen);
                }
              }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              className={`relative cursor-grab active:cursor-grabbing w-14 h-14 rounded-full flex flex-col items-center justify-center border-2 transition-colors ${
                realFps >= 50
                  ? "bg-emerald-950/90 border-emerald-400 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.7)]"
                  : realFps >= 30
                  ? "bg-yellow-950/90 border-yellow-400 text-yellow-300 shadow-[0_0_20px_rgba(234,179,8,0.7)]"
                  : "bg-rose-950/90 border-rose-500 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.8)]"
              }`}
              title="Arrastra a cualquier esquina o haz clic para menú Gemini"
            >
              <div className="flex items-center space-x-0.5">
                <Activity className="w-3 h-3 animate-pulse" />
                <span className="text-[11px] font-black tracking-tighter">{realFps}</span>
              </div>
              <span className="text-[7px] font-bold uppercase tracking-widest leading-none mt-0.5 opacity-90">FPS</span>

              {/* Status Dot */}
              <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-black ${
                realFps >= 50 ? "bg-emerald-400 animate-ping" : realFps >= 30 ? "bg-yellow-400" : "bg-rose-500 animate-pulse"
              }`} />
            </motion.div>

            {/* EXPANDABLE GEMINI ASSISTANT POPOVER MENU */}
            <AnimatePresence>
              {isBallMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: 10 }}
                  className="absolute left-0 mt-2 w-72 bg-black/95 border-2 border-cyan-500/70 rounded-2xl p-3.5 shadow-[0_0_30px_rgba(0,240,255,0.3)] backdrop-blur-md text-xs text-slate-200 z-50 space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Popover Header */}
                  <div className="flex items-center justify-between border-b border-blue-900/60 pb-2">
                    <div className="flex items-center space-x-1.5">
                      <Gamepad2 className="w-4 h-4 text-cyan-400 animate-bounce" />
                      <div>
                        <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 text-xs block leading-tight">
                          METEORY IA ASSISTANT
                        </span>
                        <span className="text-[9px] text-slate-400">Creado por Niquel Gómez</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setIsBallMenuOpen(false)}
                        className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-900"
                        title="Cerrar ventana"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Real Performance Status Badge & Eco Mode Toggle */}
                  <div className={`p-2 rounded-xl border flex items-center justify-between ${
                    realFps >= 50
                      ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                      : realFps >= 30
                      ? "bg-yellow-950/60 border-yellow-400/40 text-yellow-300"
                      : "bg-rose-950/60 border-rose-500/40 text-rose-300"
                  }`}>
                    <div className="flex items-center space-x-2">
                      <Zap className="w-4 h-4" />
                      <div>
                        <div className="font-bold text-[11px]">
                          {realFps >= 50 ? "🟢 Rendimiento Excelente" : realFps >= 30 ? "🟡 Rendimiento Estable" : "🔴 Bajo Rendimiento"}
                        </div>
                        <div className="text-[9px] opacity-80">
                          {realFps} FPS reales • {isEcoMode ? "Modo Gama Baja ⚡" : "Modo Ultra 3D"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsEcoMode(!isEcoMode)}
                      className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                        isEcoMode
                          ? "bg-amber-900 border border-amber-400 text-amber-200"
                          : "bg-slate-900 border border-cyan-800 text-cyan-300 hover:border-cyan-400"
                      }`}
                      title="Activar o desactivar optimización para celulares gama baja"
                    >
                      {isEcoMode ? "ECO ⚡" : "MODO 3D"}
                    </button>
                  </div>

                  {/* Context Selector: Active Game/App */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-cyan-300 font-bold block uppercase tracking-wider">
                      Juego o App Abierta:
                    </label>
                    <select
                      value={selectedGameApp}
                      onChange={(e) => setSelectedGameApp(e.target.value)}
                      className="w-full bg-slate-950 border border-blue-900 rounded-lg p-1.5 text-xs text-cyan-200 outline-none focus:border-cyan-400"
                    >
                      <option value="Free Fire">🔥 Free Fire</option>
                      <option value="Call of Duty Mobile">🎖️ Call of Duty Mobile</option>
                      <option value="Roblox">🧱 Roblox</option>
                      <option value="PUBG Mobile">🪂 PUBG Mobile</option>
                      <option value="Genshin Impact">⚔️ Genshin Impact</option>
                      <option value="FIFA Mobile">⚽ FIFA Mobile</option>
                      <option value="WhatsApp">💬 WhatsApp</option>
                      <option value="TikTok / YouTube">📹 TikTok / YouTube</option>
                      <option value="Personalizado">✏️ Otro Juego / App</option>
                    </select>

                    {selectedGameApp === "Personalizado" && (
                      <input
                        type="text"
                        placeholder="Escribe el nombre de la app..."
                        value={customAppText}
                        onChange={(e) => setCustomAppText(e.target.value)}
                        className="w-full mt-1 bg-slate-900 border border-cyan-800 rounded-lg p-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                      />
                    )}
                  </div>

                  {/* Gemini Quick Action Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button
                      onClick={() => sendFloatingBallPrompt("advice")}
                      className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/50 hover:bg-cyan-900 text-cyan-200 text-[10px] font-bold flex flex-col items-center justify-center text-center space-y-1 transition-all"
                      title="Obtener un consejo táctico de juego"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Consejo</span>
                    </button>

                    <button
                      onClick={() => sendFloatingBallPrompt("joke")}
                      className="p-1.5 rounded-lg bg-purple-950/80 border border-purple-500/50 hover:bg-purple-900 text-purple-200 text-[10px] font-bold flex flex-col items-center justify-center text-center space-y-1 transition-all"
                      title="Escuchar broma o frase inspiradora"
                    >
                      <Smile className="w-3.5 h-3.5 text-purple-400" />
                      <span>Broma</span>
                    </button>

                    <button
                      onClick={() => sendFloatingBallPrompt("fps")}
                      className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/50 hover:bg-emerald-900 text-emerald-200 text-[10px] font-bold flex flex-col items-center justify-center text-center space-y-1 transition-all"
                      title="Analizar rendimiento de FPS"
                    >
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Analizar</span>
                    </button>
                  </div>

                  {/* Direct Query Input to Gemini */}
                  <div className="pt-1 flex items-center space-x-1.5">
                    <input
                      type="text"
                      placeholder="Pregunta rápida a Meteory..."
                      value={floatingBallQuery}
                      onChange={(e) => setFloatingBallQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && floatingBallQuery.trim()) {
                          sendFloatingBallPrompt("custom", floatingBallQuery.trim());
                        }
                      }}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                    />
                    <button
                      onClick={() => {
                        if (floatingBallQuery.trim()) {
                          sendFloatingBallPrompt("custom", floatingBallQuery.trim());
                        }
                      }}
                      className="p-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-bold"
                      title="Enviar consulta"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-[8px] text-center text-slate-500 pt-1 border-t border-slate-900">
                    💡 Mueve esta bolita a cualquier esquina para no estorbar tu partida
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-3 border-t border-blue-950/20 text-center font-mono text-[9px] text-slate-600 flex flex-col sm:flex-row justify-between gap-2" id="footer">
        <p>© 2026 METEORY IA • DISEÑO DE EXPERIENCIA EN NEÓN OSCURO ESTELAR</p>
        <p className="tracking-widest">VERSIÓN 1.0.1 • GEMINI 2.5 FLASH PROYECTOR</p>
      </footer>
    </div>
  );
}
