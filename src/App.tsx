import { lazy, Suspense } from "react";
import { TripContext, useTripStore } from "./store/TripContext";
import { useTripController } from "./store/useTripController";
import AppHeader from "./components/AppHeader";
import DashboardSidebar from "./features/DashboardSidebar";
import TripWorkspace from "./features/TripWorkspace";
import LoadingFallback from "./components/LoadingFallback";
import AuthScreen from "./pages/AuthScreen";

const CreateTripPage = lazy(() => import("./pages/CreateTripPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));

export default function App() {
  const store = useTripController();
  return (
    <TripContext.Provider value={store}>
      <AppShell />
    </TripContext.Provider>
  );
}

function AppShell() {
  const { authStatus, activePage, activeTrip, isLoadingTrip, mutationError, setActivePage } =
    useTripStore();

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <LoadingFallback label="Chargement…" />
      </div>
    );
  }

  if (authStatus === "anon") {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-3 sm:p-6 font-sans antialiased">
      <div className="max-w-[1440px] mx-auto space-y-4">
        <AppHeader />

        {mutationError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-2xl px-4 py-2.5">
            ⚠️ {mutationError}
          </div>
        )}

        {activePage === "dashboard" &&
          (activeTrip ? (
            <div id="bento-grid-dashboard" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <DashboardSidebar />
              <TripWorkspace />
            </div>
          ) : (
            <EmptyTripsState onCreate={() => setActivePage("create-trip")} loading={isLoadingTrip} />
          ))}

        {(activePage === "create-trip" || activePage === "account") && (
          <Suspense fallback={<LoadingFallback />}>
            {activePage === "create-trip" && <CreateTripPage />}
            {activePage === "account" && <AccountPage />}
          </Suspense>
        )}

        <footer className="pt-4 pb-12 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-3 border-t border-slate-200">
          <p className="font-medium text-slate-500">
            Co-Tripper • Planificateur de Voyage en Groupe
          </p>
          <span className="italic">L'aventure commence ici ! 🌄</span>
        </footer>
      </div>
    </div>
  );
}

function EmptyTripsState({
  onCreate,
  loading,
}: {
  onCreate: () => void;
  loading: boolean;
}) {
  const { joinTripIdInput, setJoinTripIdInput, handleJoinTrip } = useTripStore();
  if (loading) return <LoadingFallback label="Chargement de vos voyages…" />;
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-xl mx-auto text-center space-y-5 animate-fadeIn">
      <span className="text-4xl">🛶</span>
      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-slate-900">Aucun voyage pour l'instant</h2>
        <p className="text-xs text-slate-500">
          Créez votre premier projet de voyage de groupe, ou rejoignez-en un via son code de partage.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl transition cursor-pointer"
      >
        ➕ Créer mon premier voyage
      </button>
      <div className="pt-3 border-t border-slate-100">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleJoinTrip(joinTripIdInput);
          }}
          className="flex gap-2 max-w-sm mx-auto"
        >
          <input
            type="text"
            value={joinTripIdInput}
            onChange={(e) => setJoinTripIdInput(e.target.value)}
            placeholder="Code de partage du voyage"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500/20 outline-hidden"
          />
          <button
            type="submit"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 rounded-xl transition cursor-pointer shrink-0"
          >
            Rejoindre
          </button>
        </form>
      </div>
    </div>
  );
}
