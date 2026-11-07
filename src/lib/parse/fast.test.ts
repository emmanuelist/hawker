import { describe, expect, test } from "vitest";
import { fastParse } from "./fast";
import type { CatalogItem } from "../domain/types";

const catalog: CatalogItem[] = [
  { id: 1, code: "A1", name: "Ankara wrap dress", priceCents: 3500, variants: [{ id: 11, label: "S" }, { id: 12, label: "M" }, { id: 13, label: "L" }] },
  { id: 3, code: "A3", name: "Beaded clutch", priceCents: 2200, variants: [{ id: 31, label: "red" }, { id: 32, label: "gold" }, { id: 33, label: "black" }] },
  { id: 4, code: "A4", name: "Headwrap", priceCents: 1200, variants: [{ id: 41, label: "blue" }, { id: 42, label: "wine" }] },
];
const A3 = catalog[1];
const A1 = catalog[0];

describe("fastParse claims", () => {
  test.each([
    ["mine red", A3, { code: "A3", variant: "red", qty: 1 }],
    ["Mine!!! 🔥", A3, { code: "A3", variant: null, qty: 1 }],
    ["+1 black", A3, { code: "A3", variant: "black", qty: 1 }],
    ["M2 gold", A3, { code: "A3", variant: "gold", qty: 2 }],
    ["mine po red", A3, { code: "A3", variant: "red", qty: 1 }],
    ["mine mine mine", A3, { code: "A3", variant: null, qty: 1 }],
    ["mine A1 M", A3, { code: "A1", variant: "M", qty: 1 }],
    ["A4 wine x2", A3, { code: "A4", variant: "wine", qty: 2 }],
    ["sold! red", A3, { code: "A3", variant: "red", qty: 1 }],
    ["mine medium", A1, { code: "A1", variant: "M", qty: 1 }],
    ["+2 S", A1, { code: "A1", variant: "S", qty: 2 }],
    ["Mine A3 gold", A1, { code: "A3", variant: "gold", qty: 1 }],
    ["M pls", A1, { code: "A1", variant: "M", qty: 1 }],
    ["large for me", A1, { code: "A1", variant: "L", qty: 1 }],
    ["gold abeg", A3, { code: "A3", variant: "gold", qty: 1 }],
    // Taglish: "yung" / "ung" is "the" (found on the deployed stall, E-030: the model dropped the size)
    ["akin yung a1 m po", A3, { code: "A1", variant: "M", qty: 1 }],
    ["akin yung black", A3, { code: "A3", variant: "black", qty: 1 }],
    ["akin ung gold po", A3, { code: "A3", variant: "gold", qty: 1 }],
  ])("%s", (text, onScreen, ref) => {
    expect(fastParse(text, onScreen, catalog)).toEqual({ intent: "claim", items: [ref] });
  });
});

describe("fastParse defers anything uncertain to the model (never guesses a claim)", () => {
  test.each([
    "gold one for me abeg", // "one" is not a known token
    "I go take 2 black",
    "how much be this one?",
    "sis mine 1 gold and 1 black",
    "mine L... actually no M",
    "I want am",
    "someone cancel? I'm next for L",
    "is A2 coming back on?",
  ])("%s → null", (text) => {
    expect(fastParse(text, A3, catalog)).toBeNull();
  });
});

describe("fastParse non-claims", () => {
  test("bare variant is unclear, never a claim", () => {
    expect(fastParse("red", A3, catalog)).toEqual({ intent: "unclear", items: [] });
    expect(fastParse("L", A1, catalog)).toEqual({ intent: "unclear", items: [] });
  });
  test("politeness alone ('red po') does not make a claim", () => {
    expect(fastParse("red po", A3, catalog)).toEqual({ intent: "unclear", items: [] });
  });
  test("bare cancel", () => {
    expect(fastParse("cancel", A3, catalog)).toEqual({ intent: "cancel", items: [] });
  });
  test("emoji only is chatter", () => {
    expect(fastParse("😍😍😍", A3, catalog)).toEqual({ intent: "other", items: [] });
  });
  test("a variant of a different item than the named code is not guessed", () => {
    expect(fastParse("mine A1 gold", A3, catalog)).toBeNull();
  });
  test("two quantities is not guessed", () => {
    expect(fastParse("+2 x3 red", A3, catalog)).toBeNull();
  });
});

// One-tap claims from the stall post canonical comments. An earlier item is named by its code, so
// the claim must land on that item, never on the one on screen; a variant the named item doesn't
// have must go to the model rather than become a claim.
describe("fastParse reads the stall's tapped claims", () => {
  const A5 = { id: 5, code: "A5", name: "Aso-oke stole", priceCents: 4000, variants: [{ id: 51, label: "one size" }] };
  const withA5 = [...catalog, A5];
  test.each([
    ["mine gold", A3, { code: "A3", variant: "gold", qty: 1 }], // the item on screen
    ["mine a4 wine", A3, { code: "A4", variant: "wine", qty: 1 }], // an earlier item, by code
    ["mine a1 m", A3, { code: "A1", variant: "M", qty: 1 }],
    ["mine a5", A3, { code: "A5", variant: null, qty: 1 }], // a single-variant earlier item
    ["mine", A5, { code: "A5", variant: null, qty: 1 }], // a single-variant item on screen
  ])("%s", (text, onScreen, ref) => {
    expect(fastParse(text, onScreen, withA5)).toEqual({ intent: "claim", items: [ref] });
  });
  test("a variant the named item doesn't have defers to the model", () => {
    expect(fastParse("mine a4 gold", A3, withA5)).toBeNull();
  });
});

// The stall's Release button posts "cancel <code> <variant>"; it must cancel that hold and nothing else.
describe("fastParse reads a named cancel", () => {
  test.each([
    ["cancel a4 wine", A3, { code: "A4", variant: "wine", qty: null }],
    ["cancel my gold", A3, { code: "A3", variant: "gold", qty: null }],
    ["cancel my red", A3, { code: "A3", variant: "red", qty: null }], // was deferred to the model before named cancels
    ["cancel a1", A3, { code: "A1", variant: null, qty: null }],
  ])("%s", (text, onScreen, ref) => {
    expect(fastParse(text, onScreen, catalog)).toEqual({ intent: "cancel", items: [ref] });
  });
  test.each(["cancel a4 gold", "cancel the red one abeg", "cancel pls"])("defers %s to the model", (text) => {
    expect(fastParse(text, A3, catalog)).toBeNull();
  });
  test("a bare cancel still cancels the latest hold", () => {
    expect(fastParse("cancel", A3, catalog)).toEqual({ intent: "cancel", items: [] });
  });
});

describe("fastParse: Taglish 'yung' is filler, never a claim by itself", () => {
  test("no claim word, so no claim", () => {
    const r = fastParse("yung a1 m", A3, catalog);
    expect(r === null || r.intent !== "claim").toBe(true);
  });
  test("a bare 'yung black' asks what they meant rather than holding", () => {
    expect(fastParse("yung black", A3, catalog)).toEqual({ intent: "unclear", items: [] });
  });
});
