import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/insights", async (req, res) => {
    try {
      const { weather, location } = req.body;
      const prompt = `Based on this weather data for ${location}: Current Temp: ${weather.current.temp}°C, Condition: ${weather.current.weatherCode}. Provide a very short, helpful 1-sentence weather advice in Bengali (বাংলা). Focus on health or activity advice. Keep it under 15 words.`;
      
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      res.json({ insight: text });
    } catch (error: any) {
      console.error('Gemini API Error:', error.message);
      
      if (error.message?.includes('429') || error.status === 429) {
        return res.status(429).json({ 
          error: "Quota exceeded", 
          fallback: "আবহাওয়ার সর্তकता: সচেতন থাকুন এবং আপডেট বজায় রাখুন।" 
        });
      }
      
      res.status(500).json({ error: "Failed to get insights" });
    }
  });

  // Vite middleware for development
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
