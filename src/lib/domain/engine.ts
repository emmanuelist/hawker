// Pure decision rules. No I/O: the service layer applies these inside a database transaction.
// The claim (D-005): every hold ends Paid (PayPal says PAID) or Passed (expired/cancelled → next buyer).
import type { CatalogItem, ClarifyReason, ParsedRef } from "./types";

const SYNONYMS: Record<string, string> = {
  small: "s",
  medium: "m",
  med: "m",
  large: "l",
  "extra large": "xl",
  xlarge: "xl",
};

const norm = (s: string) => s.trim().toLowerCase();

/** Map a parsed reference to exactly one catalog variant, or say why it can't be. */
export function resolveRef(
  catalog: CatalogItem[],
  ref: ParsedRef,
): { ok: true; item: CatalogItem; variantId: number; qty: number } | { ok: false; reason: ClarifyReason } {
  const item = catalog.find((i) => norm(i.code) === norm(ref.code));
  if (!item) return { ok: false, reason: { kind: "unknown_item", code: ref.code } };
  const options = item.variants.map((v) => v.label);
  const qty = ref.qty ?? 1;
  if (ref.variant === null) {
    if (item.variants.length === 1) return { ok: true, item, variantId: item.variants[0].id, qty };
    return { ok: false, reason: { kind: "which_variant", code: item.code, options } };
  }
  const asked = norm(ref.variant);
  const wanted = SYNONYMS[asked] ?? asked;
  const v = item.variants.find((x) => norm(x.label) === wanted);
  if (!v) return { ok: false, reason: { kind: "variant_unavailable", code: item.code, asked: ref.variant, options } };
  return { ok: true, item, variantId: v.id, qty };
}

/**
 * A new claim on a variant. `available` is stock minus units already Holding or Paid.
 * Strictly whole-quantity: a claim never holds part of what was asked (no partial holds).
 */
export function decideClaim(input: {
  available: number;
  qty: number;
  buyerAlreadyActiveOnVariant: boolean;
  waitingAhead: number;
  /** Units that can still be sold: stock minus units already Paid. Paid is final (D-020), so they never come back. */
  sellable: number;
}): "hold" | "wait" | "duplicate" | "sold" {
  if (input.buyerAlreadyActiveOnVariant) return "duplicate";
  // A place in line for more than can ever be sold would wait forever, an ending that is neither Paid nor Passed.
  if (input.qty > input.sellable) return "sold";
  // Arrival order is the rule: if anyone is already waiting, a newcomer queues behind them.
  if (input.waitingAhead > 0) return "wait";
  return input.qty <= input.available ? "hold" : "wait";
}

/**
 * B1: a Holding hold reaching its deadline (or being cancelled) is resolved from PayPal's status.
 * PAID is never passed. Anything else is cancelled and passed on.
 */
export function decideEnding(paypalStatus: string): "paid" | "pass" {
  return paypalStatus === "PAID" ? "paid" : "pass";
}

/**
 * After a sale, the places in line that can never be served: each asks for more than can still be sold.
 * They end Passed (reason "sold") rather than wait forever (the thesis: every copy ends Paid or Passed).
 */
export function strandedInLine<T extends { qty: number }>(waiting: T[], sellable: number): T[] {
  return waiting.filter((w) => w.qty > sellable);
}

/** Strict FIFO: only the head of the line is promoted, and only if its whole quantity fits. */
export function nextInLine<T extends { qty: number; seq: number }>(waiting: T[], available: number): T | null {
  if (waiting.length === 0) return null;
  const head = [...waiting].sort((a, b) => a.seq - b.seq)[0];
  return head.qty <= available ? head : null;
}

/** The PayPal boundary takes decimal strings; the app keeps integer cents (AGENTS.md money rule). */
export function centsToValue(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new Error(`invalid cents: ${cents}`);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
