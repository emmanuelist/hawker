"use client";
// Hawker's custom AG Studio widgets (AgWidgetDefinition from ag-studio-react, AgWidgetParams from
// ag-studio; types verified in node_modules). Each queries through `widgetApi.getData`, so page
// filters, widget filters and cross-filters apply to them like any built-in widget.
import type { AgWidgetField, AgWidgetParams } from "ag-studio";
import { AgNoDataOverlay, type AgWidgetDefinition } from "ag-studio-react";
import { useEffect, useState } from "react";

type Row = Record<string, unknown>;
const usd = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`;
const first = (fields: AgWidgetField[] | undefined) => fields?.[0];

/** Rows for the mapped fields, kept current as the ledger's data changes. */
function useRows(params: AgWidgetParams, keys: string[]) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const mapping = params.dataMapping as unknown as Record<string, AgWidgetField[] | undefined>;
  const fields = keys.map((k) => first(mapping[k])).filter((f): f is AgWidgetField => !!f);
  const sig = fields.map((f) => `${f.key}:${f.aggregation ?? ""}`).join("|");
  useEffect(() => {
    if (fields.length < keys.length) return;
    let live = true;
    params.widgetApi
      .getData({ fields }, { queryId: "rows", onDataUpdated: (r) => live && !r.replaced && setRows(r.results.rows) })
      .then((r) => live && !r.replaced && setRows(r.results.rows))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
    // `sig` captures the mapped fields; `fields` is rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, params.widgetApi]);
  return { rows, fields };
}

function EndingsWidget(params: AgWidgetParams) {
  const { rows, fields } = useRows(params, ["state", "copies", "amount"]);
  if (fields.length < 3) return null;
  if (rows && rows.length === 0) return <AgNoDataOverlay />;
  const [state, copies, amount] = fields;
  const by = new Map((rows ?? []).map((r) => [String(r[state.key]), { n: Number(r[copies.key] ?? 0), usd: Number(r[amount.key] ?? 0) }]));
  const get = (s: string) => by.get(s) ?? { n: 0, usd: 0 };
  const open = get("Holding").n + get("Waiting").n;
  const other = [...by.keys()].filter((s) => !["Paid", "Passed", "Holding", "Waiting"].includes(s));
  return (
    <div className="flex h-full flex-col justify-between gap-3 p-4 text-ink">
      <div className="grid grid-cols-2 gap-4">
        {(["Paid", "Passed"] as const).map((s) => (
          <div key={s} className="border border-rule bg-paid px-4 py-3">
            <span className="stamp text-[1.05rem]" data-kind={s === "Paid" ? "paid" : "passed"} style={{ rotate: "-4deg" }}>
              {s}
            </span>
            <p className="mt-3 font-mono text-3xl font-bold num">{rows ? get(s).n : "–"}</p>
            <p className="text-[0.8125rem] text-ink-muted">
              {s === "Paid" ? "read from PayPal" : "to the next buyer"} · <span className="font-mono num">{usd(get(s).usd)}</span>
            </p>
          </div>
        ))}
      </div>
      <p className="text-[0.8125rem] leading-snug text-ink-muted">
        Open now: <span className="font-mono text-ink num">{open}</span>. Any other ending:{" "}
        <span className="font-semibold text-ink">{other.length ? other.join(", ") : "none"}</span>. The database has no other state to put a hold in.
      </p>
    </div>
  );
}

interface PayPalRead {
  copy: string;
  paypalStatus: string;
  readAt: string;
  secondsLeft: number;
}

function OwesWidget(params: AgWidgetParams) {
  const { rows, fields } = useRows(params, ["copy", "buyer", "item", "amount", "state"]);
  const [reads, setReads] = useState<Map<string, PayPalRead> | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  if (fields.length < 5) return null;
  const [copy, buyer, item, amount, state] = fields;
  const owing = (rows ?? []).filter((r) => r[state.key] === "Holding");
  async function readPayPal() {
    setReading("Reading PayPal…");
    try {
      const stall = (params.context as { stall?: string } | undefined)?.stall ?? "ada";
      const res = await fetch(`/api/stalls/${encodeURIComponent(stall)}/owes`);
      const json = (await res.json()) as { owed?: PayPalRead[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "PayPal read failed");
      setReads(new Map((json.owed ?? []).map((o) => [o.copy, o])));
      setReading(null);
    } catch (e) {
      setReading(e instanceof Error ? e.message : "PayPal read failed");
    }
  }
  return (
    <div className="flex h-full flex-col p-4 text-ink">
      <div className="flex items-baseline justify-between gap-3">
        <p className="print">Holding, unpaid</p>
        <button type="button" onClick={() => void readPayPal()} className="text-[0.8125rem] font-semibold text-print underline">
          {reading ?? "Read PayPal now"}
        </button>
      </div>
      {rows && owing.length === 0 ? (
        <p className="mt-3 text-[0.9375rem] leading-snug text-ink-muted">Nobody owes right now. Every copy has ended paid or passed, or is waiting in line.</p>
      ) : (
        <ol className="mt-2 divide-y divide-rule overflow-auto">
          {owing.map((r) => {
            const no = String(r[copy.key]);
            const read = reads?.get(no);
            return (
              <li key={no} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-3 py-2 text-[0.875rem]">
                <span className="font-mono font-bold text-serial">{no}</span>
                <span className="min-w-0">
                  <span className="font-semibold">{String(r[buyer.key])}</span> <span className="text-ink-muted">{String(r[item.key])}</span>
                </span>
                <span className="text-right font-mono num">
                  {usd(r[amount.key])}
                  {read && (
                    <span className="block text-[0.6875rem] text-ink-muted">
                      PayPal: {read.paypalStatus} · {Math.floor(read.secondsLeft / 60)}:{String(read.secondsLeft % 60).padStart(2, "0")} left
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

const STAMP_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="12" height="8" transform="rotate(-8 8 8)"/></svg>';

export const endingsWidget = {
  id: "hawker-endings",
  label: "Two endings",
  icon: STAMP_ICON,
  dataMapping: {
    state: { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true, aiDescription: "The hold state: Waiting, Holding, Paid or Passed." },
    copies: { type: "field", supportedRoles: ["numeric"], requires: { per: "dataMapping.state", cardinality: "one" }, required: true, aiDescription: "How many copies (a count)." },
    amount: { type: "field", supportedRoles: ["numeric"], requires: { per: "dataMapping.state", cardinality: "one" }, required: true, aiDescription: "Amount in USD (a sum)." },
  },
  form: (p: { createDefaults: (o: { dataMappingItems: { key: string; label: string }[] }) => unknown }) =>
    p.createDefaults({ dataMappingItems: [{ key: "state", label: "State" }, { key: "copies", label: "Copies" }, { key: "amount", label: "Amount" }] }),
  comp: EndingsWidget,
  defaultSize: { width: 520, height: 260 },
  minSize: { width: 320, height: 200 },
  ai: { description: "Hawker's thesis as a widget: how many copies ended Paid (read from PayPal) and Passed (to the next buyer), with amounts, and confirms no other ending exists." },
} as unknown as AgWidgetDefinition;

export const owesWidget = {
  id: "hawker-owes",
  label: "Who owes now",
  icon: STAMP_ICON,
  dataMapping: {
    copy: { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true, aiDescription: "The copy number." },
    buyer: { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true, aiDescription: "The buyer's handle." },
    item: { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true, aiDescription: "The item held." },
    amount: { type: "field", supportedRoles: ["numeric", "category"], requires: { cardinality: "many" }, required: true, aiDescription: "Amount in USD." },
    state: { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true, aiDescription: "The hold state." },
  },
  form: (p: { createDefaults: (o: { dataMappingItems: { key: string; label: string }[] }) => unknown }) =>
    p.createDefaults({
      dataMappingItems: [
        { key: "copy", label: "Copy" },
        { key: "buyer", label: "Buyer" },
        { key: "item", label: "Item" },
        { key: "amount", label: "Amount" },
        { key: "state", label: "State" },
      ],
    }),
  comp: OwesWidget,
  defaultSize: { width: 560, height: 260 },
  minSize: { width: 320, height: 180 },
  ai: { description: "Open copies still Holding and unpaid, with a button that re-reads each invoice live from PayPal." },
} as unknown as AgWidgetDefinition;
