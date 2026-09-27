// Asks Gemini which part of the portrait to keep. The poster still crops from the center until a later step.
const places = new Set(["center", "center top", "center bottom"]);

export async function suggestPhotoPlace(occasion: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { value: null, tokens: null };

  // center top keeps the face and crops the lower part of the photo.
  const prompt = `Occasion: ${occasion}. Reply with JSON only: {"objectPosition":"center top"}. objectPosition must be one of: center, center top, center bottom.`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) return { value: null, tokens: null };

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { totalTokenCount?: unknown };
  };
  // Missing usage is left empty. A zero here would be a made-up count.
  const tokens = typeof data.usageMetadata?.totalTokenCount === "number" ? data.usageMetadata.totalTokenCount : null;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  let parsed: { objectPosition?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    return { value: null, tokens };
  }
  const place = parsed.objectPosition ?? "";
  if (!places.has(place)) return { value: null, tokens };
  return { value: place, tokens };
}
