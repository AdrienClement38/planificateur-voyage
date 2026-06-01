import { ChevronRight } from "lucide-react";
import { useTripStore } from "../store/TripContext";

/** Écran de sélection d'identité (connexion simulée par membre). */
export default function LoginScreen() {
  const { members, handleLoginAs } = useTripStore();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 font-sans antialiased bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-900 to-black">
      <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-2xl space-y-6 relative overflow-hidden transition-all duration-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-2xl pointer-events-none -translate-y-6 translate-x-6"></div>

        <div className="text-center space-y-2">
          <span className="text-4xl">🛶</span>
          <h1 className="text-2xl font-black font-display text-slate-950 tracking-wide uppercase">
            CO-TRIPPER
          </h1>
          <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider">
            Le Workspace des Voyageurs Connectés
          </p>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Sélectionnez votre identité pour rejoindre instantanément votre projet et voter en groupe.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center">
            Rejoindre l'espace de planification :
          </span>

          <div className="grid grid-cols-1 gap-2.5">
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => handleLoginAs(member.id)}
                className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 hover:border-indigo-600 hover:bg-slate-50 text-slate-800 text-sm font-bold shadow-2xs hover:shadow-xs transition duration-200 cursor-pointer text-left focus:ring-2 focus:ring-indigo-500/20"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                  />
                  <div>
                    <p className="font-bold text-slate-950">{member.name}</p>
                    <p className="text-[10px] text-slate-400 font-normal">Membre Co-Tripper officiel</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-450" />
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 text-center">
          <p className="text-[10px] text-slate-400">
            Co-Tripper stocke localement toutes vos modifications en mode résilient.
          </p>
        </div>
      </div>
    </div>
  );
}
