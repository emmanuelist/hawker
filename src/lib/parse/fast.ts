// Fast path: strict, deterministic parsing of the common shapes ("mine gold", "+2 black", "M2 gold",
// "A4 wine x2", "cancel", "red"). Anything it isn't certain about returns null and goes to the model.
// It must never produce a claim the model wouldn't (no phantom claims): when in doubt, null.
import type { CatalogItem, ParsedComment } from "../domain/types";

const CLAIM_WORDS = new Set(["mine", "sold", "akin", "+"]);
// "yung" / "ung" is Taglish for "the" ("akin yung black"); like the rest, it never makes a claim on its own.
const FILLER = new Set(["pls", "please", "plz", "abeg", "po", "o", "for", "me", "sis", "ma", "sir", "biko", "oo", "yung", "ung"]);
// Words that turn a bare variant into a request: "M pls", "large for me", "gold abeg".
const REQUEST = new Set(["pls", "please", "plz", "abeg", "biko"]);
const SYNONYMS: Record<string, string> = { small: "s", medium: "m", med: "m", large: "l" };
// Strip emoji and symbols that carry no claim meaning; keep letters, digits, + and spaces.
const clean = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+\s.]/gu, " ")
    .replace(/\.+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function fastParse(text: string, onScreen: CatalogItem | null, catalog: CatalogItem[]): ParsedComment | null {
  const s = clean(text);
  if (!s) return { intent: "other", items: [] };

  if (/^(cancel|nevermind|never mind)$/.test(s)) return { intent: "cancel", items: [] };
  // "cancel a2 m" / "cancel my gold": cancel one named hold (the stall's Release button posts this).
  const named = s.match(/^cancel(?: my)? (.+)$/);
  if (named) return fastCancel(named[1].split(" "), onScreen, catalog);

  const tokens = s.split(" ");
  let claimWord = false;
  let qty: number | null = null;
  let code: string | null = null;
  let variant: string | null = null;
  let request = false;

  for (const t of tokens) {
    if (CLAIM_WORDS.has(t)) {
      if (claimWord) continue; // "mine mine mine" is still one claim of 1
      claimWord = true;
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^\+(\d{1,2})$/))) {
      if (claimWord || qty !== null) return null;
      claimWord = true;
      qty = Number(m[1]);
      continue;
    }
    if ((m = t.match(/^m(\d)$/))) {
      // "M2" = mine 2 — but "m" alone is a size, handled below
      if (claimWord || qty !== null) return null;
      claimWord = true;
      qty = Number(m[1]);
      continue;
    }
    if ((m = t.match(/^x(\d{1,2})$/))) {
      if (qty !== null) return null;
      qty = Number(m[1]);
      continue;
    }
    const asCode = catalog.find((i) => i.code.toLowerCase() === t);
    if (asCode) {
      if (code) return null;
      code = asCode.code;
      continue;
    }
    if (FILLER.has(t)) {
      if (REQUEST.has(t) || (t === "me" && tokens.includes("for"))) request = true;
      continue;
    }
    const target = code ? catalog.find((i) => i.code === code) : onScreen;
    const asVariant = target?.variants.find((v) => v.label.toLowerCase() === (SYNONYMS[t] ?? t));
    if (asVariant) {
      if (variant) return null; // two variants in one comment → let the model split it
      variant = asVariant.label;
      continue;
    }
    return null; // a word we don't know: the model reads it
  }

  // "<variant> pls" / "<variant> for me" asks for the on-screen item in that variant.
  if (!claimWord && request && variant && !code && qty === null && onScreen) return { intent: "claim", items: [{ code: onScreen.code, variant, qty: 1 }] };
  // The explicit order format "<code> <variant> xN" is a claim without a claim word.
  if (!claimWord && code && variant && qty !== null) return { intent: "claim", items: [{ code, variant, qty }] };
  // A bare variant with no claim word ("red", "L") holds nothing: ask what they meant.
  if (!claimWord) return variant && !code && qty === null ? { intent: "unclear", items: [] } : null;
  const itemCode = code ?? onScreen?.code;
  if (!itemCode) return null;
  // If a variant was read against the on-screen item but the code names another item, re-check it.
  if (code && variant && !catalog.find((i) => i.code === code)?.variants.some((v) => v.label === variant)) return null;
  return { intent: "claim", items: [{ code: itemCode, variant, qty: qty ?? 1 }] };
}

function fastCancel(tokens: string[], onScreen: CatalogItem | null, catalog: CatalogItem[]): ParsedComment | null {
  let code: string | null = null;
  let variant: string | null = null;
  for (const t of tokens) {
    const asCode = catalog.find((i) => i.code.toLowerCase() === t);
    if (asCode && !code) {
      code = asCode.code;
      continue;
    }
    const target = code ? catalog.find((i) => i.code === code) : onScreen;
    const asVariant = target?.variants.find((v) => v.label.toLowerCase() === (SYNONYMS[t] ?? t));
    if (asVariant && !variant) {
      variant = asVariant.label;
      continue;
    }
    return null; // anything else ("cancel the red one abeg"): the model reads it
  }
  const itemCode = code ?? onScreen?.code ?? null;
  if (!itemCode || (!code && !variant)) return null;
  // A cancel names a hold, not a quantity: qty is "not stated", as the model and the eval's gold read it.
  return { intent: "cancel", items: [{ code: itemCode, variant, qty: null }] };
}
