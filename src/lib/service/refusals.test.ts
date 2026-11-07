import { describe, expect, test } from "vitest";
import { guardName, isProbeId, PROBE_IDS } from "./refusals";

describe("refusals: naming the guard that refused", () => {
  test("a check constraint is named by the constraint", () => {
    expect(guardName({ message: 'new row for relation "holds" violates check constraint "holds_check"', constraint_name: "holds_check" })).toBe("holds_check");
  });
  test("a trigger's refusal is named by its message prefix", () => {
    expect(guardName({ message: "hold_ended: hold 24 is Paid and cannot become Passed" })).toBe("hold_ended");
  });
  test("a foreign key is not mistaken for a hold guard", () => {
    const name = guardName({ message: 'update or delete on table "holds" violates foreign key constraint "events_hold_id_fkey" on table "events"', constraint_name: "events_hold_id_fkey" });
    expect(name).toBe("events_hold_id_fkey");
    expect(name).not.toBe("hold_ended");
  });
  test("only the nine known attempts run", () => {
    expect(PROBE_IDS).toHaveLength(9);
    expect(isProbeId("cancel-paid")).toBe(true);
    expect(isProbeId("mark-paid")).toBe(false);
    expect(isProbeId("")).toBe(false);
  });
});
