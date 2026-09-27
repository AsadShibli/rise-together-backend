import mongoose from "mongoose";

// Account that signs in and owns posters.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: String,
    phone: String,
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true }
);

// A poster layout for one occasion.
const templateSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    occasionType: { type: String, required: true },
    thumbnailUrl: String,
    layoutConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// One poster a user asked the app to make.
const posterSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "Template", required: true },
    formData: { type: mongoose.Schema.Types.Mixed, default: {} },
    uploadedPhotoUrls: { type: [String], default: [] },
    generatedImageUrl: String,
    // JPEG of the same poster. Filled the next time that poster is rendered.
    jpgUrl: String,
    // PDF of the same poster. Filled the next time that poster is rendered.
    pdfUrl: String,
    status: {
      type: String,
      enum: ["draft", "generating", "completed", "failed"],
      default: "draft",
    },
    // How many times regenerate succeeded. The first Save draft image does not count.
    regenerateCount: { type: Number, default: 0 },
    // An admin can stop a poster from being rendered again.
    blocked: { type: Boolean, default: false },
    // An admin can mark a poster for review. Rendering still works.
    flagged: { type: Boolean, default: false },
    // An admin can drop the sample watermark. A normal save cannot set this.
    clean: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One Gemini decoration attempt. tokensUsed is omitted when Gemini did not report a count.
const generationLogSchema = new mongoose.Schema(
  {
    posterId: { type: mongoose.Schema.Types.ObjectId, ref: "Poster", required: true },
    geminiPromptUsed: String,
    tokensUsed: Number,
    latencyMs: Number,
    success: Boolean,
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
export const Template = mongoose.model("Template", templateSchema);
export const Poster = mongoose.model("Poster", posterSchema);
export const GenerationLog = mongoose.model("GenerationLog", generationLogSchema);
