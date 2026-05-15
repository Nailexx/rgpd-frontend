import { useState } from "react";

type AnalysisStatus = "idle" | "loading" | "done" | "error";

export default function App() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [pageText, setPageText] = useState("");

  const fetchPage = async () => {
    if (!url) return;
    setStatus("loading");
    setPageText("");

    try {
      const response = await fetch("http://localhost:3001/fetch-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) throw new Error("Erreur serveur");
      const data = await response.json() as { text: string };
      setPageText(data.text);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-xl font-semibold text-white">Analyseur RGPD</h1>
        <p className="text-sm text-gray-400 mt-1">Vérifiez la conformité RGPD d'un site web automatiquement</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            URL de la politique de confidentialité
          </label>
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
            <p className="text-sm text-gray-400 mb-4">
              Copie ce texte dans Claude Desktop avec la consigne : <span className="text-blue-400">"Analyse ce texte pour sa conformité RGPD"</span>
            </p>
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
            <p className="text-red-400 text-sm">Impossible de récupérer la page. Vérifie l'URL.</p>
          </div>
        )}
      </div>
    </div>
  );
}