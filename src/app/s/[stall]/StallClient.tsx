"use client";
// The buyer's phone screen (D-013). What's on the live now, one-tap claims, your copy and the Pay bar in
// the thumb zone, and the chat. A tap posts a real comment ("mine gold") marked as tapped; typing works
// exactly as on the live. Code decides who holds what; this page only shows it.
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatLine } from "@/components/ChatLine";
import { ArrowOut, Copy, lineInfo } from "@/components/Copy";
import { linkLabel, mmss, money, useLiveSnapshot, useServerNow } from "@/components/live";
import type { Snapshot, SnapshotHold } from "@/lib/service/snapshot";

const order: Record<SnapshotHold["state"], number> = { Holding: 0, Waiting: 1, Paid: 2, Passed: 3 };
type Note = { text: string; error: boolean } | null;
type Pending = { text: string; label: string } | null;

export function StallClient({ stall }: { stall: string }) {
  const [nonce, setNonce] = useState(0);
  const { snap, offset, link } = useLiveSnapshot(stall, "stall", nonce);
  const now = useServerNow(offset);
  const [announce, setAnnounce] = useState("");
  const [fresh, setFresh] = useState<ReadonlySet<number>>(new Set());
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // what is in flight: "join", "send" or a tile label
  const [note, setNote] = useState<Note>(null);
  const [pending, setPending] = useState<Pending>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const commentRef = useRef<HTMLInputElement>(null);

  const me = snap?.me ?? null;
  const mine = useMemo(
    () =>
      (snap?.holds ?? [])
        .filter((h) => me && h.buyerId === me.buyerId)
        .sort((a, b) => order[a.state] - order[b.state] || b.serial - a.serial),
    [snap, me],
  );

  // React's "information from previous renders" pattern: compare my copies with the last render to
  // announce changes once (one polite live region), land stamps only on live changes, and clear a
  // reply like "pay within 3:00" that the copy itself has now overtaken.
  // `null` until the first snapshot: copies that already exist on load are not news.
  const [prevMine, setPrevMine] = useState<SnapshotHold[] | null>(null);
  if (snap && prevMine === null) setPrevMine(mine);
  else if (prevMine !== null && prevMine !== mine) {
    const before = new Map(prevMine.map((h) => [h.id, h.state]));
    const msgs: string[] = [];
    const changed: number[] = [];
    let paid: number | null = null;
    for (const h of mine) {
      const prev = before.get(h.id);
      if (!prev) {
        if (h.state === "Holding") msgs.push(`Copy ${h.serial} is held for you: ${h.code} ${h.singleVariant ? h.itemName : h.variant}. Pay before the timer ends.`);
        if (h.state === "Waiting") msgs.push(`You're in line for ${h.code} ${h.singleVariant ? h.itemName : h.variant}, copy ${h.serial}.`);
      } else if (prev !== h.state) {
        changed.push(h.id);
        if (h.state === "Holding") msgs.push(`Copy ${h.serial} is held for you. Pay before the timer ends.`);
        if (h.state === "Paid") {
          msgs.push(`Copy ${h.serial} is paid. It's yours.`);
          paid = h.id;
        }
        if (h.state === "Passed") msgs.push(`Copy ${h.serial} passed${h.passedTo ? ` to @${h.passedTo}` : ""}.`);
      }
    }
    setPrevMine(mine);
    if (changed.length) setFresh((f) => new Set([...f, ...changed]));
    if (paid !== null) setCelebrate(paid);
    if (msgs.length) {
      setAnnounce(msgs.join(" "));
      if (note && !note.error) setNote(null);
    }
  }

  // The buyer's own PAID: a short buzz on phones that support it.
  useEffect(() => {
    if (celebrate !== null && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([24, 60, 48]);
  }, [celebrate]);

  async function send(text: string, via: "typed" | "tap", what: string): Promise<boolean> {
    setBusy(what);
    setNote(null);
    try {
      const res = await fetch(`/api/stalls/${encodeURIComponent(stall)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, via }),
      });
      const json = (await res.json()) as { outcome?: string | null; error?: string };
      if (!res.ok) {
        setNote({ text: json.error ?? "That didn't send. Try again.", error: true });
        return false;
      }
      setNote(json.outcome ? { text: json.outcome, error: false } : null);
      return true;
    } catch {
      setNote({ text: "No connection. Your comment wasn't sent.", error: true });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function join(handle: string) {
    setBusy("join");
    setNote(null);
    try {
      const res = await fetch(`/api/stalls/${encodeURIComponent(stall)}/buyer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setNote({ text: json.error ?? "Couldn't join. Try again.", error: true });
        setBusy(null);
        return;
      }
      setNonce((n) => n + 1);
      const p = pending;
      setPending(null);
      setBusy(null);
      if (p) await send(p.text, "tap", p.label);
    } catch {
      setNote({ text: "No connection. Try again.", error: true });
      setBusy(null);
    }
  }

  function claim(text: string, label: string) {
    if (!me) {
      setPending({ text, label });
      setNote(null);
      nameRef.current?.focus();
      return;
    }
    void send(text, "tap", label);
  }

  if (!snap) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[30rem] items-center justify-center px-5">
        <p className="text-ink-muted" role="status">
          {link === "gone" ? "This stall isn't live right now." : link === "trouble" || link === "reconnecting" ? "Can't reach the stall right now. Retrying every few seconds…" : "Opening the stall…"}
        </p>
      </main>
    );
  }

  const item = snap.items.find((i) => i.code === snap.onScreen) ?? null;
  const lines = lineInfo(snap.holds);
  const holding = mine.filter((h) => h.state === "Holding").sort((a, b) => (a.deadlineAt ?? "").localeCompare(b.deadlineAt ?? ""));
  const payNow = holding.find((h) => h.payerLink) ?? null;

  return (
    <main className={`mx-auto flex min-h-dvh max-w-[30rem] flex-col px-5 ${payNow ? "pb-48" : "pb-32"}`}>
      <div className="flex items-center justify-between gap-3 pt-4">
        <p className="font-display text-[0.9375rem] font-black tracking-[0.16em] uppercase">Hawker</p>
        <p className="flex items-center gap-2 text-[0.8125rem] text-ink-muted">
          <span className={`inline-block size-2 rounded-full ${link === "live" ? "bg-live" : "bg-serial"}`} aria-hidden="true" />
          {linkLabel(link)}
        </p>
      </div>

      <header className="mt-5 border-b border-rule pb-4">
        <h1 className="font-display text-[2rem] leading-[0.95] font-black tracking-[-0.02em]">{snap.stall.name}</h1>
        <p className="mt-1.5 text-[0.875rem] text-ink-muted">
          {snap.show.title}
          {snap.stall.isDemo && " · a demo store with the builder's own catalog"}
        </p>
      </header>

      {item ? (
        <section aria-labelledby="onscreen" className="border-b border-rule py-5">
          <div className="flex items-end justify-between gap-4">
            <h2 id="onscreen" className="font-display text-[5.25rem] leading-[0.8] font-black tracking-[-0.04em]">
              <span className="sr-only">On the live now: </span>
              {item.code}
            </h2>
            <div className="pb-0.5 text-right">
              <p className="text-[1.0625rem] leading-tight font-semibold">{item.name}</p>
              <p className="mt-0.5 font-mono text-xl font-bold num">{money(item.priceCents)}</p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 text-[0.8125rem] font-medium text-ink" aria-hidden="true">
            <span className="inline-block size-2 rounded-full bg-serial" />
            On the live now
          </p>

          <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(6.25rem,1fr))] gap-2.5" aria-label={`Claim ${item.code}`}>
            {item.variants.map((v) => {
              const single = item.variants.length === 1;
              const text = single ? "mine" : `mine ${v.label.toLowerCase()}`;
              const label = single ? item.name : v.label;
              const myHold = mine.find((h) => h.code === item.code && h.variant === v.label && (h.state === "Holding" || h.state === "Waiting"));
              const kind = myHold ? (myHold.state === "Holding" ? "yours" : "inline") : v.available > 0 ? "claim" : "line";
              const inFlight = busy === label;
              const yoursLeft = myHold?.deadlineAt && now ? new Date(myHold.deadlineAt).getTime() - now : snap.stall.windowSeconds * 1000;
              const action =
                kind === "yours"
                  ? "Yours"
                  : kind === "inline"
                    ? `No. ${(myHold && lines.position(myHold)) ?? 1} in line`
                    : inFlight
                      ? "Reading…"
                      : kind === "claim"
                        ? "Claim"
                        : "Join the line";
              return (
                <li key={v.label} className={single ? "col-span-full" : "flex"}>
                  <button
                    type="button"
                    className="tile h-full w-full"
                    data-kind={kind}
                    disabled={kind === "yours" || kind === "inline" || busy !== null}
                    aria-label={
                      kind === "claim"
                        ? `Claim ${item.code} ${label}, ${v.available} left`
                        : kind === "line"
                          ? `Join the line for ${item.code} ${label}, sold out, ${v.waiting} waiting`
                          : `${item.code} ${label}: ${action}`
                    }
                    onClick={() => claim(text, label)}
                  >
                    <span className="font-display text-[1.0625rem] leading-none font-extrabold capitalize">{label}</span>
                    <span className="font-mono text-[0.875rem] text-ink-muted num">
                      {kind === "yours" ? "On hold" : kind === "inline" ? "Sold out" : v.available > 0 ? `${v.available} left` : "Sold out"}
                      {kind !== "yours" && v.waiting > 0 && ` · ${v.waiting} waiting`}
                    </span>
                    <span className="flex items-center justify-between gap-2 border-t border-rule pt-2 text-[0.875rem] font-semibold">
                      <span>{action}</span>
                      {(kind === "claim" || kind === "line") && !inFlight && <Plus />}
                      {kind === "yours" && <span className="font-mono num">{mmss(yoursLeft)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3.5 text-[0.875rem] leading-snug text-ink-muted">
            Tap to claim, or type it the way you would on the live: “I go take 2”, “akin yung black”. A hold lasts{" "}
            {Math.round(snap.stall.windowSeconds / 60)} min{snap.stall.isDemo ? " here (demo window)" : ""}; if it isn&rsquo;t paid, it passes to the next buyer.
          </p>
        </section>
      ) : (
        <p className="border-b border-rule py-5 text-ink-muted">The seller hasn&rsquo;t put an item on screen yet. It shows here the moment they do.</p>
      )}

      {me && mine.length > 0 && (
        <section aria-labelledby="mine" className="mt-6">
          <h2 id="mine" className="font-display text-xl font-extrabold">
            Your copies
          </h2>
          <div className="mt-4 grid gap-6">
            {mine.map((h) => (
              <Copy
                key={h.id}
                hold={h}
                now={now}
                windowSeconds={snap.stall.windowSeconds}
                size="stall"
                store={snap.stall.name}
                payable={h.id !== payNow?.id}
                nextInLine={h.state === "Holding" ? lines.next(h).handle : null}
                lineDepth={h.state === "Holding" ? lines.next(h).depth : 0}
                linePosition={h.state === "Waiting" ? lines.position(h) : null}
                fresh={fresh.has(h.id)}
                celebrate={celebrate === h.id}
              />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="chat" className="mt-8">
        <h2 id="chat" className="font-display text-xl font-extrabold">
          The chat
        </h2>
        {snap.comments.length === 0 ? (
          <p className="mt-2 text-ink-muted">No comments yet. Be first.</p>
        ) : (
          <ol className="mt-1 divide-y divide-rule">
            {snap.comments.slice(0, 14).map((c) => (
              <ChatLine key={c.seq} c={c} compact />
            ))}
          </ol>
        )}
      </section>

      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>

      <BottomBar
        snap={snap}
        now={now}
        payNow={payNow}
        joined={!!me}
        handle={me?.handle ?? null}
        busy={busy}
        note={note}
        pending={pending}
        nameRef={nameRef}
        commentRef={commentRef}
        onJoin={(h) => void join(h)}
        onSend={async (t) => {
          if ((await send(t, "typed", "send")) && commentRef.current) commentRef.current.value = "";
          commentRef.current?.focus();
        }}
        onCancelPending={() => setPending(null)}
      />
    </main>
  );
}

function BottomBar({
  snap,
  now,
  payNow,
  joined,
  handle,
  busy,
  note,
  pending,
  nameRef,
  commentRef,
  onJoin,
  onSend,
  onCancelPending,
}: {
  snap: Snapshot;
  now: number;
  payNow: SnapshotHold | null;
  joined: boolean;
  handle: string | null;
  busy: string | null;
  note: Note;
  pending: Pending;
  nameRef: React.RefObject<HTMLInputElement | null>;
  commentRef: React.RefObject<HTMLInputElement | null>;
  onJoin: (handle: string) => void;
  onSend: (text: string) => Promise<void>;
  onCancelPending: () => void;
}) {
  const left = payNow?.deadlineAt ? (now ? new Date(payNow.deadlineAt).getTime() - now : snap.stall.windowSeconds * 1000) : 0;
  const expiring = now > 0 && left < 30_000;
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-rule bg-board/95 backdrop-blur-[3px]">
      <div className="mx-auto max-w-[30rem] px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {payNow?.payerLink && (
          <a
            href={payNow.payerLink}
            target="_blank"
            rel="noreferrer"
            className="mb-3 flex h-14 items-center justify-between gap-3 bg-rail pr-2 pl-5 text-rail-ink hover:bg-rail-deep active:translate-y-px"
            aria-label={`Pay ${money(payNow.priceCents * payNow.qty)} with PayPal for copy ${payNow.serial}, ${mmss(left)} left`}
          >
            <span className="flex items-center gap-2.5">
              <span className="font-display text-[0.9375rem] font-extrabold tracking-wide whitespace-nowrap min-[360px]:text-[1.0625rem]">Pay {money(payNow.priceCents * payNow.qty)} with PayPal</span>
              <ArrowOut />
            </span>
            <span className={`flex h-10 items-center px-3 font-mono text-base font-bold num ${expiring ? "bg-serial text-white" : "bg-rail-deep text-rail-ink"}`}>
              {mmss(left)}
            </span>
          </a>
        )}
        {note && (note.error || !payNow) && (
          <p className={`mb-2 text-[0.875rem] leading-snug ${note.error ? "font-medium text-serial" : "text-ink"}`} role="status">
            {note.text}
          </p>
        )}
        {joined ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = commentRef.current?.value.trim();
              if (v) void onSend(v);
            }}
          >
            <label htmlFor="comment" className="sr-only">
              Comment as @{handle}
            </label>
            <input
              id="comment"
              ref={commentRef}
              name="comment"
              maxLength={280}
              autoComplete="off"
              enterKeyHint="send"
              placeholder={`Comment as @${handle}`}
              className="h-12 min-w-0 flex-1 border border-rule bg-paid px-3.5 text-base placeholder:text-ink-muted"
              disabled={busy !== null}
            />
            <button type="submit" disabled={busy !== null} className="h-12 bg-ink px-5 font-display font-extrabold text-white hover:bg-black disabled:opacity-60">
              {busy === "send" ? "Reading…" : "Send"}
            </button>
          </form>
        ) : (
          <>
            {pending && (
              <p className="mb-2 flex items-baseline justify-between gap-3 text-[0.875rem]">
                <span>
                  Pick your name for the chat to claim <span className="font-semibold capitalize">{pending.label}</span>.
                </span>
                <button type="button" className="shrink-0 text-ink-muted underline" onClick={onCancelPending}>
                  Not now
                </button>
              </p>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = new FormData(e.currentTarget).get("handle");
                if (typeof v === "string" && v.trim()) onJoin(v.trim().toLowerCase());
              }}
            >
              <label htmlFor="handle" className="sr-only">
                Your name in the chat
              </label>
              <input
                id="handle"
                ref={nameRef}
                name="handle"
                required
                minLength={2}
                maxLength={25}
                pattern="[a-zA-Z0-9._]{2,25}"
                autoComplete="nickname"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="go"
                placeholder="Your name in the chat"
                className="h-12 min-w-0 flex-1 border border-rule bg-paid px-3.5 text-base placeholder:text-ink-muted"
                disabled={busy !== null}
              />
              <button type="submit" disabled={busy !== null} className="h-12 bg-rail px-5 font-display font-extrabold text-rail-ink hover:bg-rail-deep disabled:opacity-60">
                {busy === "join" ? "Joining…" : pending ? "Join + claim" : "Join"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Plus() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M8 3v10M3 8h10" strokeLinecap="square" />
    </svg>
  );
}
