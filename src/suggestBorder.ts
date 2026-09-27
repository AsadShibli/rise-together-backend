// Asks Gemini for a poster frame. The page is not drawn with this answer until a later step.
const borders = new Set(["none", "thin", "thick"]);

export async function suggestBorder(occasion: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { value: null, tokens: null };

  // thin is a narrow white frame. thick is a wide one. none leaves the page plain.
  const prompt = `Occasion: ${occasion}. Reply with JSON only: {"border":"thin"}. border must be one of: none, thin, thick.`;
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
  let parsed: { border?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    return { value: null, tokens };
  }
  const border = parsed.border ?? "";
  if (!borders.has(border)) return { value: null, tokens };
  return { value: border, tokens };
}
