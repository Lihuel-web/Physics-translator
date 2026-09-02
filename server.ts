import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true, limit: "30mb" }));

// Lazy GoogleGenAI initialization
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Resilient Gemini caller with automatic fallback across recommended flash models
async function generateContentResilient(params: {
  contents: any;
  config?: any;
}) {
  const ai = getGenAI();
  const modelsToTry = ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-flash-latest"];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
      return response;
    } catch (err: any) {
      console.warn(`Model ${model} encounter issue, trying fallback model...`, err?.message || err);
      lastError = err;
    }
  }
  throw lastError;
}

// In-memory room store for live classroom broadcasts
interface CaptionSegment {
  id: string;
  timestamp: number;
  originalText: string;
  detectedLanguage?: string;
  translations: Record<string, string>; // languageName -> translated text
  physicsTerms?: Array<{
    term: string;
    translatedTerm?: string;
    definition: string;
  }>;
}

interface RoomData {
  id: string;
  title: string;
  activeTopic: string;
  createdAt: number;
  subscribers: Set<Response>;
  history: CaptionSegment[];
}

const rooms = new Map<string, RoomData>();

function getOrCreateRoom(roomId: string): RoomData {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      title: "8th-Grade Physics Class",
      activeTopic: "Forces, Motion & Energy",
      createdAt: Date.now(),
      subscribers: new Set(),
      history: [],
    };
    rooms.set(roomId, room);
  }
  return room;
}

// Clean up old rooms if inactive for more than 24h
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms.entries()) {
    if (room.subscribers.size === 0 && now - room.createdAt > 24 * 60 * 60 * 1000) {
      rooms.delete(id);
    }
  }
}, 60 * 60 * 1000);

// API Routes
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: Date.now(),
  });
});

// Transcribe & translate audio chunk
app.post("/api/transcribe-translate", async (req: Request, res: Response) => {
  try {
    const {
      audio,
      mimeType = "audio/webm",
      inputLanguage = "auto",
      targetLanguage = "Spanish",
      currentTopic = "Forces, Motion, Energy and Gravity",
      roomId,
    } = req.body;

    if (!audio) {
      return res.status(400).json({ error: "Missing audio payload" });
    }

    const ai = getGenAI();

    // Remove any base64 header if present
    const base64Data = audio.replace(/^data:[^;]+;base64,/, "");

    const inputLangGuidance =
      inputLanguage && inputLanguage !== "auto"
        ? `The speaker is speaking in ${inputLanguage}. Transcribe the spoken speech word-for-word in ${inputLanguage}.`
        : `Auto-detect the spoken language (can be English, Spanish, Hebrew, etc.). Transcribe the spoken speech word-for-word in its original spoken language.`;

    const prompt = `You are a real-time speech-to-text transcriber and translator for an 8th-grade Physics class.
The teacher is speaking to middle school students. Current physics topic: "${currentTopic}".

Listen to this short audio clip.
1. ${inputLangGuidance} Ensure technical physics terminology, units (m/s, m/s², Newtons, Joules, Watts, etc.), and formulas are correctly recognized and spelled. If the audio is silent or unintelligible background noise, return empty text.
2. Translate the speech into ${targetLanguage}. The translation should be clear, natural, and accurately use standard 8th-grade physics terms in ${targetLanguage}.
3. Detect the spoken language and return its English name in "detectedLanguage" (e.g. English, Hebrew, Spanish, French).
4. If any 8th-grade physics concepts or vocabulary words were mentioned (such as inertia, velocity, gravity, friction, normal force, momentum, acceleration, work, potential energy, kinetic energy, Newton's laws), extract up to 3 terms with their translation in ${targetLanguage} and a concise 1-sentence 8th-grade level definition.`;

    const response = await generateContentResilient({
      contents: [
        {
          inlineData: {
            mimeType: mimeType.split(";")[0],
            data: base64Data,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            originalText: {
              type: Type.STRING,
              description: "The verbatim transcription of what was said in the audio.",
            },
            translatedText: {
              type: Type.STRING,
              description: `The translated text in ${targetLanguage}.`,
            },
            detectedLanguage: {
              type: Type.STRING,
              description: "The language detected in the spoken audio.",
            },
            physicsTerms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  translatedTerm: { type: Type.STRING },
                  definition: { type: Type.STRING },
                },
                required: ["term", "translatedTerm", "definition"],
              },
            },
          },
          required: ["originalText", "translatedText"],
        },
      },
    });

    const rawJson = response.text || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      parsed = { originalText: "", translatedText: "" };
    }

    const originalText = (parsed.originalText || "").trim();
    const translatedText = (parsed.translatedText || "").trim();

    const segment: CaptionSegment = {
      id: "seg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      timestamp: Date.now(),
      originalText,
      detectedLanguage: parsed.detectedLanguage || "English",
      translations: {
        [targetLanguage]: translatedText,
      },
      physicsTerms: parsed.physicsTerms || [],
    };

    // If a room is specified and there is meaningful spoken text, broadcast to all connected students
    if (roomId && (originalText.length > 0 || translatedText.length > 0)) {
      const room = getOrCreateRoom(roomId);
      room.history.push(segment);
      if (room.history.length > 200) {
        room.history.shift();
      }

      // Broadcast to SSE clients
      const dataStr = `data: ${JSON.stringify({ type: "caption", segment })}\n\n`;
      room.subscribers.forEach((clientRes) => {
        try {
          clientRes.write(dataStr);
        } catch {
          // ignore closed socket
        }
      });
    }

    res.json({
      segment,
    });
  } catch (error: any) {
    console.error("Transcription error:", error);
    res.status(500).json({
      error: error?.message || "Failed to transcribe and translate audio",
    });
  }
});

