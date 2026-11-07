import { describe, expect, test } from "vitest";
import type { LedgerRow } from "@/lib/service/ledger";
import { ledgerTotals } from "./totals";

const row = (serial: number, state: LedgerRow["state"], code: string, buyer: string, amountUsd: number, paypalTxn: string | null = null): LedgerRow => ({
  copy: `No. ${String(serial).padStart(4, "0")}`, serial, state, ending: state, buyer, item: code, code, variant: "M", qty: 1, amountUsd, paidUsd: state === "Paid" ? amountUsd : 0, passedUsd: state === "Passed" ? amountUsd : 0,
  paid: state === "Paid" ? 1 : 0, passed: state === "Passed" ? 1 : 0, open: state === "Holding" || state === "Waiting" ? 1 : 0,
  passedTo: null, endReason: null, invoiceId: null, invoiceStatus: null, paypalTxn, said: "mine", via: "typed", readBy: "fast", claimedAt: "2026-11-07T12:00:00Z", endedAt: null,
});

describe("ledger_totals", () => {
  const rows = [row(4, "Paid", "A3", "@kemi", 22, "TXN1"), row(3, "Passed", "A3", "@kemi", 44), row(2, "Passed", "A2", "@tobi", 48), row(5, "Holding", "A2", "@ife", 48)];
  const t = ledgerTotals(rows);
  test("overall copies and amounts, in exact cents", () => {
    expect(t.total).toEqual({ copies: 4, paid: 1, passed: 2, open: 1, paidUsd: "22.00", passedUsd: "92.00" });
  });
  test("by item and by buyer", () => {
    expect(t.byItem.A2).toMatchObject({ copies: 2, passed: 1, open: 1, passedUsd: "48.00" });
    expect(t.byBuyer["@kemi"]).toMatchObject({ paid: 1, passed: 1, paidUsd: "22.00", passedUsd: "44.00" });
  });
  test("the latest paid copy, and no ending outside the four states", () => {
    expect(t.latestPaid).toEqual({ copy: "No. 0004", buyer: "@kemi", paypalTxn: "TXN1" });
    expect(t.otherEndings).toBe(0);
  });
  test("cents never drift: 0.10 + 0.20 sums to 0.30", () => {
    const t2 = ledgerTotals([row(1, "Paid", "A1", "@a", 0.1), row(2, "Paid", "A1", "@b", 0.2)]);
    expect(t2.total?.paidUsd).toBe("0.30");
  });
  test("an empty ledger has no totals", () => {
    expect(ledgerTotals([]).total).toBeNull();
  });
});
