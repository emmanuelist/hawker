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
    "cancel my red",
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
