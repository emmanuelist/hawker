// One chat line, the same on the desk and the stall: what the buyer wrote, as written, then what
// Hawker read and which reader read it (principle 2: a misread is visible).
import type { SnapshotComment, SnapshotHold } from "@/lib/service/snapshot";
import { copyNo } from "./live";

export const SOURCE: Record<string, string> = { fast: "fast path", groq: "Groq Qwen", gemini: "Gemini", unavailable: "AI unavailable" };
const READING: Record<string, string> = { claim: "Claim", cancel: "Cancel", question: "Question", unclear: "Unclear", other: "Chatter" };

const STATE_LINE: Record<SnapshotHold["state"], string> = { Holding: "holding", Waiting: "waiting", Paid: "paid", Passed: "passed" };

export function ChatLine({
  c,
  showSeq = false,
  compact = false,
  hold = null,
  showSource = true,
}: {
  c: SnapshotComment;
  showSeq?: boolean;
  compact?: boolean;
  /** The copy this comment made, if any: its current state replaces the reply written at the time. */
  hold?: SnapshotHold | null;
  showSource?: boolean;
}) {
  return (
    <li className={compact ? "py-2.5" : "py-3"}>
      <p className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
        <span className="min-w-0 truncate font-semibold">
          @{c.handle}
          {c.mine && <span className="ml-1.5 font-normal text-ink-muted">you</span>}
        </span>
        {showSeq && <span className="shrink-0 font-mono text-[0.75rem] text-ink-muted num">#{c.seq}</span>}
      </p>
      <p className={`${compact ? "text-[0.9375rem]" : "text-base"} leading-snug [overflow-wrap:anywhere]`}>
        {c.text}
        {c.via === "tap" && <span className="print ml-2 align-[0.1em] text-ink-muted">tapped</span>}
      </p>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[0.75rem] text-ink-muted">
        {c.intent ? (
          <>
            <span className="print">Read · {READING[c.intent] ?? c.intent}</span>
            {showSource && c.source && (
              <span>
                {SOURCE[c.source] ?? c.source}
                {c.ms ? ` · ${(c.ms / 1000).toFixed(1)} s` : ""}
              </span>
            )}
          </>
        ) : (
          <span className="print">{c.source === "unavailable" ? "AI unavailable" : "Reading…"}</span>
        )}
      </p>
      {hold ? (
        <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink">
          <span className="font-mono font-bold text-serial">{copyNo(hold.serial)}</span> {hold.code} {hold.singleVariant ? hold.itemName : hold.variant}:{" "}
          <span className={hold.state === "Paid" ? "font-semibold text-stamp-paid" : hold.state === "Passed" ? "font-semibold text-stamp-passed" : "font-semibold"}>
            {STATE_LINE[hold.state]}
            {hold.state === "Passed" ? (hold.passedTo ? ` → @${hold.passedTo}` : " → next buyer") : ""}
          </span>
        </p>
      ) : (
        c.outcome && <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink">{c.outcome}</p>
      )}
    </li>
  );
}
