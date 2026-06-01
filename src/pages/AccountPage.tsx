import type { Member } from "../types";
import { uid } from "../lib/id";
import { useTripStore } from "../store/TripContext";

/** Page autonome de gestion du profil et des membres du groupe. */
export default function AccountPage() {
  const { setActivePage, currentMember, members, setMembers } = useTripStore();

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs max-w-3xl mx-auto space-y-6 animate-fadeIn">
      <div className="space-y-2 border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-1 rounded-md uppercase tracking-widest">
            👤 Gestion du Profil & Groupe
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display mt-2">
            Mon Compte Voyageur & Amis Co-Tripper
          </h2>
          <p className="text-xs text-slate-500 animate-pulse-slow">
            Modifiez votre profil, votre avatar ou ajoutez de nouveaux amis au groupe des planificateurs.
          </p>
        </div>
        <button
          onClick={() => setActivePage("dashboard")}
          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs py-2 px-3.5 rounded-xl transition duration-200 cursor-pointer"
        >
          ← Retour au Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Profile setup card */}
        <div className="bg-slate-50 rounded-2.5xl p-5 border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Modifier Mon Profil Actuel
          </h3>

          <div className="flex items-center gap-4">
            <img
              src={currentMember.avatar}
              alt={currentMember.name}
              className="w-16 h-16 rounded-full border-2 border-indigo-600 shadow-md object-cover"
            />
            <div>
              <h4 className="font-bold text-slate-900 text-sm">{currentMember.name}</h4>
              <p className="text-xs text-slate-400">ID Unique : {currentMember.id}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                NOM D'AFFICHAGE DU VOYAGEUR
              </label>
              <input
                type="text"
                value={currentMember.name}
                onChange={(e) => {
                  const nextName = e.target.value;
                  if (!nextName) return;
                  setMembers(members.map(m => m.id === currentMember.id ? { ...m, name: nextName } : m));
                }}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                AVATAR ILLUSTRE (URL IMAGE)
              </label>
              <input
                type="text"
                value={currentMember.avatar}
                onChange={(e) => {
                  const nextAvatar = e.target.value;
                  if (!nextAvatar) return;
                  setMembers(members.map(m => m.id === currentMember.id ? { ...m, avatar: nextAvatar } : m));
                }}
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-xs text-indigo-700">
            <p className="font-bold animate-pulse">💡 Astuce :</p>
            <p className="mt-0.5">Vous pouvez changer d'identité simulée dans la barre violette de simulation en un clic pour tester les réactions, votes et calendrier !</p>
          </div>
        </div>

        {/* Group list card */}
        <div className="bg-slate-50 rounded-2.5xl p-5 border border-slate-200 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Membres de Co-Tripper ({members.length})
          </h3>

          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-white border border-slate-150 p-2.5 rounded-xl">
                <div className="flex items-center gap-2">
                  <img src={m.avatar} alt={m.name} className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">{m.name}</p>
                    <p className="text-[10px] text-slate-400">Participant Co-Tripper</p>
                  </div>
                </div>
                <span className="text-[9px] uppercase font-bold text-slate-400 font-mono bg-slate-50 border px-2 py-0.5 rounded">
                  Co-planificateur
                </span>
              </div>
            ))}
          </div>

          {/* Add new traveler */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const nicknameInput = form.elements.namedItem("nickname") as HTMLInputElement;
              const nameVal = nicknameInput?.value.trim() || "";
              if (!nameVal) return;
              if (members.some(m => m.name.toLowerCase() === nameVal.toLowerCase())) {
                alert("Ce nom d'ami existe déjà.");
                return;
              }

              // Create traveler
              const randomAvatars = [
                "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80",
                "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&h=120&q=80",
                "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80",
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80"
              ];
              const randomAvatar = randomAvatars[Math.floor(Math.random() * randomAvatars.length)];

              const newM: Member = {
                id: uid("m"),
                name: nameVal,
                avatar: randomAvatar,
              };

              const updatedMembers = [...members, newM];
              setMembers(updatedMembers);
              nicknameInput.value = "";
            }}
            className="space-y-2 pt-2 border-t border-slate-200"
          >
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              AJOUTER UN PARTICIPANT AU WORKSPACE
            </label>
            <div className="flex gap-2">
              <input
                name="nickname"
                type="text"
                required
                placeholder="ex: Marie, Marc..."
                className="flex-1 bg-white border border-slate-200 rounded-xl p-2 text-xs focus:ring-2 focus:ring-indigo-500/20 font-semibold"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shrink-0"
              >
                Ajouter
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
