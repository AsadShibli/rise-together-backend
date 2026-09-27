// Asks Gemini for a background pattern. The page stays a flat color until a later step.
const patterns = new Set(["none", "stripes", "dots"]);

export async function suggestPattern(occasion: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { value: null, tokens: null };

  // stripes is a few light bands. dots is a light dot grid. none keeps the flat color.
  const prompt = `Occasion: ${occasion}. Reply with JSON only: {"pattern":"stripes"}. pattern must be one of: none, stripes, dots.`;
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
  let parsed: { pattern?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    return { value: null, tokens };
  }
  const pattern = parsed.pattern ?? "";
  if (!patterns.has(pattern)) return { value: null, tokens };
  return { value: pattern, tokens };
}
