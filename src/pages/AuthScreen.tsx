import { useState, type FormEvent } from "react";
import { useTripStore } from "../store/TripContext";

/** Écran d'inscription / connexion (vrais comptes). */
export default function AuthScreen() {
  const { handleLogin, handleSignup, authError } = useTripStore();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    if (mode === "login") await handleLogin(email.trim(), password);
    else await handleSignup(email.trim(), password, displayName.trim());
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans antialiased bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-900 to-black">
      <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-2xl pointer-events-none -translate-y-6 translate-x-6"></div>

        <div className="text-center space-y-2">
          <span className="text-4xl">🛶</span>
          <h1 className="text-4xl font-brand text-slate-950 leading-tight py-1">
            Co-Traveler
          </h1>
          <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider">
            Le Workspace des Voyageurs Connectés
          </p>
        </div>

        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                mode === m ? "bg-indigo-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {m === "login" ? "Connexion" : "Inscription"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === "signup" && (
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">
                Nom affiché
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex : Adrien"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-hidden"
              />
            </div>
          )}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caractères minimum"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500/20 outline-hidden"
            />
          </div>

          {mode === "signup" && (
            <label className="flex items-start gap-2 text-[11px] text-slate-500 leading-snug">
              <input type="checkbox" required className="mt-0.5 accent-indigo-600" />
              <span>
                J'accepte les{" "}
                <a href="/cgu.html" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  CGU
                </a>{" "}
                et la{" "}
                <a href="/confidentialite.html" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  politique de confidentialité
                </a>
                .
              </span>
            </label>
          )}

          {authError && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-2.5 font-semibold">
              {authError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-2xl transition shadow-sm cursor-pointer"
          >
            {submitting
              ? "Veuillez patienter…"
              : mode === "login"
                ? "Se connecter"
                : "Créer mon compte 🛶"}
          </button>
        </form>

        <p className="text-[10px] text-slate-400 text-center">
          Vos données sont stockées de manière sécurisée. Hébergement en France/UE.
        </p>
        <p className="text-[10px] text-center">
          <a href="/decouvrir.html" className="text-indigo-500 hover:underline font-semibold">
            Découvrir Co-Traveler →
          </a>
        </p>
      </div>
    </div>
  );
}
