import { MapPin, ThumbsUp, Trash2, ArrowRight } from "lucide-react";
import { useTripStore } from "../store/TripContext";
import CityAutocomplete from "../components/CityAutocomplete";

/** Onglet de proposition et de vote des destinations. */
export default function VotingTab() {
  const {
    activeTrip,
    currentMember,
    setActiveTab,
    handleVoteDestination,
    handleChooseDestination,
    handleDeleteDestinationProposal,
    handleAddDestination,
    newDestName,
    setNewDestName,
  } = useTripStore();
  if (!activeTrip || !currentMember) return null;

  return (
    <div id="bento-card-voting" className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
            <MapPin className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
              Destination du voyage
            </h3>
            <p className="text-xs text-slate-400">
              Déjà décidée ? Elle est indiquée ci-dessous. Encore hésitants ? Proposez des villes, votez, puis <strong>choisissez</strong> la destination.
            </p>
          </div>
        </div>
        <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full text-[10.5px]">
          {activeTrip.destinations.length} propositions
        </span>
      </div>

      {activeTrip.selectedDestination && (
        <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/30 p-4 rounded-2xl border border-indigo-100/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="text-[10px] text-indigo-500 uppercase font-extrabold tracking-wider">DESTINATION CHOISIE</p>
              <h4 className="text-sm font-bold text-indigo-950">Cap sur : {activeTrip.selectedDestination}</h4>
            </div>
          </div>
          <button
            onClick={() => setActiveTab("itinerary")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-1.5 px-3 rounded-xl transition duration-200 flex items-center gap-1 cursor-pointer whitespace-nowrap self-end sm:self-auto"
          >
            Créer le programme à {activeTrip.selectedDestination}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Proposals list with matching indicators */}
      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
        {activeTrip.destinations.length === 0 ? (
          <div className="p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400 italic">
            Aucune destination n'a encore été votée ou proposée. Renseignez-en une ci-dessous !
          </div>
        ) : (
          activeTrip.destinations.map((dest) => {
            const totalVotes = dest.votes.length;
            const ratio = Math.min((totalVotes / Math.max(activeTrip.members.length, 1)) * 100, 100);
            const isVotedByCurrent = dest.votes.includes(currentMember.id);
            const isWinning = activeTrip.selectedDestination === dest.name;

            return (
              <div
                key={dest.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isWinning
                    ? "bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-500/5"
                    : "bg-slate-50 border-slate-100"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 text-sm">{dest.name}</span>
                      {isWinning && (
                        <span className="bg-indigo-600 text-white font-bold text-[8.5px] uppercase px-1.5 py-0.5 rounded">
                          CHOISIE ✓
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Suggéré par <strong className="text-slate-600 font-semibold">{dest.proposedBy}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isWinning && (
                      <button
                        onClick={() => handleChooseDestination(dest.name)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition select-none bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        title="Définir cette ville comme destination du voyage"
                      >
                        Choisir
                      </button>
                    )}
                    {/* Vote button toggler */}
                    <button
                      onClick={() => handleVoteDestination(dest.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition select-none ${
                        isVotedByCurrent
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                          : "bg-slate-200/80 hover:bg-slate-300 text-slate-700"
                      }`}
                      title={isVotedByCurrent ? "Retirer mon vote" : "Voter pour cette ville"}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{totalVotes}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteDestinationProposal(dest.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 cursor-pointer transition"
                      title="Supprimer cette suggestion"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Gauge indicator */}
                <div className="mt-3">
                  <div className="flex justify-between items-center text-[9px] text-slate-400 mb-1 font-semibold">
                    <span>Adhésion collective</span>
                    <span>{Math.round(ratio)}% ({totalVotes}/{activeTrip.members.length} membres)</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${ratio}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Form to append destination */}
      <form onSubmit={handleAddDestination} className="pt-2 flex gap-2">
        <CityAutocomplete
          value={newDestName}
          onChange={setNewDestName}
          required
          placeholder="Saisir une ville réelle (ex : Chamonix, Florence...)"
          className="flex-1"
          inputClassName="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium"
        />
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition duration-300 cursor-pointer flex items-center shrink-0"
        >
          Proposer
        </button>
      </form>
    </div>
  );
}
