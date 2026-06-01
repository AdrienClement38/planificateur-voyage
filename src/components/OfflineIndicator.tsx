import React from "react";
import { Wifi, WifiOff } from "lucide-react";

interface OfflineIndicatorProps {
  isOffline: boolean;
  setIsOffline: (val: boolean) => void;
}

export default function OfflineIndicator({ isOffline, setIsOffline }: OfflineIndicatorProps) {
  return (
    <div id="offline-sim-bar" className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 shadow-xs transition-all duration-300">
      <div className="flex flex-col">
        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Simulateur Réseau
        </span>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isOffline ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`}></div>
          <span className="text-xs font-semibold text-slate-700">
            {isOffline ? "Mode Hors Ligne" : "Mode En Ligne"}
          </span>
        </div>
      </div>

      <button
        id="toggle-offline-btn"
        onClick={() => setIsOffline(!isOffline)}
        className={`ml-2 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all shadow-xs uppercase tracking-wide cursor-pointer select-none ${
          isOffline
            ? "bg-amber-600 hover:bg-amber-700 text-white"
            : "bg-slate-200 hover:bg-slate-300 text-slate-700"
        }`}
      >
        {isOffline ? (
          <>
            <Wifi className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Passer En Ligne</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Déconnecter</span>
          </>
        )}
      </button>
    </div>
  );
}