// On-demand text translation & physics term explainer
app.post("/api/translate-text", async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage = "Spanish", currentTopic = "8th Grade Physics" } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing text to translate" });
    }

    const ai = getGenAI();
    const prompt = `Translate the following 8th-grade physics classroom text into ${targetLanguage}.
Classroom topic: "${currentTopic}".
Original text: "${text}"

Provide:
1. Accurate, natural translation suited for 8th-grade students.
2. Any physics keywords mentioned, their translation, and a simple 1-sentence definition.`;

    const response = await generateContentResilient({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translatedText: { type: Type.STRING },
            physicsTerms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  translatedTerm: { type: Type.STRING },
                  definition: { type: Type.STRING },
                },
                required: ["term", "translatedTerm", "definition"],
              },
            },
          },
          required: ["translatedText"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("Text translation error:", error);
    res.status(500).json({ error: error?.message || "Failed to translate text" });
  }
});

// Physics Lesson Summary from session transcript
app.post("/api/summarize-transcript", async (req: Request, res: Response) => {
  try {
    const { transcript, targetLanguage = "English" } = req.body;
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return res.status(400).json({ error: "No transcript provided" });
    }

    const ai = getGenAI();
    const fullText = transcript
      .map((t: any) => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.originalText}`)
      .join("\n");

    const prompt = `You are an encouraging 8th-grade physics tutor. Review the following class session transcript and create a student-friendly study guide in ${targetLanguage}:
1. Lesson Title & Main Physics Question
2. Core Concepts & Definitions (explained simply for 13-14 year olds)
3. Key Formulas or Units mentioned
4. 3 Quick Review Quiz Questions with answers
5. 1 real-world example of the physics principle

Transcript:
${fullText.slice(0, 8000)}`;

    const response = await generateContentResilient({
      contents: prompt,
    });

    res.json({ summary: response.text });
  } catch (error: any) {
    console.error("Summary error:", error);
    res.status(500).json({ error: error?.message || "Failed to generate summary" });
  }
});

// Broadcast caption directly (e.g. from Web Speech API or manual teacher note)
app.post("/api/session/:room/caption", (req: Request, res: Response) => {
  const roomId = req.params.room;
  const { segment } = req.body;
  if (!segment) {
    return res.status(400).json({ error: "Missing segment" });
  }

  const room = getOrCreateRoom(roomId);
  room.history.push(segment);
  if (room.history.length > 200) {
    room.history.shift();
  }

  const dataStr = `data: ${JSON.stringify({ type: "caption", segment })}\n\n`;
  room.subscribers.forEach((clientRes) => {
    try {
      clientRes.write(dataStr);
    } catch {
      // client disconnected
    }
  });

  res.json({ success: true, count: room.subscribers.size });
});

// Get room details & recent history for late-joining students
app.get("/api/session/:room/history", (req: Request, res: Response) => {
  const roomId = req.params.room;
  const room = getOrCreateRoom(roomId);
  res.json({
    roomId,
    title: room.title,
    activeTopic: room.activeTopic,
    history: room.history.slice(-100),
    activeStudents: room.subscribers.size,
  });
});

// Update room topic or title
app.post("/api/session/:room/meta", (req: Request, res: Response) => {
  const roomId = req.params.room;
  const { title, activeTopic } = req.body;
  const room = getOrCreateRoom(roomId);
  if (title) room.title = title;
  if (activeTopic) room.activeTopic = activeTopic;

  const dataStr = `data: ${JSON.stringify({
    type: "meta",
    title: room.title,
    activeTopic: room.activeTopic,
  })}\n\n`;
  room.subscribers.forEach((clientRes) => {
    try {
      clientRes.write(dataStr);
    } catch {}
  });

  res.json({ success: true, room: { title: room.title, activeTopic: room.activeTopic } });
});

// Server-Sent Events (SSE) stream for students
app.get("/api/session/:room/events", (req: Request, res: Response) => {
  const roomId = req.params.room;
  const room = getOrCreateRoom(roomId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  room.subscribers.add(res);

  // Send initial handshake
  res.write(
    `data: ${JSON.stringify({
      type: "connected",
      roomId,
      title: room.title,
      activeTopic: room.activeTopic,
      studentCount: room.subscribers.size,
    })}\n\n`
  );

  // Keep-alive heartbeat every 20s
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    room.subscribers.delete(res);
  });
});

// Vite middleware & Static Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Physics Class Live Captions server running on http://localhost:${PORT}`);
  });
}

startServer();
