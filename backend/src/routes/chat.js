// backend/src/routes/chat.js
import express from 'express';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = express.Router();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Load a concise summary of snowflake/train.csv to include in prompts when available.
let datasetSummary = null;
try {
    const csvPath = path.resolve(__dirname, '..', '..', '..', 'snowflake', 'train.csv');
    if (fs.existsSync(csvPath)) {
        const content = fs.readFileSync(csvPath, 'utf8');
        const lines = content.split(/\r?\n/).filter(Boolean);
        if (lines.length > 1) {
            const header = lines[0].split(',').map(h => h.trim());
            const rows = lines.slice(1, Math.min(lines.length, 101)).map(l => l.split(',').map(c => c.trim()));

            // Attempt to find the ESTIMATED_VALUE / LISTED_PRICE / SOLD_PRICE column indices
            const estIdx = header.findIndex(h => /ESTIMATED_VALUE/i.test(h));
            const listedIdx = header.findIndex(h => /LISTED_PRICE/i.test(h));
            const soldIdx = header.findIndex(h => /SOLD_PRICE/i.test(h));
            const addrIdx = header.findIndex(h => /STREET_ADDRESS|ADDRESS/i.test(h));
            const cityIdx = header.findIndex(h => /CITY/i.test(h));

            const vals = rows.map(r => {
                const v = estIdx > -1 ? Number(r[estIdx]) : NaN;
                return isFinite(v) ? v : null;
            }).filter(v => v !== null);

            const count = vals.length;
            const avg = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
            const max = vals.length ? Math.max(...vals) : 0;
            const min = vals.length ? Math.min(...vals) : 0;

            // top 5 by estimated value from the sampled rows
            const enriched = rows.map(r => ({
                est: estIdx > -1 ? Number(r[estIdx]) : null,
                addr: addrIdx > -1 ? r[addrIdx] : (r[0]||''),
                city: cityIdx > -1 ? r[cityIdx] : ''
            })).filter(x => x.est && isFinite(x.est));
            enriched.sort((a,b)=>b.est - a.est);
            const top5 = enriched.slice(0,5).map(e => `${e.addr || 'N/A'}${e.city?(' - '+e.city):''} ($${Math.round(e.est).toLocaleString()})`);

            datasetSummary = `Dataset summary: ${count} sampled rows. Estimated value range: $${Math.round(min).toLocaleString()} - $${Math.round(max).toLocaleString()}, avg $${Math.round(avg).toLocaleString()}. Top properties: ${top5.join('; ')}.`;
        }
    }
} catch (err) {
    console.warn('Failed to load train.csv summary:', err && err.message);
    datasetSummary = null;
}

router.post('/', async (req, res) => {
    try {
        const { message, context } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ reply: 'Invalid request: message is required.' });
        }

        // Select the model (keep configurable via env)
        const modelName = process.env.GEMINI_MODEL || 'models/gemini-1.5-pro';
        const model = genAI.getGenerativeModel({ model: modelName });

        // Build an improved, safety-conscious system prompt
        // Accept optional `context` (e.g. property summaries) and include it when present
        let systemPrompt = `You are StockHouse Advisor, an expert, factual, and safety-conscious real estate investment assistant for the StockHouse web app. Answer clearly and concisely. When appropriate, ask one clarifying question before giving a recommendation. Prioritize actionable steps, cite assumptions, and avoid making claims about real-time market prices. If the user requests unrelated content, briefly explain the scope and redirect to real estate topics.`;

        let contextBlock = '';
        // Prefer explicit context passed from frontend (safe), otherwise include a short dataset summary when available.
        if (context && typeof context === 'object') {
            try {
                const ctxJson = JSON.stringify(context);
                contextBlock = `\n\nContext: ${ctxJson}\n\n`;
            } catch (e) {
                contextBlock = '';
            }
        } else if (datasetSummary) {
            contextBlock = `\n\nDataset: ${datasetSummary}\n\n`;
        }

        const userBlock = `User: ${message}`;

        const prompt = `${systemPrompt}${contextBlock}\nInstructions: Keep answers concise (preferably 1/3 sentences). If recommending action (e.g., invest, review docs), include one clear next step. Don't give any raw legal, tax, or medical advice; recommend consulting a professional.\n\n${userBlock}`;

        // Generate content
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({ reply: text });
    } catch (error) {
        console.error('Chat Error:', error?.message || error);
        res.status(500).json({ reply: "The StockHouse Advisor is temporarily unavailable — please try again shortly." });
    }
});

export default router;