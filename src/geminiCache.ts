import { suggestBorder } from "./suggestBorder";
import { suggestColors } from "./suggestColors";
import { suggestPattern } from "./suggestPattern";
import { suggestPhotoPlace } from "./suggestPhoto";

// One saved decoration for an occasion. Cleared when the server restarts.
type Decoration = {
  colors: { backgroundColor: string; accentColor: string } | null;
  objectPosition: string | null;
  border: string | null;
  pattern: string | null;
};

const saved = new Map<string, Decoration>();

// Adds only counts Gemini actually sent. An empty list means the count stays unset.
function sumTokens(parts: Array<number | null>) {
  const known = parts.filter((count): count is number => typeof count === "number");
  if (known.length === 0) return undefined;
  return known.reduce((total, count) => total + count, 0);
}

// Asks Gemini once per occasion. The next poster reuses these answers and reports 0 new tokens.
export async function decorationFor(occasion: string) {
  const cached = saved.get(occasion);
  if (cached) return { decoration: cached, tokensUsed: 0 };

  const colors = await suggestColors(occasion);
  const objectPosition = await suggestPhotoPlace(occasion);
  const border = await suggestBorder(occasion);
  const pattern = await suggestPattern(occasion);
  const decoration = {
    colors: colors.value,
    objectPosition: objectPosition.value,
    border: border.value,
    pattern: pattern.value,
  };
  // A total miss is not saved, so a quota failure can be tried again later.
  if (decoration.colors || decoration.objectPosition || decoration.border || decoration.pattern) {
    saved.set(occasion, decoration);
  }
  return {
    decoration,
    tokensUsed: sumTokens([colors.tokens, objectPosition.tokens, border.tokens, pattern.tokens]),
  };
}
