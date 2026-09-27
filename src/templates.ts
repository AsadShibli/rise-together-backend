import mongoose from "mongoose";
import { Router } from "express";
import { Template } from "./models";

const fields = "title occasionType thumbnailUrl layoutConfig isActive";

// Same shape for the list and the single-template route.
function toTemplate(row: {
  id: string;
  title: string;
  occasionType: string;
  thumbnailUrl?: string | null;
  layoutConfig?: unknown;
  isActive: boolean;
}) {
  return {
    id: row.id,
    title: row.title,
    occasionType: row.occasionType,
    thumbnailUrl: row.thumbnailUrl,
    layoutConfig: row.layoutConfig,
    isActive: row.isActive,
  };
}

// Public list of active poster layouts. Optional filter: ?occasion=
export const templateRouter = Router();

templateRouter.get("/", async (req, res) => {
  const occasion = typeof req.query.occasion === "string" ? req.query.occasion : "";
  const filter: { isActive: boolean; occasionType?: string } = { isActive: true };
  if (occasion) filter.occasionType = occasion;

  const rows = await Template.find(filter).select(fields);
  res.json(rows.map((row) => toTemplate(row)));
});

templateRouter.get("/:id", async (req, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ error: "template not found" });
    return;
  }

  const row = await Template.findOne({ _id: id, isActive: true }).select(fields);
  if (!row) {
    res.status(404).json({ error: "template not found" });
    return;
  }
  res.json(toTemplate(row));
});
