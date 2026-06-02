import { FileText, Download, Trash2, Image as ImageIcon } from "lucide-react";
import { useTripStore } from "../store/TripContext";

/** Onglet de partage de documents et photos. */
export default function MediaTab() {
  const {
    activeTrip,
    dragActive,
    handleDrag,
    handleDrop,
    handleDeleteDoc,
    handleAddManualDoc,
    simulatedDocName,
    setSimulatedDocName,
    handleDeletePhoto,
    handleAddPhoto,
    photoUrlInput,
    setPhotoUrlInput,
    photoCaptionInput,
    setPhotoCaptionInput,
  } = useTripStore();
  if (!activeTrip) return null;

  return (
    <div id="bento-card-sharing" className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fadeIn">

      {/* COMPONENT 4A: DOCUMENT DEPOSIT DRAG & DROP SIMULATOR */}
      <div
        className={`bg-white rounded-3xl p-5 border shadow-xs transition-all flex flex-col justify-between space-y-4 min-h-[350px] ${
          dragActive ? "border-indigo-500 bg-indigo-50/20" : "border-slate-200/80"
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-600" /> Documents partagés
            </h3>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded">
              Centralisé ({activeTrip.documents.length})
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mt-2">
            Déposez vos justificatifs, réservations d'hôtels, ou billets d'avion de groupe pour que tout le monde y accède.
          </p>

          {/* Document collection list */}
          <div className="space-y-2 mt-4 max-h-[160px] overflow-y-auto pr-1">
            {activeTrip.documents.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">
                Aucun justificatif ou billet centralisé.
              </p>
            ) : (
              activeTrip.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-base text-slate-600 shrink-0">📄</span>
                    <div className="truncate">
                      <p className="font-semibold text-slate-700 truncate" title={doc.name}>
                        {doc.name}
                      </p>
                      <span className="text-[9px] text-slate-400 block">
                        Ajouté par {doc.uploadedBy} • {doc.size}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => alert(`Téléchargement simulé de : ${doc.name}`)}
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                      title="Télécharger le fichier"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upload Simulator form */}
        <div className="pt-2 border-t border-slate-100">
          <form onSubmit={handleAddManualDoc} className="space-y-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Fichier à centraliser (ex: Confirmation_Hotel.pdf)"
                value={simulatedDocName}
                onChange={(e) => setSimulatedDocName(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 w-full"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[11px] px-3.5 rounded-xl transition cursor-pointer select-none shrink-0"
              >
                Déposer
              </button>
            </div>
            <div className="bg-dashed border border-slate-200 rounded-xl py-3 text-center text-[9px] text-slate-400 font-mono uppercase tracking-wider">
              Zone active de dépôt (Drag & Drop)
            </div>
          </form>
        </div>
      </div>

      {/* COMPONENT 4B: PHOTO ALBUM */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 min-h-[350px]">
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-indigo-600" /> Album d'Inspirations
            </h3>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded">
              Photos ({activeTrip.photos.length})
            </span>
          </div>

          <p className="text-[11px] text-slate-400 mt-2">
            Liez des liens d'images de beaux paysages ou d'adresses d'hôtels repérés pour donner envie au groupe !
          </p>

          {/* Photo Album grid */}
          <div className="grid grid-cols-3 gap-2 mt-4 max-h-[160px] overflow-y-auto pr-1">
            {activeTrip.photos.length === 0 ? (
              <div className="col-span-3 text-center text-xs text-slate-400 italic py-6">
                Aucune photo de planification partagée.
              </div>
            ) : (
              activeTrip.photos.map((ph) => (
                <div key={ph.id} className="relative rounded-lg overflow-hidden group aspect-video bg-slate-100">
                  <img
                    src={ph.url}
                    alt={ph.caption}
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition duration-200 flex flex-col justify-between p-1">
                    <button
                      onClick={() => handleDeletePhoto(ph.id)}
                      className="self-end p-0.5 bg-rose-600 text-white rounded hover:bg-rose-700"
                      title="Retirer l'image"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                    <span className="text-[8px] text-white font-medium truncate block">
                      {ph.caption}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Photo addition form */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <form onSubmit={handleAddPhoto} className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="url"
                placeholder="URL de l'image (ex: unsplash)"
                value={photoUrlInput}
                onChange={(e) => setPhotoUrlInput(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl p-1.5 text-xs focus:ring-1 focus:ring-indigo-500 w-full font-medium"
              />
              <input
                type="text"
                placeholder="Légende (ex: Spot couché de soleil)"
                value={photoCaptionInput}
                onChange={(e) => setPhotoCaptionInput(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl p-1.5 text-xs focus:ring-1 focus:ring-indigo-500 w-full font-medium"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs py-1.5 rounded-xl transition cursor-pointer"
            >
              Ajouter l'image à l'album
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}
