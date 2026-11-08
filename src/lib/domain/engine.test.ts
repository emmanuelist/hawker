import { describe, expect, test } from "vitest";
import { centsToValue, decideClaim, decideEnding, nextInLine, resolveRef, strandedInLine } from "./engine";
import type { CatalogItem } from "./types";

const catalog: CatalogItem[] = [
  { id: 1, code: "A1", name: "Ankara wrap dress", priceCents: 3500, variants: [{ id: 11, label: "S" }, { id: 12, label: "M" }, { id: 13, label: "L" }] },
  { id: 3, code: "A3", name: "Beaded clutch", priceCents: 2200, variants: [{ id: 31, label: "red" }, { id: 32, label: "gold" }, { id: 33, label: "black" }] },
  { id: 5, code: "A5", name: "Aso-oke stole", priceCents: 4000, variants: [{ id: 51, label: "one size" }] },
];

describe("resolveRef", () => {
  test("exact variant resolves", () => {
    expect(resolveRef(catalog, { code: "A3", variant: "gold", qty: null })).toMatchObject({ ok: true, variantId: 32, qty: 1 });
  });
  test("synonyms map (medium → M) and case is ignored", () => {
    expect(resolveRef(catalog, { code: "a1", variant: "Medium", qty: 2 })).toMatchObject({ ok: true, variantId: 12, qty: 2 });
  });
  test("single-variant item needs no variant", () => {
    expect(resolveRef(catalog, { code: "A5", variant: null, qty: null })).toMatchObject({ ok: true, variantId: 51 });
  });
  test("multi-variant item without a variant asks which", () => {
    expect(resolveRef(catalog, { code: "A3", variant: null, qty: null })).toEqual({
      ok: false,
      reason: { kind: "which_variant", code: "A3", options: ["red", "gold", "black"] },
    });
  });
  test("a variant the item doesn't have is kept as asked and refused, never substituted", () => {
    expect(resolveRef(catalog, { code: "A1", variant: "XL", qty: 1 })).toEqual({
      ok: false,
      reason: { kind: "variant_unavailable", code: "A1", asked: "XL", options: ["S", "M", "L"] },
    });
  });
  test("a model mishearing ('am' from Pidgin 'I want am') is refused, not held", () => {
    expect(resolveRef(catalog, { code: "A1", variant: "am", qty: 1 }).ok).toBe(false);
  });
  test("unknown item code", () => {
    expect(resolveRef(catalog, { code: "Z9", variant: null, qty: null })).toEqual({ ok: false, reason: { kind: "unknown_item", code: "Z9" } });
  });
});

describe("decideClaim", () => {
  test("holds when the whole quantity is available and nobody is waiting", () => {
    expect(decideClaim({ available: 2, qty: 2, buyerAlreadyActiveOnVariant: false, waitingAhead: 0, sellable: 5 })).toBe("hold");
  });
  test("waits rather than holding part of a quantity", () => {
    expect(decideClaim({ available: 1, qty: 2, buyerAlreadyActiveOnVariant: false, waitingAhead: 0, sellable: 5 })).toBe("wait");
  });
  test("a newcomer never jumps people already waiting, even if stock frees up", () => {
    expect(decideClaim({ available: 1, qty: 1, buyerAlreadyActiveOnVariant: false, waitingAhead: 1, sellable: 5 })).toBe("wait");
  });
  test("a second claim by the same buyer on the same variant is a duplicate", () => {
    expect(decideClaim({ available: 3, qty: 1, buyerAlreadyActiveOnVariant: true, waitingAhead: 0, sellable: 5 })).toBe("duplicate");
  });
  test("held but not paid for waits: a held unit can still come back", () => {
    expect(decideClaim({ available: 0, qty: 1, buyerAlreadyActiveOnVariant: false, waitingAhead: 0, sellable: 1 })).toBe("wait");
  });
  test("every unit paid for is sold, not a place in a line that can never move", () => {
    expect(decideClaim({ available: 0, qty: 1, buyerAlreadyActiveOnVariant: false, waitingAhead: 0, sellable: 0 })).toBe("sold");
  });
  test("asking for more than can ever be sold is sold, even with stock free now", () => {
    expect(decideClaim({ available: 1, qty: 2, buyerAlreadyActiveOnVariant: false, waitingAhead: 0, sellable: 1 })).toBe("sold");
  });
  test("a buyer already in line or holding is told so before anything else", () => {
    expect(decideClaim({ available: 0, qty: 1, buyerAlreadyActiveOnVariant: true, waitingAhead: 0, sellable: 0 })).toBe("duplicate");
  });
});

describe("strandedInLine", () => {
  const line = [{ id: "a", qty: 1 }, { id: "b", qty: 2 }, { id: "c", qty: 1 }];
  test("when the last unit is paid for, every place in line ends", () => {
    expect(strandedInLine(line, 0).map((w) => w.id)).toEqual(["a", "b", "c"]);
  });
  test("only places asking for more than can still be sold end; the rest keep their turn", () => {
    expect(strandedInLine(line, 1).map((w) => w.id)).toEqual(["b"]);
  });
  test("nobody ends while every request can still be met", () => {
    expect(strandedInLine(line, 2)).toEqual([]);
  });
});

describe("decideEnding (B1)", () => {
  test("PAID is never passed — covers the pay-in-the-last-second race", () => {
    expect(decideEnding("PAID")).toBe("paid");
  });
  test.each(["UNPAID", "SENT", "PAYMENT_PENDING", "PARTIALLY_PAID", "CANCELLED", ""])("%s passes", (s) => {
    expect(decideEnding(s)).toBe("pass");
  });
});

describe("nextInLine", () => {
  test("promotes the earliest waiter", () => {
    expect(nextInLine([{ id: "b", qty: 1, seq: 9 }, { id: "a", qty: 1, seq: 4 }], 1)).toMatchObject({ id: "a" });
  });
  test("strict FIFO: if the head doesn't fit, nobody behind it jumps", () => {
    expect(nextInLine([{ id: "a", qty: 2, seq: 1 }, { id: "b", qty: 1, seq: 2 }], 1)).toBeNull();
  });
  test("empty line", () => {
    expect(nextInLine([], 3)).toBeNull();
  });
});

describe("centsToValue", () => {
  test.each([[2200, "22.00"], [5, "0.05"], [4805, "48.05"], [0, "0.00"]])("%i → %s", (c, v) => {
    expect(centsToValue(c)).toBe(v);
  });
  test("rejects fractional or negative cents", () => {
    expect(() => centsToValue(22.5)).toThrow();
    expect(() => centsToValue(-1)).toThrow();
  });
});
