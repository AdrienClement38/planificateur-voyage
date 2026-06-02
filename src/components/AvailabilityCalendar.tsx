import React, { useState } from "react";
import { Calendar, Plus, Trash2, AlertTriangle } from "lucide-react";
import type { Member } from "../types";
import { avatarUrl } from "../lib/avatar";
import { useTripStore } from "../store/TripContext";

export default function AvailabilityCalendar() {
  const {
    activeTrip: trip,
    currentMember,
    handleAddAvailability: addAvailability,
    handleDeleteAvailability: removeAvailability,
    handlePatchTrip,
  } = useTripStore();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!trip || !currentMember) return null;

  const handleAddAvailability = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!startDate || !endDate) {
      setErrorMsg("Veuillez choisir les dates de début et de fin.");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setErrorMsg("La date de début doit être antérieure à la date de fin.");
      return;
    }

    addAvailability(startDate, endDate);
    setStartDate("");
    setEndDate("");
  };

  const handleDeleteAvailability = (id: string) => {
    removeAvailability(id);
  };

  // Ideal Overlap Date Finder Algorithm
  // Find top 3 periods with most participants
  const computeTop3Periods = () => {
    if (trip.availabilities.length === 0) return [];

    const dayCounts: { [dateStr: string]: string[] } = {};

    trip.availabilities.forEach((avail) => {
      const start = new Date(avail.start);
      const end = new Date(avail.end);
      const current = new Date(start);

      let count = 0;
      while (current <= end && count < 65) {
        const dateStr = current.toISOString().split("T")[0];
        if (!dayCounts[dateStr]) {
          dayCounts[dateStr] = [];
        }
        if (!dayCounts[dateStr].includes(avail.memberId)) {
          dayCounts[dateStr].push(avail.memberId);
        }
        current.setDate(current.getDate() + 1);
        count++;
      }
    });

    const activeDates = Object.keys(dayCounts).sort();
    if (activeDates.length === 0) return [];

    const neededDays = trip.targetDays;
    const candidates: Array<{
      startDate: string;
      endDate: string;
      daysCount: number;
      membersCount: number;
      members: Member[];
      missingMembers: Member[];
      score: number;
    }> = [];

    // Evaluate sliding window of 'neededDays' size starting on any day
    for (let i = 0; i <= activeDates.length - neededDays; i++) {
      const candidateStartStr = activeDates[i];
      const candidateStartDate = new Date(candidateStartStr);

      const candidateRange: string[] = [];
      let currentMembersIntersection: string[] | null = null;
      const membersUnion = new Set<string>();

      for (let offset = 0; offset < neededDays; offset++) {
        const d = new Date(candidateStartDate);
        d.setDate(d.getDate() + offset);
        const dStr = d.toISOString().split("T")[0];
        candidateRange.push(dStr);

        const dayMembers = dayCounts[dStr] || [];
        dayMembers.forEach(m => membersUnion.add(m));

        if (currentMembersIntersection === null) {
          currentMembersIntersection = [...dayMembers];
        } else {
          currentMembersIntersection = currentMembersIntersection.filter(m => dayMembers.includes(m));
        }
      }

      const countIntersect = currentMembersIntersection ? currentMembersIntersection.length : 0;
      const score = countIntersect * 1000 + membersUnion.size;

      if (countIntersect > 0) {
        candidates.push({
          startDate: candidateRange[0],
          endDate: candidateRange[candidateRange.length - 1],
          daysCount: neededDays,
          membersCount: countIntersect,
          members: trip.members.filter((m) => currentMembersIntersection!.includes(m.id)),
          missingMembers: trip.members.filter((m) => !currentMembersIntersection!.includes(m.id)),
          score,
        });
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Keep top 3 with distinct start dates
    const distinctPeriods: typeof candidates = [];
    const usedStartDates = new Set<string>();
    for (const cand of candidates) {
      if (!usedStartDates.has(cand.startDate)) {
        distinctPeriods.push(cand);
        usedStartDates.add(cand.startDate);
        if (distinctPeriods.length >= 3) break;
      }
    }

    // Fallback: If no sliding candidates, use individual days with highest participant count
    if (distinctPeriods.length === 0) {
      const daysList = Object.entries(dayCounts)
        .map(([day, mIds]) => ({
          day,
          mIds,
          score: mIds.length
        }))
        .sort((a, b) => b.score - a.score);

      const topDays = daysList.slice(0, 3);
      topDays.forEach(({ day, mIds }) => {
        distinctPeriods.push({
          startDate: day,
          endDate: day,
          daysCount: 1,
          membersCount: mIds.length,
          members: trip.members.filter((m) => mIds.includes(m.id)),
          missingMembers: trip.members.filter((m) => !mIds.includes(m.id)),
          score: mIds.length * 1000,
        });
      });
    }

    return distinctPeriods.slice(0, 3);
  };

  const topPeriods = computeTop3Periods();

  // Helper date formatter: French Locale
  const formatFrenchDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div id="availability-section" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Calendrier Commun & Disponibilités
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Chacun ajoute ses périodes de liberté. L'algorithme calcule automatiquement les meilleures dates pour un séjour de{" "}
            <span className="font-semibold text-slate-700">{trip.targetDays} jours</span> : il vous propose les <strong>3 meilleures options</strong> !
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Input and Current List */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
            <h3 className="font-semibold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 bg-indigo-50 text-indigo-700 text-xs rounded-full font-bold">
                1
              </span>
              Ajouter mes périodes libres
            </h3>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-4 text-xs text-slate-600">
              <img
                src={avatarUrl(currentMember.name, currentMember.avatar)}
                alt={currentMember.name}
                className="w-7 h-7 rounded-full border border-white shadow-xs"
              />
              <div>
                <span>Vous êtes connecté en tant que </span>
                <span className="font-semibold text-slate-800">{currentMember.name}</span>
              </div>
            </div>

            <form onSubmit={handleAddAvailability} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  DATE DE DÉBUT
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  DATE DE FIN
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-500 font-medium">{errorMsg}</p>
              )}

              <button
                type="submit"
                className="w-full justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs py-2.5 rounded-xl transition duration-300 flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Enregistrer mes dates
              </button>
            </form>
          </div>

          {/* Current member lists */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
            <h3 className="font-semibold text-slate-800 text-sm mb-3">
              Toutes les périodes enregistrées
            </h3>
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto">
              {trip.availabilities.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  Aucune date enregistrée pour le moment.
                </p>
              ) : (
                trip.availabilities.map((avail) => {
                  const member = trip.members.find((m) => m.id === avail.memberId);
                  const isOwn = avail.memberId === currentMember.id;
                  return (
                    <div
                      key={avail.id}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
                        isOwn
                          ? "bg-indigo-50/50 border-indigo-100"
                          : "bg-slate-50/60 border-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={member?.avatar || "/avatar-fallback.png"}
                          alt={member?.name}
                          className="w-6 h-6 rounded-full"
                        />
                        <div>
                          <p className="font-medium text-slate-800">
                            {member?.name} {isOwn && <span className="text-[10px] text-indigo-600 font-semibold">(Moi)</span>}
                          </p>
                          <p className="text-slate-500 text-[10px]">
                            Du {avail.start.split("-").reverse().join("/")} au {avail.end.split("-").reverse().join("/")}
                          </p>
                        </div>
                      </div>
                      {isOwn && (
                        <button
                          onClick={() => handleDeleteAvailability(avail.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded-md transition hover:bg-rose-50 cursor-pointer"
                          title="Supprimer cette période"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Columns: Auto Recommendation Results & Visual Matrix */}
        <div className="lg:col-span-2 space-y-6">
          {/* Automatic Ideal Period Decision Card */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md relative overflow-hidden border border-slate-800">
            {/* Ambient pattern */}
            <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none">
              <Calendar className="w-64 h-64 translate-x-12 translate-y-12" />
            </div>

            <div className="relative z-10 space-y-4">
              <span className="bg-indigo-600/30 text-indigo-300 text-[10px] font-mono font-bold tracking-wider uppercase px-2.5 py-1 rounded-full border border-indigo-500/20">
                🧭 Les 3 meilleures périodes de présence
              </span>

              {topPeriods.length > 0 ? (
                <div className="space-y-3 pt-2">
                  {topPeriods.map((period, idx) => {
                    const badgeColors = ["bg-emerald-500/20 text-emerald-300 border-emerald-500/35", "bg-indigo-500/20 text-indigo-300 border-indigo-500/35", "bg-amber-500/20 text-amber-300 border-amber-500/35"];
                    const medals = ["🏆 Option 1 (Recommandée)", "🥈 Option 2 (Alternative)", "🥉 Option 3 (Alternative)"];
                    return (
                      <div 
                        key={idx} 
                        className="bg-slate-800/80 border border-slate-700 hover:border-indigo-500 rounded-xl p-3 hover:bg-slate-800 transition duration-300 cursor-pointer text-left"
                        onClick={() => {
                          // set dates
                          const dateStringText = `Du ${formatFrenchDate(period.startDate)} au ${formatFrenchDate(period.endDate)}`;
                          handlePatchTrip({
                            description: `${trip.description.split(" (Dates projet :")[0]} (Dates projet : ${dateStringText})`,
                          });
                          alert(`Dates de voyage coordonnées pour : ${dateStringText}`);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-350">
                            {medals[idx]}
                          </span>
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${badgeColors[idx]}`}>
                            {period.membersCount} dispo / {trip.members.length}
                          </span>
                        </div>
                        
                        <h4 className="text-xs font-bold text-white mt-1">
                          Du {formatFrenchDate(period.startDate)} au {formatFrenchDate(period.endDate)}
                        </h4>
                        
                        <div className="flex items-center justify-between gap-1.5 mt-2 pt-1.5 border-t border-slate-700/60">
                          <div className="flex -space-x-1">
                            {period.members.map((m) => (
                              <img key={m.id} src={avatarUrl(m.name, m.avatar)} className="w-5 h-5 rounded-full border border-slate-700" title={m.name} alt="" />
                            ))}
                          </div>
                          
                          {period.missingMembers.length === 0 ? (
                            <span className="text-[9px] text-emerald-400 font-semibold flex items-center gap-0.5">
                              ✓ Présence Complète
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400 truncate max-w-[120px]">
                              Absents: {period.missingMembers.map(m => m.name).join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div className="text-[10px] bg-indigo-950/40 p-2.5 rounded-xl text-indigo-200/80 border border-indigo-900/40 text-center">
                    💡 <em>Cliquez sur une option de dates pour la configurer comme période active du séjour !</em>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center space-y-3">
                  <AlertTriangle className="w-8 h-8 text-indigo-400 mx-auto" />
                  <p className="text-xs font-semibold">
                    En attente de disponibilités pour calculer les 3 périodes optimales.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Saisissez vos dates dans le formulaire à gauche pour lancer la détection automatique.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Availability visual alignment matrix */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
            <h3 className="font-semibold text-slate-800 text-sm mb-3">
              Superposition Visuelle des Disponibilités
            </h3>
            
            {trip.availabilities.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6">
                Ajoutez des dates pour afficher la timeline comparative.
              </p>
            ) : (
              <div className="space-y-4">
                {trip.members.map((member) => {
                  const memberAvails = trip.availabilities.filter(a => a.memberId === member.id);
                  return (
                    <div key={member.id} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <img src={avatarUrl(member.name, member.avatar)} alt={member.name} className="w-5 h-5 rounded-full" />
                          <span className="text-xs font-semibold text-slate-700">{member.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {memberAvails.length} segment(s)
                        </span>
                      </div>

                      {/* Visual segment simulator */}
                      <div className="relative h-6 bg-slate-50 border border-slate-100 rounded-lg overflow-hidden flex items-center px-2">
                        {memberAvails.length === 0 ? (
                          <span className="text-[10px] text-slate-400 italic">Pas de disponibilités</span>
                        ) : (
                          <div className="w-full flex gap-1 h-3">
                            {memberAvails.map((avail) => (
                              <div
                                key={avail.id}
                                className="h-full bg-indigo-500/80 rounded-sm flex items-center justify-center text-[8px] text-white font-mono px-1.5"
                                style={{ flexGrow: 1 }}
                              >
                                {avail.start.substring(5).replace("-", "/")} ➜ {avail.end.substring(5).replace("-", "/")}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-3">
                  <span>ℹ️ L'algorithme se base sur l'intersection maximale glissante.</span>
                  <span className="font-mono text-indigo-600 font-semibold">Algorithme V3.0 • Top 3 Actif</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
