import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { tripMembers, documents } from "../db/schema";
import { requireAuth } from "../auth/middleware";
import { loadTripAggregate } from "../services/trip-aggregate";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 Mo par fichier
const TRIP_QUOTA_BYTES = 50 * 1024 * 1024; // 50 Mo par voyage
const UPLOAD_DIR = path.resolve("data/uploads");
const ALLOWED = /^(image\/|application\/pdf)/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED.test(file.mimetype));
  },
});

const router = Router();
router.use(requireAuth);

async function requireMembership(req: Request, res: Response, next: NextFunction): Promise<void> {
  const [m] = await db
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, req.params.id), eq(tripMembers.userId, req.user!.id)));
  if (!m) {
    res.status(404).json({ error: "Voyage introuvable." });
    return;
  }
  next();
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// POST /api/trips/:id/uploads — téléversement d'un fichier (image ou PDF)
router.post(
  "/:id/uploads",
  requireMembership,
  (req, res, next) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "Fichier trop volumineux (5 Mo maximum)." });
        return;
      }
      if (err) {
        res.status(400).json({ error: "Téléversement invalide." });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Aucun fichier reçu (types acceptés : images, PDF)." });
      return;
    }

    // Quota par voyage.
    const existing = await db
      .select({ sizeBytes: documents.sizeBytes })
      .from(documents)
      .where(eq(documents.tripId, req.params.id));
    const used = existing.reduce((s, d) => s + d.sizeBytes, 0);
    if (used + file.size > TRIP_QUOTA_BYTES) {
      res.status(413).json({ error: "Quota de stockage du voyage atteint (50 Mo)." });
      return;
    }

    const fileId = randomUUID();
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, fileId), file.buffer);

    const type = file.mimetype.startsWith("image/")
      ? "image"
      : file.mimetype === "application/pdf"
        ? "pdf"
        : "other";

    await db.insert(documents).values({
      id: fileId,
      tripId: req.params.id,
      uploadedBy: req.user!.id,
      name: file.originalname,
      type,
      size: humanSize(file.size),
      sizeBytes: file.size,
      mimeType: file.mimetype,
      url: `/api/trips/${req.params.id}/files/${fileId}`,
    });

    res.status(201).json({ trip: await loadTripAggregate(req.params.id) });
  },
);

// GET /api/trips/:id/files/:fileId — récupération authentifiée d'un fichier
router.get("/:id/files/:fileId", requireMembership, async (req, res) => {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, req.params.fileId), eq(documents.tripId, req.params.id)));
  if (!doc) {
    res.status(404).json({ error: "Fichier introuvable." });
    return;
  }
  const filePath = path.join(UPLOAD_DIR, doc.id);
  if (doc.mimeType) res.setHeader("Content-Type", doc.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.name)}"`);
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "Fichier introuvable." });
  });
});

export default router;
