import { useState, useEffect } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

type Page = "login" | "register" | "app";
type AnalysisStatus = "idle" | "loading" | "done" | "error";

type AnalysisItem = {
  id: number;
  url: string;
  created_at: string;
};

export default function App() {
  const [page, setPage] = useState<Page>("login");
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [pageText, setPageText] = useState("");

  const [history, setHistory] = useState<AnalysisItem[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<number | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedEmail = localStorage.getItem("email");
    if (savedToken && savedEmail) {
      setToken(savedToken);
      setEmail(savedEmail);
      setPage("app");
    }
  }, []);

  useEffect(() => {
    if (token && page === "app") loadHistory();
  }, [token, page]);

  const loadHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/analyses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = (await response.json()) as { analyses: AnalysisItem[] };
        setHistory(data.analyses);
      }
    } catch {}
  };

  const loadAnalysis = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/analyses/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = (await response.json()) as { url: string; page_text: string };
        setUrl(data.url);
        setPageText(data.page_text);
        setStatus("done");
        setSelectedAnalysis(id);
      }
    } catch {}
  };

  const deleteAnalysis = async (id: number) => {
    try {
      await fetch(`${API_URL}/analyses/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      loadHistory();
      if (selectedAnalysis === id) {
        setUrl("");
        setPageText("");
        setStatus("idle");
        setSelectedAnalysis(null);
      }
    } catch {}
  };

  const handleAuth = async (endpoint: "login" | "register") => {
    setAuthError("");
    try {
      const response = await fetch(`${API_URL}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuthError(data.error || "Erreur");
        return;
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("email", data.email);
      setToken(data.token);
      setPage("app");
    } catch {
      setAuthError("Impossible de contacter le serveur");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    setToken(null);
    setEmail("");
    setPassword("");
    setHistory([]);
    setPage("login");
  };

  const fetchPage = async () => {
    if (!url) return;
    setStatus("loading");
    setPageText("");
    setSelectedAnalysis(null);
    try {
      const response = await fetch(`${API_URL}/fetch-page`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          logout();
          return;
        }
        throw new Error();
      }
      const data = (await response.json()) as { text: string };
      setPageText(data.text);
      setStatus("done");
      loadHistory();
    } catch {
      setStatus("error");
    }
  };

  if (page === "login" || page === "register") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold mb-2">Analyseur RGPD</h1>
          <p className="text-sm text-gray-400 mb-8">
            {page === "login" ? "Connectez-vous à votre compte" : "Créez un compte"}
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                onKeyDown={(e) => e.key === "Enter" && handleAuth(page === "login" ? "login" : "register")}
              />
            </div>
            {authError && <p className="text-red-400 text-sm">{authError}</p>}
            <button
              onClick={() => handleAuth(page === "login" ? "login" : "register")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium text-sm transition-colors"
            >
              {page === "login" ? "Se connecter" : "S'inscrire"}
            </button>
            <button
              onClick={() => {
                setPage(page === "login" ? "register" : "login");
                setAuthError("");
              }}
              className="w-full text-sm text-gray-400 hover:text-white transition-colors"
            >
              {page === "login" ? "Créer un compte" : "Déjà inscrit ? Se connecter"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Analyseur RGPD</h1>
          <p className="text-sm text-gray-400 mt-1">{email}</p>
        </div>
        <button onClick={logout} className="text-sm text-gray-400 hover:text-white transition-colors">
          Se déconnecter
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-3 gap-6">
        {/* Sidebar : historique */}
        <aside className="col-span-1 bg-gray-900 border border-gray-800 rounded-lg p-4 h-fit">
          <h2 className="font-semibold text-sm text-gray-300 mb-3">Historique</h2>
          {history.length === 0 ? (
            <p className="text-xs text-gray-500">Aucune analyse pour le moment</p>
          ) : (
            <ul className="space-y-2">
              {history.map((item) => (
                <li
                  key={item.id}
                  className={`text-xs p-2 rounded cursor-pointer transition-colors ${
                    selectedAnalysis === item.id ? "bg-blue-900" : "hover:bg-gray-800"
                  }`}
                  onClick={() => loadAnalysis(item.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-gray-200">{item.url}</p>
                      <p className="text-gray-500 mt-1">
                        {new Date(item.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAnalysis(item.id);
                      }}
                      className="text-gray-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Main content */}
        <div className="col-span-2">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">URL à analyser</label>
            <div className="flex gap-3">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://exemple.com/politique-confidentialite"
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                onKeyDown={(e) => e.key === "Enter" && fetchPage()}
              />
              <button
                onClick={fetchPage}
                disabled={status === "loading" || !url}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-3 rounded-lg font-medium text-sm transition-colors"
              >
                {status === "loading" ? "Récupération..." : "Analyser"}
              </button>
            </div>
          </div>

          {status === "loading" && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400 text-sm">Récupération du contenu...</p>
            </div>
          )}

          {status === "done" && pageText && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">Contenu récupéré</h2>
                <span className="text-xs bg-green-900 text-green-400 px-2 py-1 rounded">Prêt</span>
              </div>
              <textarea
                readOnly
                value={pageText}
                className="w-full h-64 bg-gray-950 border border-gray-700 rounded p-3 text-sm text-gray-300 resize-none"
              />
              <button
                onClick={() => navigator.clipboard.writeText(pageText)}
                className="mt-3 text-sm bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded transition-colors"
              >
                Copier le texte
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="bg-red-950 border border-red-800 rounded-lg p-6">
              <p className="text-red-400 text-sm">Impossible de récupérer la page.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}