import mongoose from "mongoose";
import { Router } from "express";
import { GenerationLog, Poster, Template } from "./models";
import { requireAdmin } from "./auth";

const hex = /^#[0-9A-Fa-f]{6}$/;

// Admin template writes. The public list only shows active templates.
export const adminRouter = Router();

adminRouter.post("/templates", requireAdmin, async (req, res) => {
  const body = req.body as {
    title?: unknown;
    occasionType?: unknown;
    photoSlots?: unknown;
    colors?: unknown;
    isActive?: unknown;
  };
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const occasionType = typeof body.occasionType === "string" ? body.occasionType.trim() : "";
  if (!title || !occasionType) {
    res.status(400).json({ error: "title and occasion are required" });
    return;
  }

  const photoSlots = body.photoSlots === undefined ? 1 : body.photoSlots;
  const colors = body.colors === undefined ? ["#006A4E", "#F42A41"] : body.colors;
  const slotsOk = photoSlots === 1 || photoSlots === 2 || photoSlots === 3;
  const colorsOk =
    Array.isArray(colors) && colors.length === 2 && colors.every((color) => typeof color === "string" && hex.test(color));
  if (!slotsOk || !colorsOk) {
    res.status(400).json({ error: "photoSlots must be 1 to 3 and colors must be two hex values" });
    return;
  }

  const template = await Template.create({
    title,
    occasionType,
    thumbnailUrl: "",
    isActive: typeof body.isActive === "boolean" ? body.isActive : true,
    layoutConfig: { colors, photoSlots, textSlots: ["headline", "footer"] },
  });
  res.status(201).json({
    id: template.id,
    title: template.title,
    occasionType: template.occasionType,
    isActive: template.isActive,
    layoutConfig: template.layoutConfig,
  });
});

// Changes the title or hides the template. Other fields stay as they were.
adminRouter.patch("/templates/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ error: "template not found" });
    return;
  }

  const template = await Template.findById(id);
  if (!template) {
    res.status(404).json({ error: "template not found" });
    return;
  }

  const body = req.body as { title?: unknown; isActive?: unknown };
  if (typeof body.title === "string" && body.title.trim()) template.title = body.title.trim();
  if (typeof body.isActive === "boolean") template.isActive = body.isActive;
  await template.save();
  res.json({ id: template.id, title: template.title, isActive: template.isActive });
});

// Removes one template. The public list never included a hidden one.
adminRouter.delete("/templates/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ error: "template not found" });
    return;
  }

  const template = await Template.findByIdAndDelete(id);
  if (!template) {
    res.status(404).json({ error: "template not found" });
    return;
  }
  res.json({ ok: true });
});

// Flagged posters come first. Inside each group, the newest poster comes first.
adminRouter.get("/posters", requireAdmin, async (_req, res) => {
  const rows = await Poster.find().sort({ flagged: -1, createdAt: -1 });
  res.json(
    rows.map((row) => ({
      id: row.id,
      status: row.status,
      userId: String(row.userId),
      formData: row.formData,
      blocked: row.blocked === true,
      flagged: row.flagged === true,
      clean: row.clean === true,
    }))
  );
});

// Stops or allows another render. The saved image stays either way.
adminRouter.patch("/posters/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ error: "poster not found" });
    return;
  }

  const poster = await Poster.findById(id);
  if (!poster) {
    res.status(404).json({ error: "poster not found" });
    return;
  }

  const body = req.body as { blocked?: unknown; flagged?: unknown; clean?: unknown };
  if (typeof body.blocked === "boolean") poster.blocked = body.blocked;
  if (typeof body.flagged === "boolean") poster.flagged = body.flagged;
  if (typeof body.clean === "boolean") poster.clean = body.clean;
  await poster.save();
  res.json({
    id: poster.id,
    blocked: poster.blocked === true,
    flagged: poster.flagged === true,
    clean: poster.clean === true,
  });
});

// How many posters and templates exist, plus the newest Gemini attempt.
adminRouter.get("/usage", requireAdmin, async (_req, res) => {
  const [posters, blocked, flagged, templates, last] = await Promise.all([
    Poster.countDocuments(),
    Poster.countDocuments({ blocked: true }),
    Poster.countDocuments({ flagged: true }),
    Template.countDocuments(),
    GenerationLog.findOne().sort({ createdAt: -1 }),
  ]);
  res.json({
    posters,
    blocked,
    flagged,
    templates,
    // Null when no decoration has been logged yet. A missing token count stays null.
    lastLog: last
      ? {
          geminiPromptUsed: last.geminiPromptUsed ?? "",
          tokensUsed: typeof last.tokensUsed === "number" ? last.tokensUsed : null,
          latencyMs: last.latencyMs ?? 0,
          success: last.success === true,
        }
      : null,
  });
});

// Includes hidden templates so an admin can show or delete them.
adminRouter.get("/templates", requireAdmin, async (_req, res) => {
  const rows = await Template.find().sort({ title: 1 });
  res.json(
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      occasionType: row.occasionType,
      isActive: row.isActive,
    }))
  );
});
