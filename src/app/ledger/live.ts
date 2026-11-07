// What just changed on the ledger, for the motion layer. The shell compares each new read of the rows
// with the last one and marks the copies that are new or that just ended; the grid's cells read it
// when they mount, so a stub slides in or a stamp lands only for a change seen live, never on load.
import type { LedgerRow } from "@/lib/service/ledger";

export type Fresh = "new" | "Paid" | "Passed";
const FRESH_MS = 4000;
const marks = new Map<string, { kind: Fresh; at: number }>();

/** The copies that changed between two reads. The first read marks nothing. */
export function diffRows(before: LedgerRow[] | null, after: LedgerRow[]): { copy: string; kind: Fresh }[] {
  if (!before) return [];
  const was = new Map(before.map((r) => [r.copy, r.state]));
  const out: { copy: string; kind: Fresh }[] = [];
  for (const r of after) {
    const prev = was.get(r.copy);
    if (prev === undefined) out.push({ copy: r.copy, kind: r.state === "Paid" || r.state === "Passed" ? r.state : "new" });
    else if (prev !== r.state && (r.state === "Paid" || r.state === "Passed")) out.push({ copy: r.copy, kind: r.state });
  }
  return out;
}

export function markFresh(changes: { copy: string; kind: Fresh }[], now = Date.now()) {
  for (const c of changes) marks.set(c.copy, { kind: c.kind, at: now });
}

/** How the copy changed in the last few seconds, if it did. */
export function freshness(copy: string, now = Date.now()): Fresh | undefined {
  const m = marks.get(copy);
  if (!m) return undefined;
  if (now - m.at > FRESH_MS) {
    marks.delete(copy);
    return undefined;
  }
  return m.kind;
}

/** The copy number from an AG Grid row id: Studio joins the row's values with U+001F, copy first. */
export const copyOfRowId = (id: string | undefined) => (id ? id.split("\u001f")[0] : "");
