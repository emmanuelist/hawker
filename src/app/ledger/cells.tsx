"use client";
// The ledger grid's cells as stubs in the booklet: red serials, small PAID / PASSED stamps, the
// buyer's words in quotes. Wired through the grid widget's `createCellRenderer` option
// (AgGridWidgetOptions in ag-studio-react, verified in node_modules). Each renderer reads its row's
// copy from the row id, so a stamp lands, or a stub slides in, only for a change seen live.
import type { AgWidgetField } from "ag-studio";
import type { AgWidgetCustomCellRendererProps } from "ag-studio-react";
import { useState, type ComponentType } from "react";
import { copyOfRowId, freshness } from "./live";

type Props = AgWidgetCustomCellRendererProps;
const text = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
const useFresh = (p: Props) => useState(() => freshness(copyOfRowId(p.node?.id)))[0];

function CopyCell(p: Props) {
  const fresh = useFresh(p);
  return (
    <span className="lg-copy" data-fresh={fresh}>
      {text(p.value) ?? "—"}
    </span>
  );
}

/** "Paid on PayPal" · "Passed → @next" · "Passed → next buyer" · "Holding" · "Waiting" */
export function EndingMark({ ending, fresh }: { ending: string; fresh?: string }) {
  if (ending.startsWith("Paid")) {
    return (
      <span className="lg-ending" data-fresh={fresh === "Paid" ? "" : undefined}>
        <span className="stamp lg-stamp" data-kind="paid">
          Paid
        </span>
        <span className="lg-ending-to">on PayPal</span>
      </span>
    );
  }
  if (ending.startsWith("Passed")) {
    const to = ending.replace(/^Passed\s*/, "");
    return (
      <span className="lg-ending" data-fresh={fresh === "Passed" ? "" : undefined}>
        <span className="stamp lg-stamp" data-kind="passed">
          Passed
        </span>
        <span className="lg-ending-to">{to || "→ next buyer"}</span>
      </span>
    );
  }
  return (
    <span className="lg-open" data-state={ending}>
      {ending}
    </span>
  );
}

function EndingCell(p: Props) {
  const fresh = useFresh(p);
  const v = text(p.value);
  return v ? <EndingMark ending={v} fresh={fresh} /> : <span className="lg-blank">—</span>;
}

function AmountCell(p: Props) {
  const n = typeof p.value === "number" ? p.value : Number(p.value);
  const shown = text(p.valueFormatted) ?? (Number.isFinite(n) ? `$${n.toFixed(2)}` : null);
  return <span className="lg-amount">{shown ?? "—"}</span>;
}

function TxnCell(p: Props) {
  const v = text(p.value);
  return v && v !== "—" ? (
    <span className="lg-txn" title={`PayPal transaction ${v}`}>
      {v}
    </span>
  ) : (
    <span className="lg-blank">—</span>
  );
}

function SaidCell(p: Props) {
  const v = text(p.value);
  return v ? <q className="lg-said">{v}</q> : <span className="lg-blank">—</span>;
}

const READERS: Record<string, string> = { fast: "Fast path", groq: "Groq", gemini: "Gemini" };
function ReadByCell(p: Props) {
  const v = text(p.value);
  return v && v !== "—" ? (
    <span className="lg-reader" data-reader={v}>
      {READERS[v] ?? v}
    </span>
  ) : (
    <span className="lg-blank">—</span>
  );
}

function BuyerCell(p: Props) {
  return <span className="lg-buyer">{text(p.value) ?? "—"}</span>;
}

const BY_FIELD: Record<string, ComponentType<Props>> = {
  copy: CopyCell,
  ending: EndingCell,
  amountUsd: AmountCell,
  paidUsd: AmountCell,
  passedUsd: AmountCell,
  paypalTxn: TxnCell,
  said: SaidCell,
  readBy: ReadByCell,
  buyer: BuyerCell,
  passedTo: BuyerCell,
};

/** Studio calls this once per column; a column it doesn't know keeps the grid's own rendering. */
export function createCellRenderer(field: AgWidgetField): ComponentType<Props> | undefined {
  // An aggregated column (a sum or count) is a number, not a stub; leave it to the grid.
  if (field.aggregation) return field.fieldId.endsWith("Usd") ? AmountCell : undefined;
  const name = String(field.fieldId).split(".").pop() ?? "";
  return BY_FIELD[name];
}
