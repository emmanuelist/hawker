"use client";
// "Every way out, refused": a judge tries each forbidden ending against the real system and reads the
// refusal in the refuser's own words. Each button calls /api/stalls/{stall}/refusals/{probe}, which
// makes the real attempt now (refusals.ts): PayPal attempts are real sandbox API calls, database
// attempts are rolled back.
import { useState } from "react";
import { ArrowOut } from "@/components/Copy";
import type { ProbeId, ProbeResult } from "@/lib/service/refusals";

interface Attempt {
  id: ProbeId;
  title: string;
  on: string;
}

const AT_PAYPAL: Attempt[] = [
  { id: "cancel-paid", title: "Cancel a paid copy's invoice", on: "the latest paid copy" },
  { id: "cancel-twice", title: "Cancel a passed copy's invoice again", on: "the latest passed copy" },
  { id: "pay-passed-late", title: "Pay a passed copy late", on: "the latest passed copy's invoice" },
];
const IN_DATABASE: Attempt[] = [
  { id: "pass-paid", title: "Turn a paid copy into a passed one", on: "the latest paid copy" },
  { id: "pay-passed", title: "Turn a passed copy into a paid one", on: "the latest passed copy" },
  { id: "end-twice", title: "End a passed copy a second time", on: "the latest passed copy" },
  { id: "erase", title: "Erase a paid copy from the record", on: "the latest paid copy" },
  { id: "third-state", title: "Give a copy a third ending", on: "a new copy" },
  { id: "no-invoice", title: "Hold a copy with no PayPal invoice", on: "a new copy" },
];
const ALL = [...AT_PAYPAL, ...IN_DATABASE];

type Row = { state: "idle" } | { state: "trying" } | { state: "done"; r: ProbeResult } | { state: "failed"; message: string };

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function Refusals({ stall }: { stall: string }) {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [running, setRunning] = useState<number | null>(null);
  const set = (id: ProbeId, row: Row) => setRows((prev) => ({ ...prev, [id]: row }));

  async function attempt(id: ProbeId): Promise<ProbeResult | null> {
    set(id, { state: "trying" });
    try {
      const res = await fetch(`/api/stalls/${encodeURIComponent(stall)}/refusals/${id}`, { method: "POST" });
      const json = (await res.json()) as ProbeResult & { error?: string };
      if (!res.ok) {
        set(id, { state: "failed", message: json.error ?? `The attempt failed (${res.status}).` });
        return null;
      }
      set(id, { state: "done", r: json });
      return json;
    } catch {
      set(id, { state: "failed", message: "No connection. The attempt wasn't made." });
      return null;
    }
  }

  async function tryAll() {
    for (let i = 0; i < ALL.length; i++) {
      setRunning(i + 1);
      await attempt(ALL[i].id);
    }
    setRunning(null);
  }

  const done = ALL.map((a) => rows[a.id]).filter((r): r is Extract<Row, { state: "done" }> => r?.state === "done");
  const refused = done.filter((d) => d.r.outcome === "refused").length;

  return (
    <section id="refusals" aria-labelledby="refusals-title" className="border-b border-rule">
      <div className="mx-auto grid max-w-[78rem] gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-16">
        <div className="lg:sticky lg:top-8 lg:self-start">
          <h2 id="refusals-title" className="font-display text-[2rem] leading-[1.02] font-black tracking-[-0.025em] text-balance sm:text-[2.75rem]">
            Every way out, refused.
          </h2>
          <p className="mt-4 max-w-[34rem] text-[1.0625rem] leading-relaxed text-ink-muted">
            Try each forbidden ending yourself. Every button makes the attempt now, on a real copy from the demo stall: PayPal attempts are real API calls, and database attempts are rolled back.
          </p>
          <button
            type="button"
            onClick={() => void tryAll()}
            disabled={running !== null}
            className="mt-7 inline-flex h-12 items-center bg-rail px-5 font-display font-extrabold text-rail-ink hover:bg-rail-deep disabled:opacity-70"
          >
            {running !== null ? `Trying ${running} of ${ALL.length}…` : `Try all ${ALL.length}`}
          </button>
          <p className="mt-3 min-h-6 text-[0.9375rem] text-ink-muted" role="status">
            {done.length > 0 && (
              <>
                <span className="font-mono font-bold text-ink num">
                  {refused} of {done.length}
                </span>{" "}
                tried so far {refused === 1 ? "was" : "were"} refused.
              </>
            )}
          </p>
        </div>

        <div className="grid gap-10">
          <Group title="At PayPal" attempts={AT_PAYPAL} rows={rows} busy={running !== null} onTry={(id) => void attempt(id)} />
          <Group title="In the database" attempts={IN_DATABASE} rows={rows} busy={running !== null} onTry={(id) => void attempt(id)} />
        </div>
      </div>
    </section>
  );
}

