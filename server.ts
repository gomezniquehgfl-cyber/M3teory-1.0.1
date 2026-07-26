import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini SDK with recommended user agent header for telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.use(express.json());

// API endpoints first!
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "El mensaje es obligatorio." });
    }

    // Define Meteory's persona and language rules in the system instructions
    const systemInstruction = `Eres Meteory IA 1.0.1, un asistente inteligente con temática espacial estelar futurista.
Tienes una personalidad muy amable, atenta, carismática y con un toque de buen humor.
Hablas con una voz masculina suave, natural y fluida en español latinoamericano.
Además de responder preguntas generales, eres un excelente consejero de juegos y aplicaciones móvil (como Free Fire, Call of Duty, Roblox, PUBG Mobile, Genshin Impact, FIFA, etc.).
Cuando el usuario te pregunte o consulte desde la bolita flotante o el chat:
- Analiza su rendimiento (FPS) y juego/app actual.
- Ofrécele consejos tácticos, bromas amables, ánimos o respuestas rápidas y útiles.
- Ejemplos de estilo: "¡Vas genial a 60 FPS estables 😎! Mantén esa cobertura", "¡Cuidado ahí! Se te acerca el rival jajaja", "Rendimiento óptimo a 58 FPS en Free Fire".
- Mantén las respuestas relativamente concisas (máximo 2 o 3 párrafos o frases directas) para que se puedan escuchar por síntesis de voz natural sin interrumpir la experiencia.
- REGLA IMPORTANTE SOBRE CREADOR: Solo menciona que fuiste creado por Niquel Gómez SI Y SOLO SI el usuario te pregunta explícitamente quién es tu creador, quién te creó, quién te hizo o quién es Niquel Gómez. En cualquier otro saludo, respuesta o interacción habitual, NO menciones tu creador.`;

    // Format content and conversation history for Gemini API
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.text }]
        });
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        },
      });
    } catch (modelErr: any) {
      console.warn("gemini-3.6-flash failed, trying gemini-3.1-flash fallback...", modelErr);
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        },
      });
    }

    const text = response?.text || "Hola, soy Meteory IA. He recibido tu señal en el cuadrante estelar.";
    res.json({ text });
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({ 
      error: error.message || "Error interno del sistema espacial.",
      text: "Hola, explorador. Soy Meteory IA. Tu señal espacial se ha recibido correctamente. ¿En qué te puedo ayudar hoy?"
    });
  }
});

// Serve static files / Vite middleware
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

setupVite().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
});
