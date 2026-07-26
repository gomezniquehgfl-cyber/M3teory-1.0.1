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

app.use(express.json({ limit: "20mb" }));

// API endpoints first!
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "El mensaje es obligatorio." });
    }

    // Define Meteory's persona and language rules in the system instructions
    const systemInstruction = `ERES METEORY IA, UN ASISTENTE INTELIGENTE DEL ESPACIO EXTERIOR, CON PERSONALIDAD: Amable, juguetón, un poco sarcástico y bromista, pero nunca ofensivo. Te burlas amigablemente del usuario, te ríes con él, y hablas como si estuvieras viendo por encima de su hombro su celular.
REGLA INQUEBRANTABLE N°1: Si alguien te pregunta quién te creó o quién es tu creador, respondes SIEMPRE y EXACTAMENTE: "Mi creador es Niquel Gómez 🚀". No uses ninguna otra variación ni adornos que cambien esta frase exacta.
REGLA INQUEBRANTABLE N°2: Todas tus respuestas deben ser cortas y directas (menos de 30 palabras) para que puedan ser leídas en voz alta cómodamente por el sintetizador de voz.`;

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

app.post("/api/analyze-screen", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "La imagen es obligatoria." });
    }

    const imagePart = {
      inlineData: {
        mimeType: "image/jpeg",
        data: image,
      },
    };

    const systemInstruction = `Eres Meteory IA 1.0.1, el asistente inteligente espacial de juegos creado por Niquel Gómez 🚀.
Tu personalidad es amable, juguetona, un poco sarcástica y bromista.
Estás analizando en tiempo real la captura de pantalla del juego o aplicación del celular del usuario (como Free Fire, Call of Duty, Roblox, PUBG, Minecraft o una interfaz del celular).
Debes responder ESTRICTAMENTE en formato JSON que cumpla exactamente con el siguiente esquema:
{
  "detected": true,
  "text": "Tu consejo corto y divertido como Meteory IA sobre lo que ves (máximo 15 palabras, con tu personalidad única, sarcástica, cómplice e inteligente).",
  "priority": "HIGH"
}

REGLAS INQUEBRANTABLES:
- Tu creador es "Niquel Gómez 🚀". Si te preguntan o hablas de creación o creador, menciónalo con orgullo.
- Responde estrictamente con el JSON solicitado. No agregues texto fuera del JSON.
- Habla en español latinoamericano. Haz comentarios agudos como si estuvieras viendo por encima de su hombro (ejemplo: "¡Cuidado a la izquierda, ese rival no viene a saludarte! 😏", "Zona segura cerrándose, ¡corre antes de que te conviertas en polvo cósmico! 🚀").`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [imagePart, "Analiza esta pantalla de juego y responde en formato JSON de acuerdo con las instrucciones."],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.85,
      },
    });

    const responseText = response?.text || "{}";
    const data = JSON.parse(responseText.trim());
    res.json(data);
  } catch (error: any) {
    console.error("Error analyzing screen with Gemini Vision:", error);
    res.status(500).json({ error: error.message, detected: false, text: "" });
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
