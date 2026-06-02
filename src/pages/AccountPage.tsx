import { useState, type FormEvent } from "react";
import { useTripStore } from "../store/TripContext";

/** Page de gestion du profil de l'utilisateur connecté. */
export default function AccountPage() {
  const {
    setActivePage,
    currentUser,
    currentMember,
    activeTrip,
    handleUpdateProfile,
    handleExportData,
    handleDeleteAccount,
  } = useTripStore();
  const [displayName, setDisplayName] = useState(currentMember?.name ?? "");
  const [avatar, setAvatar] = useState(currentMember?.avatar ?? "");
  const [saved, setSaved] = useState(false);

  if (!currentUser || !currentMember) return null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    await handleUpdateProfile(displayName.trim(), avatar.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs max-w-3xl mx-auto space-y-6 animate-fadeIn">
      <div className="space-y-2 border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-1 rounded-md uppercase tracking-widest">
            👤 Mon Compte
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display mt-2">
            Profil de {currentMember.name}
          </h2>
          <p className="text-xs text-slate-500">{currentUser.email}</p>
        </div>
        <button
          onClick={() => setActivePage("dashboard")}
          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs py-2 px-3.5 rounded-xl transition duration-200 cursor-pointer"
        >
          ← Retour au Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Édition du profil */}
        <form onSubmit={onSubmit} className="bg-slate-50 rounded-2.5xl p-5 border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Modifier mon profil</h3>

          <div className="flex items-center gap-4">
            <img
              src={avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=" + encodeURIComponent(displayName || "user")}
              alt={displayName}
              className="w-16 h-16 rounded-full border-2 border-indigo-600 shadow-md object-cover bg-white"
            />
            <div>
              <h4 className="font-bold text-slate-900 text-sm">{displayName || "—"}</h4>
              <p className="text-[10px] text-slate-400">ID : {currentUser.id.slice(0, 8)}…</p>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Nom affiché</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Avatar (URL d'image)</label>
            <input
              type="text"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="Laisser vide pour un avatar généré"
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-hidden"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition cursor-pointer"
          >
            {saved ? "✓ Enregistré" : "Enregistrer mon profil"}
          </button>
        </form>

        {/* Membres du voyage courant */}
        <div className="bg-slate-50 rounded-2.5xl p-5 border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            {activeTrip ? `Membres de « ${activeTrip.name} »` : "Membres"}
          </h3>
          <div className="space-y-2">
            {(activeTrip?.members ?? []).map((m) => (
              <div key={m.id} className="flex items-center gap-2 bg-white border border-slate-150 p-2.5 rounded-xl">
                <img
                  src={m.avatar || "https://api.dicebear.com/7.x/adventurer/svg?seed=" + encodeURIComponent(m.name)}
                  alt={m.name}
                  className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    {m.name} {m.id === currentMember.id && <span className="text-[9px] text-indigo-600">(Moi)</span>}
                  </p>
                  <p className="text-[10px] text-slate-400">Participant</p>
                </div>
              </div>
            ))}
            {!activeTrip && (
              <p className="text-xs text-slate-400 italic">Sélectionnez un voyage pour voir ses membres.</p>
            )}
          </div>
          <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-xs text-indigo-700">
            <p className="font-bold">💡 Inviter</p>
            <p className="mt-0.5">Partagez le code de votre voyage depuis le tableau de bord pour que vos amis le rejoignent avec leur propre compte.</p>
          </div>
        </div>
      </div>

      {/* Données & confidentialité (RGPD) */}
      <div className="border-t border-slate-100 pt-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Données & confidentialité</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleExportData}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer"
          >
            ⬇️ Exporter mes données (JSON)
          </button>
          <button
            onClick={() => {
              if (
                confirm(
                  "Supprimer définitivement votre compte et vos voyages ? Cette action est irréversible.",
                )
              ) {
                void handleDeleteAccount();
              }
            }}
            className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer border border-rose-150"
          >
            🗑️ Supprimer mon compte
          </button>
        </div>
        <p className="text-[10px] text-slate-400">
          Conformément au RGPD : droit d'accès/portabilité (export) et droit à l'effacement (suppression).
          {" "}
          <a href="/confidentialite.html" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            Politique de confidentialité
          </a>
          {" · "}
          <a href="/cgu.html" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            CGU
          </a>
          {" · "}
          <a href="/mentions-legales.html" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            Mentions légales
          </a>
        </p>
      </div>
    </div>
  );
}
