import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const app = express();
app.use(cors());
app.use(express.json());

// Initialisation de la base de données
const db = new Database("users.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    page_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-prod";

// Middleware pour vérifier le token JWT
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

// Route inscription
app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });
  if (password.length < 6) return res.status(400).json({ error: "Mot de passe trop court (min 6 caractères)" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare("INSERT INTO users (email, password) VALUES (?, ?)");
    const result = stmt.run(email, hashedPassword);
    
    const token = jwt.sign({ id: result.lastInsertRowid, email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, email });
  } catch (err: any) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(400).json({ error: "Email déjà utilisé" });
    }
    res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
});

// Route connexion
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
  if (!user) return res.status(401).json({ error: "Email ou mot de passe incorrect" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: "Email ou mot de passe incorrect" });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, email: user.email });
});

// Récupérer une page ET enregistrer l'analyse
app.post("/fetch-page", authMiddleware, async (req: any, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL manquante" });

  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim().substring(0, 5000);

    // Enregistrer dans l'historique
    db.prepare("INSERT INTO analyses (user_id, url, page_text) VALUES (?, ?, ?)").run(
      req.user.id, url, text
    );

    res.json({ text });
  } catch {
    res.status(500).json({ error: "Impossible de récupérer la page" });
  }
});

// Lister les analyses de l'utilisateur
app.get("/analyses", authMiddleware, (req: any, res) => {
  const analyses = db.prepare(
    "SELECT id, url, created_at FROM analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
  ).all(req.user.id);
  res.json({ analyses });
});

// Récupérer une analyse spécifique
app.get("/analyses/:id", authMiddleware, (req: any, res) => {
  const analysis = db.prepare(
    "SELECT * FROM analyses WHERE id = ? AND user_id = ?"
  ).get(req.params.id, req.user.id);
  if (!analysis) return res.status(404).json({ error: "Analyse introuvable" });
  res.json(analysis);
});

// Supprimer une analyse
app.delete("/analyses/:id", authMiddleware, (req: any, res) => {
  const result = db.prepare(
    "DELETE FROM analyses WHERE id = ? AND user_id = ?"
  ).run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: "Analyse introuvable" });
  res.json({ success: true });
});
app.listen(3001, () => console.log("Serveur backend démarré sur http://localhost:3001"));