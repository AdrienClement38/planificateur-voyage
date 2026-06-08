import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Libellé du périmètre, pour le message (ex. « cette page »). */
  scope?: string;
}
interface State {
  error: Error | null;
}

/**
 * Filet anti-crash. Une erreur de rendu DANS l'arbre enfant est CAPTURÉE ici au
 * lieu de faire écran blanc : on affiche un repli lisible (avec « Réessayer » qui
 * remonte la boundary, et « Recharger » en dernier recours). C'est le SEUL moyen,
 * en React, d'éviter qu'un bug ponctuel n'emporte toute l'app — d'où une boundary
 * GLOBALE (et une plus fine autour du contenu, pour garder l'en-tête utilisable).
 *
 * Doit rester une CLASSE : `getDerivedStateFromError` / `componentDidCatch` n'ont
 * pas d'équivalent hook.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Trace pour le debug (console + futur point de collecte type Sentry).
    console.error(
      "[ErrorBoundary] rendu interrompu :",
      error,
      info.componentStack,
    );
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-8 max-w-md w-full text-center space-y-5">
          <span className="text-4xl">🧭💥</span>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-slate-900">
              Oups, un grain de sable
            </h2>
            <p className="text-xs text-slate-500">
              {this.props.scope
                ? `Un souci est survenu dans ${this.props.scope}. Le reste de l'app n'est pas affecté.`
                : "Un souci d'affichage est survenu. Tes données sont en sécurité."}
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => this.setState({ error: null })}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition cursor-pointer"
            >
              Réessayer
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-5 rounded-xl transition cursor-pointer"
            >
              Recharger l'app
            </button>
          </div>
          {import.meta.env.DEV && (
            <pre className="text-[10px] text-rose-400 bg-rose-50 rounded-xl p-2.5 overflow-auto max-h-32 text-left">
              {error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
