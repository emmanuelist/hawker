// Shared domain vocabulary. The four hold states are the product's only states (D-005).
export const HOLD_STATES = ["Waiting", "Holding", "Paid", "Passed"] as const;
export type HoldState = (typeof HOLD_STATES)[number];

export type Intent = "claim" | "cancel" | "question" | "unclear" | "other";

/** One item reference as the parser understood it. `variant`/`qty` null = not stated. */
export interface ParsedRef {
  code: string;
  variant: string | null;
  qty: number | null;
}

export interface ParsedComment {
  intent: Intent;
  items: ParsedRef[];
}

export interface CatalogVariant {
  id: number;
  label: string;
}

export interface CatalogItem {
  id: number;
  code: string;
  name: string;
  priceCents: number;
  variants: CatalogVariant[];
}

/** Why a reference could not become a hold; each maps to a clarifying reply. */
export type ClarifyReason =
  | { kind: "unknown_item"; code: string }
  | { kind: "which_variant"; code: string; options: string[] }
  | { kind: "variant_unavailable"; code: string; asked: string; options: string[] };
