import mongoose from "mongoose";
import { Router, type NextFunction, type Request, type Response } from "express";
import { GenerationLog, Poster, Template } from "./models";
import { requireAuth } from "./auth";
import { buildPosterHtml } from "./posterHtml";
import { renderPosterPng } from "./renderPoster";
import { decorationFor } from "./geminiCache";

type AuthedRequest = Request & { userId?: string };

// Words the owner may change without rendering a new image.
const textFields = ["name", "designation", "party", "district", "headline"] as const;

// Recent render and regenerate times for each user. Cleared when the server restarts.
const renderHits = new Map<string, number[]>();

function limitRenders(req: AuthedRequest, res: Response, next: NextFunction) {
  const now = Date.now();
  const recent = (renderHits.get(req.userId ?? "") ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 10) {
    res.status(429).json({ error: "too many renders" });
    return;
  }
  recent.push(now);
  renderHits.set(req.userId ?? "", recent);
  next();
}

// Same shape for one poster and for each item in the list.
function toPoster(poster: {
  id: string;
  status: string;
  templateId: unknown;
  formData: unknown;
  uploadedPhotoUrls: string[];
  generatedImageUrl?: string | null;
  jpgUrl?: string | null;
  pdfUrl?: string | null;
  regenerateCount?: number | null;
  clean?: boolean;
}) {
  return {
    id: poster.id,
    status: poster.status,
    templateId: String(poster.templateId),
    formData: poster.formData,
    uploadedPhotoUrls: poster.uploadedPhotoUrls,
    generatedImageUrl: poster.generatedImageUrl ?? "",
    jpgUrl: poster.jpgUrl ?? "",
    pdfUrl: poster.pdfUrl ?? "",
    // Rebuilds used. The first Save draft image does not count.
    regenerateCount: poster.regenerateCount ?? 0,
    clean: poster.clean === true,
  };
}

// Preview and PNG render both use this page.
async function htmlForPoster(poster: {
  id: string;
  templateId: unknown;
  formData: unknown;
  uploadedPhotoUrls: string[];
  clean?: boolean;
}) {
  const template = await Template.findById(poster.templateId);
  const layout = (template?.layoutConfig ?? {}) as { colors?: string[]; photoSlots?: number };
  const formData = (poster.formData ?? {}) as Record<string, unknown>;
  const templateColors = Array.isArray(layout.colors) ? layout.colors : [];
  const occasion = String(template?.occasionType ?? "");
  // Saved answers are reused. A missing answer keeps the seed colors, center crop, and no frame.
  const started = Date.now();
  const result = await decorationFor(occasion);
  const decoration = result.decoration;
  const success = Boolean(decoration.colors || decoration.objectPosition || decoration.border || decoration.pattern);
  // Occasion is the text sent to Gemini. tokensUsed is omitted when no count came back.
  const log: {
    posterId: string;
    geminiPromptUsed: string;
    latencyMs: number;
    success: boolean;
    tokensUsed?: number;
  } = {
    posterId: poster.id,
    geminiPromptUsed: occasion,
    latencyMs: Date.now() - started,
    success,
  };
  if (typeof result.tokensUsed === "number") log.tokensUsed = result.tokensUsed;
  await GenerationLog.create(log);
  const colors = decoration.colors
    ? [decoration.colors.backgroundColor, decoration.colors.accentColor]
    : templateColors;
  const objectPosition = decoration.objectPosition ?? "center";
  const border = decoration.border ?? "none";
  return buildPosterHtml({
    formData,
    photoUrls: poster.uploadedPhotoUrls,
    colors,
    photoSlots: typeof layout.photoSlots === "number" ? layout.photoSlots : 0,
    objectPosition,
    border,
    pattern: decoration.pattern ?? "none",
    clean: poster.clean === true,
  });
}

// Saves a draft, lists posters, reads one, and can render a PNG.
export const posterRouter = Router();

posterRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const body = req.body as {
    templateId?: string;
    formData?: Record<string, unknown>;
    uploadedPhotoUrls?: unknown;
  };
  const photos = Array.isArray(body.uploadedPhotoUrls) ? body.uploadedPhotoUrls : [];

  if (!body.templateId) {
    res.status(400).json({ error: "templateId is required" });
    return;
  }
  if (photos.length > 3 || photos.some((url) => typeof url !== "string")) {
    res.status(400).json({ error: "uploadedPhotoUrls must be at most 3 strings" });
    return;
  }
  if (!mongoose.isValidObjectId(body.templateId)) {
    res.status(404).json({ error: "template not found" });
    return;
  }

  const template = await Template.findOne({ _id: body.templateId, isActive: true });
  if (!template) {
    res.status(404).json({ error: "template not found" });
    return;
  }

  const poster = await Poster.create({
    userId: req.userId,
    templateId: body.templateId,
    formData: body.formData ?? {},
    uploadedPhotoUrls: photos,
    status: "draft",
  });

  res.status(201).json({
    id: poster.id,
    status: poster.status,
    templateId: String(poster.templateId),
    formData: poster.formData,
    uploadedPhotoUrls: poster.uploadedPhotoUrls,
  });
});

