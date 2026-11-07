// Model parse for comments the fast path left alone. The prompt is the one measured in E-005
// (eval/spike-2026-11-07/system.txt) with the catalog built from the live stall instead of hard-coded.
import { z } from "zod";
import { complete, type Provider } from "../ai/client";
import type { CatalogItem, ParsedComment } from "../domain/types";

const RefSchema = z.object({
  code: z.string().min(1),
  variant: z.string().nullable(),
  qty: z.number().int().positive().nullable(),
});
const RowSchema = z.object({
  i: z.number().int().nonnegative(),
  intent: z.enum(["claim", "cancel", "question", "unclear", "other"]),
  items: z.array(RefSchema),
});
const OutputSchema = z.array(RowSchema);

export function buildSystemPrompt(catalog: CatalogItem[]): string {
  const lines = catalog
    .map((i) => `- ${i.code}: ${i.name} — ${i.variants.length === 1 ? "one variant" : i.variants.map((v) => v.label).join(", ")}`)
    .join("\n");
  return `You parse comments from a live-selling stream into structured claims. You never decide stock, order, prices or payment: code does that. Your only job is to say what each comment literally asks for.

Catalog (code: name — variants):
${lines}

Each comment comes with the item code that was on screen when it was typed.

Rules:
- intent "claim": the commenter explicitly asks to buy or reserve. Claim words include: mine, +1, +N, M2/M3 (= mine 2/3), sold, I want, I'll take, I go take, I want am, for me, reserve, akin, kunin ko, "<variant> pls", "<code> <variant> xN", or joining a waitlist ("I'm next for L").
- If no item code is named, the claim is for the item on screen. If a code is named or the item is named ("the clutch"), use that item.
- variant: map synonyms (medium -> M, large -> L, small -> S). If the commenter names a variant not in the catalog, keep it as written; do not substitute. If no variant is given, use null. Pidgin "am" means "it", never a variant.
- qty: default 1. "2pcs", "x2", "M2", "+2", "2 M" mean 2. Repeating "mine mine mine" is still 1. If the commenter corrects themselves ("L... actually no M"), use only the final choice.
- intent "cancel": the commenter withdraws a claim. qty null means all units of that item/variant; "cancel 1 of my M" means qty 1. If no item or variant is referenced at all, return items [] (code cancels their most recent claim). If they name the item by name, give its code with variant null.
- intent "question": asks about price, stock, material, shipping, sizing, payment, or other items.
- intent "unclear": a bare variant or fragment with no claim word ("red", "L") — code will ask them to clarify. Do not guess a claim.
- intent "other": chatter, greetings, emoji, compliments, complaints with no request.
- Comments may be in English, Nigerian Pidgin, Taglish, or mixed, with emoji and typos.

Output ONLY a JSON array, one object per input comment, in input order:
[{"i": <index>, "intent": "...", "items": [{"code": "A1", "variant": "M" | null, "qty": 1 | null}]}]
No prose, no code fences.`;
}

export interface ModelParseResult {
  parsed: Map<number, ParsedComment>;
  provider: Provider;
  model: string;
  ms: number;
}

/** Parse a batch of comments. Rows the model omits or garbles are absent from the map (caller asks to clarify). */
export async function modelParse(
  catalog: CatalogItem[],
  batch: { i: number; onScreen: string | null; comment: string }[],
  requestId: string,
): Promise<ModelParseResult> {
  const user =
    "Parse these comments:\n" +
    batch.map((b) => JSON.stringify({ i: b.i, on_screen: b.onScreen, comment: b.comment })).join("\n");
  const res = await complete(buildSystemPrompt(catalog), user, requestId);
  const body = res.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    raw = [];
  }
  if (raw && !Array.isArray(raw) && typeof raw === "object") {
    raw = Object.values(raw as Record<string, unknown>).find(Array.isArray) ?? [];
  }
  const rows = OutputSchema.safeParse(raw);
  const parsed = new Map<number, ParsedComment>();
  if (rows.success) {
    for (const r of rows.data) parsed.set(r.i, { intent: r.intent, items: r.items });
  }
  return { parsed, provider: res.provider, model: res.model, ms: res.ms };
}
