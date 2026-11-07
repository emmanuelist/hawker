"use client";
// Hawker's custom AG Studio widgets (AgWidgetDefinition from ag-studio-react, AgWidgetParams from
// ag-studio; types verified in node_modules). Each queries through `widgetApi.getData`, so page
// filters, widget filters and cross-filters apply to them like any built-in widget.
import type { AgWidgetField, AgWidgetParams } from "ag-studio";
import { AgNoDataOverlay, type AgWidgetDefinition } from "ag-studio-react";
import { useEffect, useState } from "react";
import { Countdown, NumberWheels } from "@/components/Countdown";

type Row = Record<string, unknown>;
const usd = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`;
const first = (fields: AgWidgetField[] | undefined) => fields?.[0];
const STATES = ["Waiting", "Holding", "Paid", "Passed"] as const;
type LedgerContext = { stall?: string; skewMs?: number } | undefined;

/** Rows for the mapped fields, kept current as the ledger's data changes. */
function useRows(params: AgWidgetParams, keys: string[], crossFilter: "filter" | "none" = "filter") {
  const [rows, setRows] = useState<Row[] | null>(null);
  const mapping = params.dataMapping as unknown as Record<string, AgWidgetField[] | undefined>;
  const fields = keys.map((k) => first(mapping[k])).filter((f): f is AgWidgetField => !!f);
  const sig = fields.map((f) => `${f.key}:${f.aggregation ?? ""}`).join("|");
  useEffect(() => {
    if (fields.length < keys.length) return;
    let live = true;
    params.widgetApi
      .getData({ fields }, { queryId: "rows", crossFilter, onDataUpdated: (r) => live && !r.replaced && setRows(r.results.rows) })
      .then((r) => live && !r.replaced && setRows(r.results.rows))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
    // `sig` captures the mapped fields; `fields` is rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, params.widgetApi, crossFilter]);
  return { rows, fields };
}

/** The clock, ticking each second (server-corrected by the shell's measured skew). It always ticks:
 *  a clock that paused while nobody owed would show a new copy's time from when it paused. */
function useNow(skewMs = 0) {
  const [now, setNow] = useState(() => Date.now() + skewMs);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + skewMs), 1000);
    return () => clearInterval(t);
  }, [skewMs]);
  return now;
}

// ——— the stamp filter: four stamps instead of grey pills; one tap cross-filters the page ———
function StampFilterWidget(params: AgWidgetParams) {
  // The stamps count the whole ledger: the filter they set must not shrink their own counts.
  const { rows, fields } = useRows(params, ["state", "copies"], "none");
  if (fields.length < 2) return null;
  const [state, copies] = fields;
  const count = new Map((rows ?? []).map((r) => [String(r[state.key]), Number(r[copies.key] ?? 0)]));
  const picked = new Set<string>();
  for (const s of params.widgetApi.getCrossFilterSelections() ?? []) if (s.type === "value") for (const v of s.values) picked.add(String(v));
  const toggle = (value: string) => params.widgetApi.toggleCrossFilter({ type: "value", field: state, value, group: 0 });
  return (
    <div className="lg-stampbar" role="group" aria-label="Show copies by state">
      <span className="print lg-stampbar-label">Show</span>
      {STATES.map((s) => (
        <button key={s} type="button" className="lg-stampbtn" data-state={s} aria-pressed={picked.has(s)} onClick={() => toggle(s)}>
          <span className="lg-stampbtn-word">{s}</span>
          <NumberWheels value={count.get(s) ?? 0} digits={2} tone={s === "Paid" ? "paid" : s === "Passed" ? "passed" : "ink"} label={`${count.get(s) ?? 0} copies`} />
        </button>
      ))}
      <button type="button" className="lg-stampbar-all" disabled={picked.size === 0} onClick={() => params.widgetApi.resetCrossFilter()}>
        All copies
      </button>
    </div>
  );
}

// ——— the thesis as a widget: two sheets, PAID and PASSED, and no third ———
function EndingsWidget(params: AgWidgetParams) {
  const { rows, fields } = useRows(params, ["state", "copies", "amount"]);
  const [last, setLast] = useState<{ paid: number; passed: number } | null>(null);
  const [landed, setLanded] = useState<{ kind: "Paid" | "Passed"; n: number } | null>(null);
  const ready = fields.length === 3;
  const [state, copies, amount] = fields;
  const by = new Map((ready ? (rows ?? []) : []).map((r) => [String(r[state.key]), { n: Number(r[copies.key] ?? 0), usd: Number(r[amount.key] ?? 0) }]));
  const get = (s: string) => by.get(s) ?? { n: 0, usd: 0 };
  const paid = get("Paid").n;
  const passed = get("Passed").n;
  // A stamp re-lands only when a count rises while the page is open (render-time state sync).
  if (rows && (last === null || last.paid !== paid || last.passed !== passed)) {
    if (last !== null && paid > last.paid) setLanded({ kind: "Paid", n: paid });
    else if (last !== null && passed > last.passed) setLanded({ kind: "Passed", n: passed });
    setLast({ paid, passed });
  }
  useEffect(() => {
    if (!landed) return;
    const t = setTimeout(() => setLanded(null), 1600);
    return () => clearTimeout(t);
  }, [landed]);
  if (!ready) return null;
  if (rows && rows.length === 0) return <AgNoDataOverlay />;
  const open = get("Holding").n + get("Waiting").n;
  const other = [...by.keys()].filter((s) => !(STATES as readonly string[]).includes(s));
  const ended = paid + passed;
  return (
    <div className="lg-endings">
      <div className="lg-endings-sheets">
        {(["Paid", "Passed"] as const).map((s) => (
          <section key={s} className="lg-sheet" data-state={s} aria-label={`${s}: ${get(s).n} copies, ${usd(get(s).usd)}`} data-landed={landed?.kind === s ? "" : undefined}>
            <span key={landed?.kind === s ? `l${landed.n}` : "still"} className="stamp lg-sheet-stamp" data-kind={s === "Paid" ? "paid" : "passed"}>
              {s}
            </span>
            <NumberWheels value={rows ? get(s).n : 0} digits={2} tone={s === "Paid" ? "paid" : "passed"} label={`${get(s).n} copies`} />
            <p className="lg-sheet-sub">
              <span className="lg-amount">{usd(get(s).usd)}</span>
              <span>{s === "Paid" ? "read from PayPal" : "to the next buyer"}</span>
            </p>
          </section>
        ))}
      </div>
      {ended > 0 && (
        <div className="lg-split" role="img" aria-label={`${Math.round((paid / ended) * 100)}% of ended copies were paid`}>
          <i style={{ flexGrow: paid }} data-kind="paid" />
          <i style={{ flexGrow: passed }} data-kind="passed" />
        </div>
      )}
      <p className="lg-endings-note">
        Open now <b className="num">{open}</b> · Any other ending: <b>{other.length ? other.join(", ") : "none"}</b>. The database has no third state for a hold.
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

// ——— who still owes: each open copy as a small yellow copy with its time running ———
function OwesWidget(params: AgWidgetParams) {
  const { rows, fields } = useRows(params, ["copy", "buyer", "item", "amount", "state", "deadline"]);
  const [reads, setReads] = useState<Map<string, PayPalRead> | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const ctx = params.context as LedgerContext;
  const ready = fields.length === 6;
  const [copy, buyer, item, amount, state, deadline] = fields;
  const owing = ready ? (rows ?? []).filter((r) => r[state.key] === "Holding") : [];
  const now = useNow(ctx?.skewMs ?? 0);
  if (!ready) return null;
  async function readPayPal() {
    setReading("Reading PayPal…");
    try {
      const res = await fetch(`/api/stalls/${encodeURIComponent(ctx?.stall ?? "ada")}/owes`);
      const json = (await res.json()) as { owed?: PayPalRead[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "PayPal read failed");
      setReads(new Map((json.owed ?? []).map((o) => [o.copy, o])));
      setReading(null);
    } catch (e) {
      setReading(e instanceof Error ? e.message : "PayPal read failed");
    }
  }
  return (
    <div className="lg-owes">
      <div className="lg-owes-head">
        <p className="print">Holding, unpaid</p>
        <button type="button" onClick={() => void readPayPal()} className="lg-owes-read" disabled={reading === "Reading PayPal…"}>
          {reading ?? "Read PayPal now"}
        </button>
      </div>
      {rows && owing.length === 0 ? (
        <div className="lg-blankform" aria-label="No copy is Holding">
          <p className="lg-blankform-fields" aria-hidden="true">
            <span className="print">Copy No.</span>
            <i />
            <span className="print">Buyer</span>
            <i />
            <span className="print">Amount</span>
            <i />
          </p>
          <p className="lg-blankform-msg">Nobody owes right now. Every copy ended Paid or Passed, or is waiting in line.</p>
        </div>
      ) : (
        <ol className="lg-owes-list">
          {owing.map((r) => {
            const no = String(r[copy.key]);
            const read = reads?.get(no);
            const due = r[deadline.key] instanceof Date ? (r[deadline.key] as Date).getTime() : Date.parse(String(r[deadline.key] ?? ""));
            const left = Number.isFinite(due) ? Math.max(0, due - now) : null;
            return (
              <li key={no} className="lg-owe" data-expiring={left !== null && left <= 30_000 ? "true" : undefined}>
                <span className="lg-copy">{no}</span>
                <span className="lg-owe-who">
                  <b>{String(r[buyer.key])}</b>
                  <span>{String(r[item.key])}</span>
                </span>
                <span className="lg-owe-right">
                  <span className="lg-amount">{usd(r[amount.key])}</span>
                  {left !== null && <Countdown ms={left} tone={left <= 30_000 ? "expiring" : "ink"} size="sm" />}
                </span>
                {read && (
                  <span className="lg-owe-read">
                    PayPal says {read.paypalStatus} · read {new Date(read.readAt).toLocaleTimeString("en-GB")}
                  </span>
                )}
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
type FormParams = { createDefaults: (o: { dataMappingItems: { key: string; label: string }[] }) => unknown };
const form = (items: [string, string][]) => (p: FormParams) => p.createDefaults({ dataMappingItems: items.map(([key, label]) => ({ key, label })) });

export const stampFilterWidget = {
  id: "hawker-stamps",
  label: "Stamp filter",
  icon: STAMP_ICON,
  dataMapping: {
    state: { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true, aiDescription: "The hold state to filter by." },
    copies: { type: "field", supportedRoles: ["numeric"], requires: { per: "dataMapping.state", cardinality: "one" }, required: true, aiDescription: "How many copies (a count)." },
  },
  form: form([
    ["state", "State"],
    ["copies", "Copies"],
  ]),
  comp: StampFilterWidget,
  defaultSize: { width: 900, height: 96 },
  minSize: { width: 420, height: 80 },
  ai: { description: "Four stamps, Waiting, Holding, Paid and Passed, each with its count; tapping one cross-filters the page to that state." },
} as unknown as AgWidgetDefinition;

export const endingsWidget = {
  id: "hawker-endings",
  label: "Two endings",
  icon: STAMP_ICON,
  dataMapping: {
    state: { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true, aiDescription: "The hold state: Waiting, Holding, Paid or Passed." },
    copies: { type: "field", supportedRoles: ["numeric"], requires: { per: "dataMapping.state", cardinality: "one" }, required: true, aiDescription: "How many copies (a count)." },
    amount: { type: "field", supportedRoles: ["numeric"], requires: { per: "dataMapping.state", cardinality: "one" }, required: true, aiDescription: "Amount in USD (a sum)." },
  },
  form: form([
    ["state", "State"],
    ["copies", "Copies"],
    ["amount", "Amount"],
  ]),
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
    deadline: { type: "field", supportedRoles: ["category"], requires: { cardinality: "many" }, required: true, aiDescription: "When a Holding copy's time runs out." },
  },
  form: form([
    ["copy", "Copy"],
    ["buyer", "Buyer"],
    ["item", "Item"],
    ["amount", "Amount"],
    ["state", "State"],
    ["deadline", "Time runs out"],
  ]),
  comp: OwesWidget,
  defaultSize: { width: 560, height: 260 },
  minSize: { width: 320, height: 180 },
  ai: { description: "Open copies still Holding and unpaid, each with its time left, and a button that re-reads each invoice live from PayPal." },
} as unknown as AgWidgetDefinition;
