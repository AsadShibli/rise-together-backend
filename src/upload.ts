import { Router } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "./auth";

// One image in memory, then sent to Cloudinary. Field name: photo.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadRouter = Router();

uploadRouter.post("/", requireAuth, upload.single("photo"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "photo is required" });
    return;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const stream = cloudinary.uploader.upload_stream({ folder: "rise-together" }, (err, result) => {
    if (err || !result) {
      res.status(500).json({ error: "upload failed" });
      return;
    }
    res.json({ url: result.secure_url });
  });
  stream.end(req.file.buffer);
});
