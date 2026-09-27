// Asks Gemini for two poster colors. value is null when the key is missing or the answer is not two hex colors.
const hexColor = /^#[0-9A-Fa-f]{6}$/;

export async function suggestColors(occasion: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { value: null, tokens: null };

  // JSON mode so the reply is colors only, not a paragraph.
  const prompt = `Occasion: ${occasion}. Reply with JSON only: {"backgroundColor":"#RRGGBB","accentColor":"#RRGGBB"} for a Bangladeshi political poster.`;
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
  let parsed: { backgroundColor?: string; accentColor?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    return { value: null, tokens };
  }
  if (!hexColor.test(parsed.backgroundColor ?? "") || !hexColor.test(parsed.accentColor ?? "")) {
    return { value: null, tokens };
  }
  return { value: { backgroundColor: parsed.backgroundColor, accentColor: parsed.accentColor }, tokens };
}
