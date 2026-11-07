// Counts and sums for the ledger agent's `ledger_totals` tool, computed by code in integer cents
// (AGENTS.md money rule) from the rows on the page. The model reports them; it never adds them up.
import type { LedgerRow } from "@/lib/service/ledger";

export function ledgerTotals(rows: LedgerRow[]) {
  const cents = (r: LedgerRow) => Math.round(r.amountUsd * 100);
  const tally = <K extends string>(key: (r: LedgerRow) => K) => {
    const out: Record<string, { copies: number; paid: number; passed: number; open: number; paidUsd: string; passedUsd: string }> = {};
    const c: Record<string, { paid: number; passed: number }> = {};
    for (const r of rows) {
      const k = key(r);
      out[k] ??= { copies: 0, paid: 0, passed: 0, open: 0, paidUsd: "0.00", passedUsd: "0.00" };
      c[k] ??= { paid: 0, passed: 0 };
      out[k].copies++;
      if (r.state === "Paid") {
        out[k].paid++;
        c[k].paid += cents(r);
      } else if (r.state === "Passed") {
        out[k].passed++;
        c[k].passed += cents(r);
      } else {
        out[k].open++;
      }
    }
    for (const k of Object.keys(out)) {
      out[k].paidUsd = (c[k].paid / 100).toFixed(2);
      out[k].passedUsd = (c[k].passed / 100).toFixed(2);
    }
    return out;
  };
  const all = tally(() => "all").all ?? null;
  const lastPaid = rows.find((r) => r.state === "Paid") ?? null;
  return {
    total: all,
    byItem: tally((r) => r.code),
    byBuyer: tally((r) => r.buyer),
    latestPaid: lastPaid ? { copy: lastPaid.copy, buyer: lastPaid.buyer, paypalTxn: lastPaid.paypalTxn } : null,
    otherEndings: rows.filter((r) => !["Waiting", "Holding", "Paid", "Passed"].includes(r.state)).length,
  };
}

