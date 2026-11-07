"use client";
// How Hawker's agent tools show in Studio's chat: each call prints a receipt slip under its step, from
// the same structured result the model was handed (`aiToolDisplay`, AgAiToolDisplay in
// ag-studio-react; label/detail params verified in ag-studio's api/ai/agAiChat.d.ts).
import type { AgAiToolDetailParams, AgAiToolLabelParams } from "ag-studio";
import type { AgAiToolDisplay } from "ag-studio-react";
import { EndingMark } from "./cells";

interface Owed {
  copy: string;
  buyer: string;
  item: string;
  amountUsd: number;
  secondsLeft: number;
  invoiceId: string;
  paypalStatus: string;
}
interface OwesData {
  owed?: Owed[];
  at?: string;
}
type Tally = { copies: number; paid: number; passed: number; open: number; paidUsd: string; passedUsd: string };
interface TotalsData {
  total: Tally | null;
  byItem: Record<string, Tally>;
  latestPaid: { copy: string; buyer: string; paypalTxn: string | null } | null;
  otherEndings: number;
}
interface ChartData {
  widgetId: string;
  title: string;
}

const clock = (iso: string | undefined) => (iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function data<T>(p: { status: string; result?: unknown }): T | null {
  const r = p.result as { success?: boolean; data?: unknown } | undefined;
  return p.status === "done" && r?.success ? ((r.data as T) ?? null) : null;
}
function failure(p: { status: string; result?: unknown }): string | null {
  const r = p.result as { success?: boolean; issues?: { message: string }[] } | undefined;
  if (p.status === "cancelled") return "Stopped before it finished.";
  return p.status === "done" && r && !r.success ? r.issues?.map((i) => i.message).join(" ") || "The tool failed." : null;
}

function Slip({ head, at, children, foot }: { head: string; at?: string; children: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <div className="lg-slip">
      <p className="lg-slip-head">
        <span className="print">{head}</span>
        {at && <span className="lg-slip-at">{at}</span>}
      </p>
      {children}
      {foot && <p className="lg-slip-foot">{foot}</p>}
    </div>
  );
}

function OwesReceipt(p: AgAiToolDetailParams) {
  const fail = failure(p);
  if (fail) return <Slip head="PayPal read">{<p className="lg-slip-error">{fail}</p>}</Slip>;
  const d = data<OwesData>(p);
  if (!d) return <Slip head="PayPal read">{<p className="lg-slip-wait">Reading each open invoice from PayPal…</p>}</Slip>;
  const owed = d.owed ?? [];
  return (
    <Slip head="PayPal read" at={clock(d.at)} foot={`${owed.length} invoice${owed.length === 1 ? "" : "s"} re-read · GET /v2/invoicing/invoices/{id}`}>
      {owed.length === 0 ? (
        <p className="lg-slip-line">No copy is Holding, so nobody owes right now.</p>
      ) : (
        <ol className="lg-slip-rows">
          {owed.map((o) => (
            <li key={o.copy}>
              <span className="lg-copy">{o.copy}</span>
              <span className="lg-slip-who">
                <b>{o.buyer}</b> {o.item}
              </span>
              <span className="lg-amount">${o.amountUsd.toFixed(2)}</span>
              <span className="lg-slip-status">
                {o.paypalStatus} · {mmss(o.secondsLeft)} left
              </span>
            </li>
          ))}
        </ol>
      )}
    </Slip>
  );
}

function TotalsReceipt(p: AgAiToolDetailParams) {
  const fail = failure(p);
  if (fail) return <Slip head="Ledger count">{<p className="lg-slip-error">{fail}</p>}</Slip>;
  const d = data<TotalsData>(p);
  if (!d) return <Slip head="Ledger count">{<p className="lg-slip-wait">Counting the copies…</p>}</Slip>;
  const t = d.total;
  const items = Object.entries(d.byItem)
    .sort((a, b) => b[1].copies - a[1].copies)
    .slice(0, 4);
  return (
    <Slip head="Ledger count" foot={`Counted by code in cents from ${t?.copies ?? 0} rows · other endings: ${d.otherEndings === 0 ? "none" : d.otherEndings}`}>
      <div className="lg-slip-tally">
        <div>
          <EndingMark ending="Paid on PayPal" />
          <span className="lg-slip-big">{t?.paid ?? 0}</span>
          <span className="lg-amount">${t?.paidUsd ?? "0.00"}</span>
        </div>
        <div>
          <EndingMark ending="Passed" />
          <span className="lg-slip-big">{t?.passed ?? 0}</span>
          <span className="lg-amount">${t?.passedUsd ?? "0.00"}</span>
        </div>
      </div>
      {items.length > 0 && (
        <ol className="lg-slip-rows">
          {items.map(([code, v]) => (
            <li key={code}>
              <span className="lg-slip-code">{code}</span>
              <span className="lg-slip-who">
                {v.paid} paid · {v.passed} passed{v.open ? ` · ${v.open} open` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
      {d.latestPaid && (
        <p className="lg-slip-line">
          Latest paid: <span className="lg-copy">{d.latestPaid.copy}</span> {d.latestPaid.buyer}
          {d.latestPaid.paypalTxn && <span className="lg-txn"> · {d.latestPaid.paypalTxn}</span>}
        </p>
      )}
    </Slip>
  );
}

/** Scroll the canvas to a widget by its title, once Studio has laid it out. */
export function revealWidget(title: string) {
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let tries = 0;
  const look = () => {
    const titleEl = [...document.querySelectorAll(".ag-studio-layout-widget-title")].find((e) => e.textContent?.trim() === title);
    const widget = titleEl?.closest(".ag-studio-layout-widget");
    if (widget instanceof HTMLElement) {
      widget.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      widget.dataset.hawkerNew = "";
      setTimeout(() => delete widget.dataset.hawkerNew, 2400);
    } else if (tries++ < 20) requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
}

function ChartReceipt(p: AgAiToolDetailParams) {
  const fail = failure(p);
  if (fail) return <Slip head="Chart">{<p className="lg-slip-error">{fail}</p>}</Slip>;
  const d = data<ChartData>(p);
  if (!d) return <Slip head="Chart">{<p className="lg-slip-wait">Building the chart from the ledger fields…</p>}</Slip>;
  return (
    <Slip head="Chart added" foot="Built by code from the real fields · undo removes it">
      <p className="lg-slip-line">
        <b>{d.title}</b>
      </p>
      <button type="button" className="lg-slip-btn" onClick={() => revealWidget(d.title)}>
        Show it on the page
      </button>
    </Slip>
  );
}

const pill = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const toolDisplay: Record<string, AgAiToolDisplay> = {
  who_owes_now: {
    label: (p: AgAiToolLabelParams) => {
      const d = data<OwesData>(p);
      if (p.status !== "done") return { text: "Reading PayPal" };
      return d ? { text: "Read PayPal", pill: d.owed?.length ? pill(d.owed.length, "owes", "owe") : "none owe" } : { text: "PayPal read failed" };
    },
    detail: OwesReceipt,
  },
  ledger_totals: {
    label: (p: AgAiToolLabelParams) => {
      const d = data<TotalsData>(p);
      if (p.status !== "done") return { text: "Counting the ledger" };
      return d?.total ? { text: "Counted the ledger", pill: `${d.total.paid} paid · ${d.total.passed} passed` } : { text: "Count failed" };
    },
    detail: TotalsReceipt,
  },
  add_breakdown_chart: {
    label: (p: AgAiToolLabelParams) => {
      const d = data<ChartData>(p);
      if (p.status !== "done") return { text: "Adding a chart" };
      return d ? { text: "Added a chart", pill: "Column chart" } : { text: "Chart not added" };
    },
    detail: ChartReceipt,
  },
};