// One draft per name. Chrome stays closed, so these posters have no image yet.
posterRouter.post("/bulk", requireAuth, async (req: AuthedRequest, res) => {
  const body = req.body as { templateId?: string; names?: unknown };
  const names = Array.isArray(body.names)
    ? body.names
        .filter((name): name is string => typeof name === "string")
        .map((name) => name.trim())
        .filter(Boolean)
    : [];
  if (!body.templateId || names.length < 1 || names.length > 5) {
    res.status(400).json({ error: "templateId and 1 to 5 names are required" });
    return;
  }
  if (!mongoose.isValidObjectId(body.templateId)) {
    res.status(404).json({ error: "template not found" });
    return;
  }

  const template = await Template.findOne({ _id: body.templateId, isActive: true });
  if (!template) {
    res.status(404).json({ error: "template not found" });
    return;
  }

  const created = [];
  for (const name of names) {
    const poster = await Poster.create({
      userId: req.userId,
      templateId: body.templateId,
      formData: { name },
      uploadedPhotoUrls: [],
      status: "draft",
    });
    created.push(toPoster(poster));
  }
  res.status(201).json(created);
});

posterRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await Poster.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json(rows.map((row) => toPoster(row)));
});

// Same list as GET /, but only when the URL id is the signed-in user.
posterRouter.get("/user/:userId", requireAuth, async (req: AuthedRequest, res) => {
  if (req.params.userId !== req.userId) {
    res.status(404).json({ error: "poster not found" });
    return;
  }
  const rows = await Poster.find({ userId: req.userId }).sort({ createdAt: -1 });
  res.json(rows.map((row) => toPoster(row)));
});

posterRouter.get("/:id/preview", requireAuth, async (req: AuthedRequest, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ error: "poster not found" });
    return;
  }

  const poster = await Poster.findById(id);
  if (!poster || String(poster.userId) !== req.userId) {
    res.status(404).json({ error: "poster not found" });
    return;
  }

  res.type("html").send(await htmlForPoster(poster));
});

posterRouter.post("/:id/render", requireAuth, limitRenders, async (req: AuthedRequest, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ error: "poster not found" });
    return;
  }

  const poster = await Poster.findById(id);
  if (!poster || String(poster.userId) !== req.userId) {
    res.status(404).json({ error: "poster not found" });
    return;
  }

  // Checked before Chrome starts so a blocked poster keeps its current image.
  if (poster.blocked) {
    res.status(400).json({ error: "poster blocked" });
    return;
  }

  // Saved before the image build so a status read can see generating.
  poster.status = "generating";
  await poster.save();

  try {
    const images = await renderPosterPng(await htmlForPoster(poster));
    poster.generatedImageUrl = images.png;
    poster.jpgUrl = images.jpg;
    poster.pdfUrl = images.pdf;
    poster.status = "completed";
    await poster.save();
    res.json(toPoster(poster));
  } catch (err) {
    console.error(err);
    poster.status = "failed";
    await poster.save();
    res.status(500).json({ error: "render failed" });
  }
});

// Same PNG step as /:id/render. Separate URL so the form can ask to rebuild one poster.
posterRouter.post("/:id/regenerate", requireAuth, limitRenders, async (req: AuthedRequest, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ error: "poster not found" });
    return;
  }

  const poster = await Poster.findById(id);
  if (!poster || String(poster.userId) !== req.userId) {
    res.status(404).json({ error: "poster not found" });
    return;
  }

  // Checked before Chrome starts so a blocked poster keeps its current image.
  if (poster.blocked) {
    res.status(400).json({ error: "poster blocked" });
    return;
  }

  // Checked before Chrome starts so a used-up poster keeps its current image.
  if ((poster.regenerateCount ?? 0) >= 3) {
    res.status(400).json({ error: "regenerate limit reached" });
    return;
  }

  // Saved before the image build so a status read can see generating.
  poster.status = "generating";
  await poster.save();

  try {
    const images = await renderPosterPng(await htmlForPoster(poster));
    poster.generatedImageUrl = images.png;
    poster.jpgUrl = images.jpg;
    poster.pdfUrl = images.pdf;
    poster.status = "completed";
    poster.regenerateCount = (poster.regenerateCount ?? 0) + 1;
    await poster.save();
    res.json(toPoster(poster));
  } catch (err) {
    console.error(err);
    poster.status = "failed";
    await poster.save();
    res.status(500).json({ error: "render failed" });
  }
});

posterRouter.get("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ error: "poster not found" });
    return;
  }

  const poster = await Poster.findById(id);
  if (!poster || String(poster.userId) !== req.userId) {
    res.status(404).json({ error: "poster not found" });
    return;
  }

  res.json(toPoster(poster));
});

// Updates only the text fields. The current PNG and JPEG stay until the next rebuild.
posterRouter.patch("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ error: "poster not found" });
    return;
  }

  const poster = await Poster.findById(id);
  if (!poster || String(poster.userId) !== req.userId) {
    res.status(404).json({ error: "poster not found" });
    return;
  }

  const incoming = ((req.body as { formData?: Record<string, unknown> }).formData ?? {}) as Record<string, unknown>;
  const current = (poster.formData ?? {}) as Record<string, unknown>;
  const next = { ...current };
  for (const key of textFields) {
    if (typeof incoming[key] === "string") next[key] = incoming[key];
  }
  poster.formData = next;
  poster.markModified("formData");
  await poster.save();
  res.json(toPoster(poster));
});

// Removes this user's poster row. The photo and PNG stay on Cloudinary.
posterRouter.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ error: "poster not found" });
    return;
  }

  const poster = await Poster.findOneAndDelete({ _id: id, userId: req.userId });
  if (!poster) {
    res.status(404).json({ error: "poster not found" });
    return;
  }

  res.json({ ok: true });
});
