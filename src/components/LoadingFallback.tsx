/** Indicateur de chargement affiché pendant le lazy-loading d'un onglet/page. */
export default function LoadingFallback({ label = "Chargement…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-3 py-16 text-slate-400"
    >
      <span className="w-5 h-5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin"></span>
      <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
    </div>
  );
}
