import "dotenv/config";
import express from "express";
import { connectDb } from "./db";
import "./models";
import { authRouter } from "./auth";
import { templateRouter } from "./templates";
import { uploadRouter } from "./upload";
import { posterRouter } from "./posters";
import { adminRouter } from "./admin";

// API server. Listens only after MongoDB connects.
const app = express();
const port = Number(process.env.PORT) || 4000;

// Browser origin that may call this API. Localhost when CORS_ORIGIN is unset.
const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  // PATCH saves poster text. DELETE removes one poster.
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/templates", templateRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/posters", posterRouter);
app.use("/api/admin", adminRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on http://localhost:${port}`);
    });
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
