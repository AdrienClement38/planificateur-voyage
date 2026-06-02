import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

/** Indicateur de connectivité réseau réel (lecture seule, via navigator.onLine). */
export default function OfflineIndicator() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return (
    <div
      className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold border ${
        online
          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
          : "bg-amber-50 border-amber-200 text-amber-700"
      }`}
      title={online ? "Connecté au serveur" : "Hors-ligne — données en cache"}
    >
      <div
        className={`w-2 h-2 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}
      ></div>
      {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{online ? "En ligne" : "Hors ligne"}</span>
    </div>
  );
}
