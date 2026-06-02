import { Users, MessageSquare, Send } from "lucide-react";
import { avatarUrl } from "../lib/avatar";
import { useTripStore } from "../store/TripContext";

/** Onglet de messagerie de groupe. */
export default function ChatTab() {
  const {
    activeTrip,
    currentMember,
    currentMemberId,
    handleSendChat,
    chatText,
    setChatText,
  } = useTripStore();
  if (!activeTrip || !currentMember) return null;

  return (
    <div id="bento-card-chat" className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-6 h-[500px] animate-fadeIn">
      {/* Simulated Members List Panel */}
      <div className="hidden md:flex flex-col border-r border-slate-100 pr-4 space-y-4 h-full overflow-hidden">
        <div className="pb-2 border-b border-slate-100">
          <h4 className="text-[11px] font-bold text-indigo-900 uppercase tracking-widest flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Groupe de planners ({activeTrip.members.length})
          </h4>
          <p className="text-[9px] text-slate-400 font-mono mt-0.5">En Ligne & Synchronisés</p>
        </div>
        <div className="space-y-2 flex-grow overflow-y-auto">
          {activeTrip.members.map((m) => {
            const isSimulatedConnected = m.id === currentMemberId;
            return (
              <div key={m.id} className={`flex items-center gap-2 p-1.5 rounded-xl transition ${isSimulatedConnected ? "bg-indigo-50" : ""}`}>
                <div className="relative">
                  <img src={avatarUrl(m.name, m.avatar)} alt={m.name} className="w-7 h-7 rounded-full object-cover" />
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-white rounded-full"></span>
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 truncate">
                    {m.name}
                    {isSimulatedConnected && <span className="bg-indigo-600 text-white text-[8px] font-bold px-1 rounded-sm scale-90 shrink-0">Moi</span>}
                  </p>
                  <p className="text-[8px] text-indigo-600/60 font-mono">Disponibilité mise à jour</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Instant Chat Component */}
      <div className="col-span-1 md:col-span-3 flex flex-col justify-between h-full space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></div>
            <h3 className="font-bold text-slate-805 text-xs uppercase tracking-wider flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" /> Salle de discussion instantanée
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 italic">Discussions de voyage ({activeTrip.messages.length} messages)</span>
        </div>

        {/* Messages Scroll Log */}
        <div className="flex-grow overflow-y-auto space-y-3.5 pr-1 max-h-[300px] scroll-smooth">
          {activeTrip.messages.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">
              Aucun message posté. Envoyez le premier message de planification !
            </p>
          ) : (
            activeTrip.messages.map((msg) => {
              const isOwn = msg.senderId === currentMember.id;
              const isSystem = msg.senderId === "system";

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex gap-2 p-2.5 bg-indigo-50 rounded-xl border border-indigo-150/50 text-[11px] text-indigo-800">
                    <span className="font-bold shrink-0">🤖 Assistant :</span>
                    <p className="italic">{msg.text}</p>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isOwn ? "flex-row-reverse" : ""}`}
                >
                  <img
                    src={avatarUrl(msg.senderName, msg.senderAvatar)}
                    alt={msg.senderName}
                    className="w-7 h-7 rounded-full shrink-0 shadow-2xs object-cover"
                  />
                  <div className={`max-w-[75%] p-2.5 rounded-2xl text-xs space-y-1 ${
                    isOwn
                      ? "bg-indigo-600 text-white rounded-tr-none"
                      : "bg-slate-100 text-slate-800 rounded-tl-none"
                  }`}>
                    <div className="flex justify-between items-center gap-2">
                      <span className={`font-bold text-[9px] ${isOwn ? "text-indigo-200" : "text-indigo-600"}`}>
                        {msg.senderName}
                      </span>
                      <span className="text-[9px] opacity-60 font-mono">
                        {msg.timestamp}
                      </span>
                    </div>
                    <p className="leading-relaxed break-words">{msg.text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Text entry box */}
        <form onSubmit={handleSendChat} className="pt-2 shrink-0 border-t border-slate-100">
          <div className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Tapez un message de groupe..."
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500/20 text-slate-700 outline-hidden font-medium"
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-4 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
