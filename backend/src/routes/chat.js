import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ GEMINI_API_KEY not found in environment");
      return res.status(503).json({
        reply: "Chat service not configured. Please add GEMINI_API_KEY to your .env file."
      });
    }

    const { message, context } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ reply: "Please provide a valid message." });
    }

    // ✅ Initialize Gemini (AFTER apiKey check, BEFORE use)
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const model = genAI.getGenerativeModel({ model: modelName });

    const systemPrompt = `You are StockHouse Advisor, a helpful real estate investment assistant.
You provide clear, concise advice about real estate investments.
Keep responses brief (2-3 sentences) and actionable.
If you don't know something, say so - don't make up information.`;

    let contextInfo = "";
    if (context && typeof context === "object") {
      try {
        contextInfo = "\n\nAvailable property data: " + JSON.stringify(context);
      } catch (e) {
        console.warn("Failed to stringify context:", e.message);
      }
    }

    const fullPrompt = `${systemPrompt}${contextInfo}\n\nUser question: ${message}\n\nYour response:`;

    const result = await model.generateContent(fullPrompt);
    const text = result?.response?.text?.() ?? "Sorry, I couldn't generate a response.";

    return res.json({ reply: text });
  } catch (error) {
    console.error("❌ Chat Error:", error?.message || error);

    let errorMessage = "Sorry, I encountered an error. Please try again.";
    if (String(error?.message || "").toLowerCase().includes("api key")) {
      errorMessage = "API key configuration error. Please check your Gemini API key.";
    } else if (String(error?.message || "").toLowerCase().includes("quota")) {
      errorMessage = "API quota exceeded. Please try again later.";
    }

    return res.status(500).json({
      reply: errorMessage,
      debug: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
});

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    apiKeyConfigured: !!process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash"
  });
});

export default router;