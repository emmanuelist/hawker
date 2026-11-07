// Re-runnable parsing eval (claim C-2): the 60 labelled comments from E-005 through the app's own
// pipeline — fast path first, then the model client in batches of 10. Scoring counts only
// commerce-critical errors: wrong intent, or wrong item/variant/qty on a claim or cancel.
// Usage: npm run eval            (reads GROQ_API_KEY / GEMINI_API_KEY from .env)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fastParse } from "../src/lib/parse/fast";
import { modelParse } from "../src/lib/parse/model";
import type { CatalogItem, ParsedComment, ParsedRef } from "../src/lib/domain/types";

try {
  process.loadEnvFile(".env");
} catch {
  /* env may come from the shell */
}

const catalog: CatalogItem[] = [
  { id: 1, code: "A1", name: "Ankara wrap dress", priceCents: 3500, variants: ["S", "M", "L"].map((label, k) => ({ id: 10 + k, label })) },
  { id: 2, code: "A2", name: "Adire two-piece set", priceCents: 4800, variants: ["M", "L", "XL"].map((label, k) => ({ id: 20 + k, label })) },
  { id: 3, code: "A3", name: "Beaded clutch", priceCents: 2200, variants: ["red", "gold", "black"].map((label, k) => ({ id: 30 + k, label })) },
  { id: 4, code: "A4", name: "Headwrap", priceCents: 1200, variants: ["blue", "wine"].map((label, k) => ({ id: 40 + k, label })) },
];

interface Case { onScreen: string; comment: string; intent: ParsedComment["intent"]; items: ParsedRef[] }
const cases: Case[] = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"));

const key = (items: ParsedRef[]) =>
  JSON.stringify(items.map((r) => [r.code.toUpperCase(), r.variant === null ? null : r.variant.toLowerCase(), r.qty]).sort());

function critical(gold: Case, got: ParsedComment | undefined): boolean {
  if (!got || got.intent !== gold.intent) return false;
  if (gold.intent === "claim" || gold.intent === "cancel") return key(got.items) === key(gold.items);
  return true;
}

async function main() {
  const t0 = Date.now();
  const results = new Map<number, { got?: ParsedComment; source: string }>();
  const pending: number[] = [];
  cases.forEach((c, i) => {
    const onScreen = catalog.find((x) => x.code === c.onScreen) ?? null;
    const fast = fastParse(c.comment, onScreen, catalog);
    if (fast) results.set(i, { got: fast, source: "fast" });
    else pending.push(i);
  });
  const providers: Record<string, number> = {};
  for (let s = 0; s < pending.length; s += 10) {
    const batch = pending.slice(s, s + 10).map((i) => ({ i, onScreen: cases[i].onScreen, comment: cases[i].comment }));
    try {
      const r = await modelParse(catalog, batch, `eval-${t0}-${s}`);
      providers[r.provider] = (providers[r.provider] ?? 0) + 1;
      for (const b of batch) results.set(b.i, { got: r.parsed.get(b.i), source: r.provider });
    } catch (e) {
      for (const b of batch) results.set(b.i, { source: `error: ${(e as Error).message.slice(0, 80)}` });
    }
  }
  let ok = 0, phantom = 0, missed = 0;
  const misses: string[] = [];
  cases.forEach((c, i) => {
    const r = results.get(i)!;
    if (critical(c, r.got)) { ok++; return; }
    if (r.got?.intent === "claim" && c.intent !== "claim") phantom++;
    if (c.intent === "claim" && r.got?.intent !== "claim") missed++;
    misses.push(`#${i} [${r.source}] ${JSON.stringify(c.comment)} gold=${c.intent} ${key(c.items)} got=${r.got?.intent ?? "none"} ${r.got ? key(r.got.items) : ""}`);
  });
  const fastCount = [...results.values()].filter((r) => r.source === "fast").length;
  const summary = {
    at: new Date().toISOString(),
    cases: cases.length,
    commerceCriticalCorrect: ok,
    phantomClaims: phantom,
    missedClaims: missed,
    fastPath: fastCount,
    modelBatches: providers,
    seconds: Math.round((Date.now() - t0) / 100) / 10,
  };
  console.log(JSON.stringify(summary, null, 1));
  if (misses.length) console.log(misses.join("\n"));
  mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
  writeFileSync(new URL(`./results/run-${summary.at.replace(/[:.]/g, "-")}.json`, import.meta.url), JSON.stringify({ summary, misses }, null, 1));
  if (phantom > 0) process.exitCode = 1; // a phantom claim is a failure of the product's core rule
}

main();
