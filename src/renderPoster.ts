import { v2 as cloudinary } from "cloudinary";

// Sends a PNG, JPEG, or PDF to the same Cloudinary folder as user photos.
function uploadPng(buffer: Buffer, raw = false) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  // A PDF is stored as a raw file. The name stays off .pdf because Cloudinary blocks those public links.
  const options = raw
    ? { folder: "rise-together", resource_type: "raw" as const }
    : { folder: "rise-together" };
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err || !result) reject(err ?? new Error("upload failed"));
      else resolve(result.secure_url);
    });
    stream.end(buffer);
  });
}

// Opens the poster HTML once and returns Cloudinary URLs for the PNG, JPEG, and PDF.
export async function renderPosterPng(html: string) {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600 });
    await page.setContent(html, { waitUntil: "load", timeout: 20000 });
    const clip = { x: 0, y: 0, width: 1200, height: 1600 };
    const png = await page.screenshot({ type: "png", clip });
    const jpg = await page.screenshot({ type: "jpeg", clip, quality: 90 });
    const pdf = await page.pdf({
      width: "1200px",
      height: "1600px",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return {
      png: await uploadPng(Buffer.from(png)),
      jpg: await uploadPng(Buffer.from(jpg)),
      pdf: await uploadPng(Buffer.from(pdf), true),
    };
  } finally {
    await browser.close();
  }
}