function Group({ title, attempts, rows, busy, onTry }: { title: string; attempts: Attempt[]; rows: Record<string, Row>; busy: boolean; onTry: (id: ProbeId) => void }) {
  return (
    <div>
      <h3 className="print">{title}</h3>
      <ol className="mt-3 border-t border-rule">
        {attempts.map((a) => (
          <AttemptRow key={a.id} a={a} row={rows[a.id] ?? { state: "idle" }} busy={busy} onTry={() => onTry(a.id)} />
        ))}
      </ol>
    </div>
  );
}

function AttemptRow({ a, row, busy, onTry }: { a: Attempt; row: Row; busy: boolean; onTry: () => void }) {
  const resultId = `refusal-${a.id}`;
  return (
    <li className="border-b border-rule py-4">
      <div className="flex items-center justify-between gap-x-4 sm:gap-x-6">
        <div className="min-w-0">
          <p className="font-display text-[1.0625rem] font-extrabold leading-snug">{a.title}</p>
          <p className="text-[0.875rem] text-ink-muted">on {a.on}</p>
        </div>
        <button
          type="button"
          onClick={onTry}
          disabled={busy || row.state === "trying"}
          aria-describedby={resultId}
          className="inline-flex h-11 min-w-[6.5rem] shrink-0 items-center justify-center border border-ink/25 bg-paid px-4 font-display font-extrabold text-print shadow-[0_1px_0_rgb(23_23_23/0.08)] hover:bg-white hover:shadow-[0_6px_14px_-10px_rgb(23_23_23/0.45)] disabled:text-ink-muted"
        >
          {row.state === "trying" ? "Trying…" : row.state === "idle" ? "Try it" : "Try again"}
        </button>
      </div>
      <div id={resultId} aria-live="polite">
        {row.state === "done" && <Reply r={row.r} key={row.r.at} />}
        {row.state === "failed" && <p className="mt-3 text-[0.9375rem] text-serial">{row.message}</p>}
      </div>
    </li>
  );
}

/** The refuser's reply, printed out under the attempt. */
function Reply({ r }: { r: ProbeResult }) {
  const who = r.by === "PayPal" ? "PayPal" : "the database";
  // Paying happens in PayPal's own checkout, so that row reports PayPal's live read, not an attempt.
  const verdict =
    r.outcome === "refused" ? (r.probe === "pay-passed-late" ? "Closed at PayPal" : `Refused by ${who}`) : r.outcome === "accepted" ? `Accepted by ${who}` : "Couldn't confirm a refusal";
  return (
    <div className="refusal mt-3" data-outcome={r.outcome}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="refusal-verdict">
          {r.outcome === "refused" ? <Cross /> : <Bang />}
          {verdict}
        </span>
        <span className="font-mono text-[0.8125rem] text-ink-muted num">
          {clock(r.at)} · {r.ms} ms
        </span>
      </p>
      <p className="refusal-code">{r.code}</p>
      <p className="refusal-message">{r.message}</p>
      <p className="mt-2 text-[0.8125rem] text-ink-muted [overflow-wrap:anywhere]">
        {r.copy && <span className="font-mono font-bold text-serial">{r.copy}</span>}
        {r.invoiceId && <span className="font-mono"> · {r.invoiceId}</span>}
        {r.by === "PayPal" && r.before && (
          <span>
            {" "}
            · PayPal read {r.before}
            {r.after ? ` before, ${r.after} after` : ""}
            {r.paidUsd ? `, $${r.paidUsd} paid` : ""}
          </span>
        )}
        {r.by === "Database" && <span> · rolled back, nothing changed</span>}
      </p>
      {r.payerLink && (
        <a href={r.payerLink} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem] font-semibold text-print underline">
          Try paying it on PayPal
          <ArrowOut className="size-3.5" />
        </a>
      )}
    </div>
  );
}

function Cross() {
  return (
    <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
      <path d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5" strokeLinecap="square" />
    </svg>
  );
}

function Bang() {
  return (
    <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
      <path d="M8 2.5v7M8 12.5v1" strokeLinecap="square" />
    </svg>
  );
}
