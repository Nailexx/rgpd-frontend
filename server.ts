import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

// Connexion PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("render.com") ? { rejectUnauthorized: false } : false,
});

// Supprimer son compte
app.delete("/account", authMiddleware, async (req: any, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [req.user.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// Initialisation des tables
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS analyses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      page_text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("Base de données initialisée");
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-prod";

function authMiddleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Token manquant" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token invalide" });
  }
}

// Inscription
app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });
  if (password.length < 6) return res.status(400).json({ error: "Mot de passe trop court (min 6 caractères)" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id",
      [email, hashedPassword]
    );
    const token = jwt.sign({ id: result.rows[0].id, email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, email });
  } catch (err: any) {
    if (err.code === "23505") return res.status(400).json({ error: "Email déjà utilisé" });
    res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
});

// Connexion
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });

  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "Email ou mot de passe incorrect" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: "Email ou mot de passe incorrect" });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, email: user.email });
});

// Analyser une page
app.post("/fetch-page", authMiddleware, async (req: any, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL manquante" });

  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim().substring(0, 5000);

    await pool.query(
      "INSERT INTO analyses (user_id, url, page_text) VALUES ($1, $2, $3)",
      [req.user.id, url, text]
    );

    res.json({ text });
  } catch {
    res.status(500).json({ error: "Impossible de récupérer la page" });
  }
});

// Lister les analyses
app.get("/analyses", authMiddleware, async (req: any, res) => {
  const result = await pool.query(
    "SELECT id, url, created_at FROM analyses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
    [req.user.id]
  );
  res.json({ analyses: result.rows });
});

// Récupérer une analyse
app.get("/analyses/:id", authMiddleware, async (req: any, res) => {
  const result = await pool.query(
    "SELECT * FROM analyses WHERE id = $1 AND user_id = $2",
    [req.params.id, req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Analyse introuvable" });
  res.json(result.rows[0]);
});

// Supprimer une analyse
app.delete("/analyses/:id", authMiddleware, async (req: any, res) => {
  const result = await pool.query(
    "DELETE FROM analyses WHERE id = $1 AND user_id = $2",
    [req.params.id, req.user.id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: "Analyse introuvable" });
  res.json({ success: true });
});

initDb().then(() => {
  app.listen(3001, () => console.log("Serveur backend démarré sur http://localhost:3001"));
});