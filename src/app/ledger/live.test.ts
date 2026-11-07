import { describe, expect, test } from "vitest";
import type { LedgerRow } from "@/lib/service/ledger";
import { copyOfRowId, diffRows, freshness, markFresh } from "./live";

const row = (serial: number, state: LedgerRow["state"]) => ({ copy: `No. ${String(serial).padStart(4, "0")}`, state }) as LedgerRow;

describe("ledger motion: what changed between two reads", () => {
  test("the first read marks nothing, so nothing animates on load", () => {
    expect(diffRows(null, [row(1, "Paid"), row(2, "Holding")])).toEqual([]);
  });
  test("a new copy is new; a copy that just ended is Paid or Passed", () => {
    const before = [row(1, "Holding"), row(2, "Holding"), row(3, "Waiting")];
    const after = [row(1, "Paid"), row(2, "Passed"), row(3, "Holding"), row(4, "Waiting")];
    expect(diffRows(before, after)).toEqual([
      { copy: "No. 0001", kind: "Paid" },
      { copy: "No. 0002", kind: "Passed" },
      { copy: "No. 0004", kind: "new" },
    ]);
  });
  test("Waiting → Holding is not an ending, and an unchanged read is quiet", () => {
    expect(diffRows([row(3, "Waiting")], [row(3, "Holding")])).toEqual([]);
    expect(diffRows([row(1, "Paid")], [row(1, "Paid")])).toEqual([]);
  });
  test("a mark fades after a few seconds", () => {
    markFresh([{ copy: "No. 0009", kind: "Paid" }], 1000);
    expect(freshness("No. 0009", 2000)).toBe("Paid");
    expect(freshness("No. 0009", 6000)).toBeUndefined();
    expect(freshness("No. 0009", 2000)).toBeUndefined();
  });
  test("the copy comes first in Studio's row id", () => {
    expect(copyOfRowId("No. 0018\u001fPaid on PayPal\u001f@kemi")).toBe("No. 0018");
    expect(copyOfRowId(undefined)).toBe("");
  });
});
