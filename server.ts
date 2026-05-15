import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/fetch-page", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL manquante" });

  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim().substring(0, 5000);
    res.json({ text });
  } catch {
    res.status(500).json({ error: "Impossible de récupérer la page" });
  }
});

app.listen(3001, () => console.log("Serveur backend démarré sur http://localhost:3001"));