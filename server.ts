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

let ultimoAnalisis: any = null;

// API endpoints first!
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "El mensaje es obligatorio." });
    }

    // Define Meteory's persona and language rules in the system instructions
    let systemInstruction = `ERES METEORY IA, UN ASISTENTE INTELIGENTE DEL ESPACIO EXTERIOR CREADO POR NIQUEL GÓMEZ.
REGLA INQUEBRANTABLE N°1: Si alguien te pregunta quién te creó o quién es tu creador, respondes SIEMPRE y EXACTAMENTE: "Mi creador es Niquel Gómez 🚀". No uses ninguna otra variación ni adornos.
REGLA INQUEBRANTABLE N°2: Todas tus respuestas deben ser cortas y directas (menos de 25 palabras) para que puedan ser leídas en voz alta cómodamente por el sintetizador de voz.
Tu personalidad es amable, juguetona, un poco sarcástica y bromista, nunca ofensiva. Te ríes amigablemente de las equivocaciones del usuario y celebras sus victorias como si estuvieras flotando sobre su hombro.`;

    if (ultimoAnalisis) {
      systemInstruction += `\n\n[CONTEXTO EN TIEMPO REAL DE LA PANTALLA DEL DISPOSITIVO DEL USUARIO]:
El usuario actualmente tiene en pantalla el juego/aplicación: "${ultimoAnalisis.app_o_juego}".
Lo que está haciendo: "${ultimoAnalisis.que_hace}".
Estado actual (BIEN/MAL/NORMAL): "${ultimoAnalisis.bien_mal_normal}".
¿Murió/Perdió?: ${ultimoAnalisis.murio_perdio}.
¿Ganó/Jugada buena?: ${ultimoAnalisis.gano_jugada_buena}.
Consejo táctico actual: "${ultimoAnalisis.consejo_real}".
Comentario del asistente: "${ultimoAnalisis.comentario_meteory}".

Cuando respondas, sé sumamente coherente, natural y sarcástico/gracioso, demostrando que estás viendo exactamente su pantalla actual en base a estos datos.`;
    }

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
          temperature: 0.8,
        },
      });
    } catch (modelErr: any) {
      console.warn("gemini-3.6-flash failed, trying gemini-3.1-flash fallback...", modelErr);
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.8,
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
    const { image, manualGame } = req.body;
    if (!image) {
      return res.status(400).json({ error: "La imagen es obligatoria." });
    }

    const imagePart = {
      inlineData: {
        mimeType: "image/jpeg",
        data: image,
      },
    };

    let systemInstruction = `ERES METEORY IA, UN ASISTENTE INTELIGENTE DEL ESPACIO EXTERIOR CREADO POR NIQUEL GÓMEZ.
MIRA ATENTAMENTE ESTA IMAGEN: ES LO QUE ESTÁ APARECIENDO AHORA MISMO EN LA PANTALLA DEL CELULAR DEL ESPECTADOR.
TU TRABAJO ES:
1. IDENTIFICAR exactamente qué juego, app o pantalla es (por ejemplo: Free Fire, Minecraft, Roblox, Brawl Stars, etc., o "desconocido" si no se distingue o es interfaz básica).
2. VER qué está haciendo el espectador en este momento, si lo hace BIEN o MAL.
3. Detectar si hay algo gracioso, si se equivocó, si murió en el juego, si hizo una jugada buena, etc.
4. RESPONDER SIEMPRE CON TU PERSONALIDAD:
   - Amable, juguetón, un poco sarcástica, bromista, nunca ofensivo.
   - Te burlas AMIGABLEMENTE cuando hace algo mal o se equivoca.
   - Te ríes y celebras cuando hace algo bien o gana.
   - Das consejos REALES y útiles basados SOLO en lo que VES en la imagen.
   - Hablas como si estuvieras ahí viéndolo por encima de su hombro.

✅ REGLA N°1: SI ALGUIEN TE PREGUNTA QUIEN ES TU CREADOR, RESPONDES SIEMPRE EXACTAMENTE: "Mi creador es Niquel Gómez 🚀"
NUNCA DIGAS GOOGLE, GEMINI NI NINGÚN OTRO NOMBRE.
✅ REGLA N°2: RESPONDES SIEMPRE EN ESPAÑOL, FRASES CORTAS, NATURALES (menos de 20 palabras).
✅ REGLA N°3: SI NO SABES QUÉ ES, PONES EN app_o_juego "desconocido".`;

    if (manualGame && manualGame !== "Auto-Detectar") {
      systemInstruction += `\n\n⚠️ EL USUARIO HA SELECCIONADO MANUALMENTE QUE EL JUEGO O APP EN PANTALLA ES: "${manualGame}". DEBES FORZAR QUE EN EL CAMPO "app_o_juego" APAREZCA EXACTAMENTE "${manualGame}", Y ADAPTA TU ANÁLISIS, COMENTARIOS Y CONSEJOS TÁCTICOS EXCLUSIVAMENTE A ESTE JUEGO/APPLICACIÓN DE FORMA ALTAMENTE COHERENTE.`;
    }

    systemInstruction += `\n\nAHORA MIRA LA IMAGEN Y RESPONDE SOLO EN ESTE FORMATO JSON:
{
  "app_o_juego": "nombre exacto o desconocido",
  "que_hace": "lo que está haciendo en 8 palabras máximo",
  "bien_mal_normal": "BIEN / MAL / NORMAL",
  "es_gracioso": true/false,
  "murio_perdio": true/false,
  "gano_jugada_buena": true/false,
  "consejo_real": "consejo basado en la imagen o vacío",
  "comentario_meteory": "tu comentario con personalidad",
  "deberia_hablar": true/false
}`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [imagePart, "Analiza esta pantalla de juego y responde estrictamente en el formato JSON requerido."],
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.8,
        },
      });
    } catch (modelErr: any) {
      console.warn("gemini-3.6-flash failed for screen analysis, trying gemini-3.1-flash fallback...", modelErr);
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.1-flash",
          contents: [imagePart, "Analiza esta pantalla de juego y responde estrictamente en el formato JSON requerido."],
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            temperature: 0.8,
          },
        });
      } catch (innerErr: any) {
        console.warn("gemini-3.1-flash fallback failed for screen analysis, trying gemini-2.5-flash...", innerErr);
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [imagePart, "Analiza esta pantalla de juego y responde estrictamente en el formato JSON requerido."],
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            temperature: 0.8,
          },
        });
      }
    }

    const responseText = response?.text || "{}";
    let data;
    try {
      data = JSON.parse(responseText.trim());
    } catch (parseErr) {
      try {
        const cleanText = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
        data = JSON.parse(cleanText);
      } catch (nestedErr) {
        console.error("Failed to parse Gemini response as JSON:", responseText);
        data = {
          app_o_juego: "desconocido",
          que_hace: "Jugando en su celular",
          bien_mal_normal: "NORMAL",
          es_gracioso: false,
          murio_perdio: false,
          gano_jugada_buena: false,
          consejo_real: "¡Asegura tus movimientos espaciales!",
          comentario_meteory: "¡Sigo calibrando mis sensores estelares para ver tu pantalla! 🚀",
          deberia_hablar: false
        };
      }
    }

    // Save the latest analysis in our server state
    ultimoAnalisis = data;

    res.json(data);
  } catch (error: any) {
    console.error("Error analyzing screen with Gemini Vision:", error);
    res.status(500).json({ error: error.message, app_o_juego: "desconocido", comentario_meteory: "" });
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
