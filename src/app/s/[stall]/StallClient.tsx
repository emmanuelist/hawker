"use client";
// The buyer's phone screen (D-013). What's on the live now, one-tap claims, your copy and the Pay bar in
// the thumb zone, and the chat. A tap posts a real comment ("mine gold") marked as tapped; typing works
// exactly as on the live. Code decides who holds what; this page only shows it.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChatLine } from "@/components/ChatLine";
import { ArrowOut, Copy, lineInfo } from "@/components/Copy";
import { Countdown } from "@/components/Countdown";
import { copyNo, linkLabel, mmss, money, useLiveSnapshot, useServerNow } from "@/components/live";
import type { Snapshot, SnapshotHold } from "@/lib/service/snapshot";

const order: Record<SnapshotHold["state"], number> = { Holding: 0, Waiting: 1, Paid: 2, Passed: 3 };
type Note = { text: string; error: boolean } | null;
type Pending = { text: string; key: string; label: string } | null;
type Item = Snapshot["items"][number];

// The first view is rendered on the server, so the form is on screen before React is. Until it
// hydrates, a tap on Join would submit the form natively (a GET that reloads the page), so the
// controls stay disabled until the page is interactive.
const noop = () => () => {};
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

export function StallClient({ stall, initial = null }: { stall: string; initial?: Snapshot | null }) {
  const hydrated = useHydrated();
  const [nonce, setNonce] = useState(0);
  const { snap, offset, link } = useLiveSnapshot(stall, "stall", nonce, initial);
  const now = useServerNow(offset);
  const [announce, setAnnounce] = useState("");
  const [fresh, setFresh] = useState<ReadonlySet<number>>(new Set());
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // what is in flight: "join", "send" or a tile label
  const [note, setNote] = useState<Note>(null);
  const [pending, setPending] = useState<Pending>(null);
  // Set when a join succeeds: the server knows the buyer from its cookie before the live snapshot
  // names them, and a tap in that gap must claim, not wait for a name form that is about to close.
  const [justJoined, setJustJoined] = useState(false);
  const [openEarlier, setOpenEarlier] = useState<string | null>(null);
  const [passedNotice, setPassedNotice] = useState<SnapshotHold | null>(null);
  const [released, setReleased] = useState<ReadonlySet<number>>(new Set());
  const [warned, setWarned] = useState<ReadonlySet<number>>(new Set());
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
        if (h.state === "Passed") {
          msgs.push(`Copy ${h.serial} passed${h.passedTo ? ` to @${h.passedTo}` : " to the next buyer"}.`);
          if (!released.has(h.id)) setPassedNotice(h);
        }
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

  // Under 30 seconds left on one of my copies: say so once.
  const lowTime = now > 0 ? mine.find((h) => h.state === "Holding" && h.deadlineAt && new Date(h.deadlineAt).getTime() - now < 30_000 && !warned.has(h.id)) : undefined;
  if (lowTime) {
    setWarned(new Set([...warned, lowTime.id]));
    setAnnounce(`Copy ${lowTime.serial}: under 30 seconds left to pay.`);
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
      setJustJoined(true);
      const p = pending;
      setPending(null);
      setBusy(null);
      if (p) await send(p.text, "tap", p.key);
    } catch {
      setNote({ text: "No connection. Try again.", error: true });
      setBusy(null);
    }
  }

  function release(h: SnapshotHold) {
    setReleased(new Set([...released, h.id]));
    const text = h.singleVariant ? `cancel ${h.code.toLowerCase()}` : `cancel ${h.code.toLowerCase()} ${h.variant.toLowerCase()}`;
    void send(text, "tap", `release:${h.id}`);
  }

  function claimAgain(h: SnapshotHold) {
    setPassedNotice(null);
    const text = h.singleVariant ? `mine ${h.code.toLowerCase()}` : `mine ${h.code.toLowerCase()} ${h.variant.toLowerCase()}`;
    void send(text, "tap", `${h.code}:${h.variant}`);
  }

  function claim(text: string, key: string, label: string) {
    if (!me && !justJoined) {
      setPending({ text, key, label });
      setNote(null);
      nameRef.current?.focus();
      return;
    }
    void send(text, "tap", key);
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
  const waitingCopy = mine.find((h) => h.state === "Waiting") ?? null;
  const byComment = new Map(snap.holds.map((h) => [h.commentSeq, h]));
  const earlierItems = snap.earlier.map((c) => snap.items.find((i) => i.code.toUpperCase() === c)).filter((i): i is Item => !!i);
  const openItem = earlierItems.find((i) => i.code === openEarlier) ?? null;

  return (
    <main className={`mx-auto flex min-h-dvh max-w-[30rem] flex-col px-5 ${payNow || waitingCopy ? "pb-48" : "pb-32"}`}>
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

          <ClaimTiles
            item={item}
            onScreen
            mine={mine}
            lines={lines}
            now={now}
            windowSeconds={snap.stall.windowSeconds}
            busy={hydrated ? busy : "hydrating"}
            onClaim={claim}
          />
          <p className="mt-3.5 text-[0.875rem] leading-snug text-ink-muted">
            Tap to claim, or type it like on the live: “I go take 2”, “akin yung black”. Unpaid after {Math.round(snap.stall.windowSeconds / 60)}:00
            {snap.stall.isDemo ? " (demo)" : ""}, a hold passes to the next buyer.
          </p>
        </section>
      ) : (
        <p className="border-b border-rule py-5 text-ink-muted">The seller hasn&rsquo;t put an item on screen yet. It shows here the moment they do.</p>
      )}

      {earlierItems.length > 0 && (
        <section aria-labelledby="earlier" className="border-b border-rule py-5">
          <h2 id="earlier" className="font-display text-lg leading-tight font-extrabold">
            Earlier on this live
          </h2>
          <p className="mt-0.5 text-[0.875rem] text-ink-muted">Still yours to claim while stock lasts.</p>
          <ul className="-mx-5 mt-3 flex snap-x gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
            {earlierItems.map((i) => {
              const left = i.variants.reduce((n, v) => n + v.available, 0);
              const open = openEarlier === i.code;
              return (
                <li key={i.code} className="shrink-0 snap-start">
                  <button
                    type="button"
                    aria-pressed={open}
                    aria-controls="earlier-claim"
                    onClick={() => setOpenEarlier(open ? null : i.code)}
                    className="flex min-h-[4.75rem] w-[8.5rem] flex-col items-start justify-between border border-rule bg-paid px-3 py-2.5 text-left hover:bg-white aria-pressed:border-print aria-pressed:bg-waiting"
                  >
                    <span className="flex w-full items-baseline justify-between gap-2">
                      <span className="font-display text-xl leading-none font-black">{i.code}</span>
                      <span className={`font-mono text-[0.75rem] num ${left === 0 ? "text-serial" : "text-ink-muted"}`}>{left === 0 ? "sold out" : `${left} left`}</span>
                    </span>
                    <span className="w-full truncate text-[0.8125rem] font-medium">{i.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {openItem && (
            <div id="earlier-claim" className="mt-4">
              <p className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">
                  {openItem.code} {openItem.name}
                </span>
                <span className="font-mono font-bold num">{money(openItem.priceCents)}</span>
              </p>
              <ClaimTiles
                item={openItem}
                onScreen={false}
                mine={mine}
                lines={lines}
                now={now}
                windowSeconds={snap.stall.windowSeconds}
                busy={hydrated ? busy : "hydrating"}
                onClaim={claim}
              />
            </div>
          )}
        </section>
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
                onRelease={() => release(h)}
                releasing={busy === `release:${h.id}`}
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
            {snap.comments
              .slice(0, 14)
              .reverse()
              .map((c) => (
                <ChatLine key={c.seq} c={c} compact hold={byComment.get(c.seq) ?? null} showSource={false} />
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
        passedNotice={payNow ? null : passedNotice}
        onClaimAgain={claimAgain}
        onDismissNotice={() => setPassedNotice(null)}
        waitingCopy={waitingCopy}
        waitingPosition={waitingCopy ? lines.position(waitingCopy) : null}
        joined={!!me}
        handle={me?.handle ?? null}
        busy={hydrated ? busy : "hydrating"}
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

/** Variant tiles for one item. A tap posts a canonical comment through the normal pipeline:
 *  "mine gold" for the item on screen, "mine a4 wine" for an earlier item (the code names it). */
function ClaimTiles({
  item,
  onScreen,
  mine,
  lines,
  now,
  windowSeconds,
  busy,
  onClaim,
}: {
  item: Item;
  onScreen: boolean;
  mine: SnapshotHold[];
  lines: ReturnType<typeof lineInfo>;
  now: number;
  windowSeconds: number;
  busy: string | null;
  onClaim: (text: string, key: string, label: string) => void;
}) {
  const single = item.variants.length === 1;
  return (
    <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(5.25rem,1fr))] gap-2.5" aria-label={`Claim ${item.code}`}>
      {item.variants.map((v) => {
        const label = single ? item.name : v.label;
        const ref = onScreen ? "" : `${item.code.toLowerCase()} `;
        const text = single ? (onScreen ? "mine" : `mine ${item.code.toLowerCase()}`) : `mine ${ref}${v.label.toLowerCase()}`;
        const key = `${item.code}:${v.label}`;
        const myHold = mine.find((h) => h.code === item.code && h.variant === v.label && (h.state === "Holding" || h.state === "Waiting"));
        const kind = myHold ? (myHold.state === "Holding" ? "yours" : "inline") : v.available > 0 ? "claim" : "line";
        const inFlight = busy === key;
        const yoursLeft = myHold?.deadlineAt && now ? new Date(myHold.deadlineAt).getTime() - now : windowSeconds * 1000;
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
              onClick={() => onClaim(text, key, onScreen ? label : `${item.code} ${label}`)}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-display text-[1.0625rem] leading-none font-extrabold capitalize">{label}</span>
                {(kind === "claim" || kind === "line") && !inFlight && <Plus />}
                {kind === "yours" && <span className="font-mono text-[0.875rem] font-bold num">{mmss(yoursLeft)}</span>}
              </span>
              <span className="text-[0.8125rem] leading-tight text-ink-muted">
                {kind === "claim" &&
                  !inFlight &&
                  (v.available === 1 ? (
                    <span className="font-semibold text-serial">Last one</span>
                  ) : (
                    <>
                      <span className="font-mono text-ink num">{v.available}</span> left
                    </>
                  ))}
                {kind === "line" && !inFlight && `Sold out · join the line${v.waiting > 0 ? ` (${v.waiting})` : ""}`}
                {inFlight && "Reading…"}
                {kind === "yours" && "Yours, pay below"}
                {kind === "inline" && action}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function BottomBar({
  snap,
  now,
  payNow,
  passedNotice,
  onClaimAgain,
  onDismissNotice,
  waitingCopy,
  waitingPosition,
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
  passedNotice: SnapshotHold | null;
  onClaimAgain: (h: SnapshotHold) => void;
  onDismissNotice: () => void;
  waitingCopy: SnapshotHold | null;
  waitingPosition: number | null;
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
            className="mb-3 flex h-15 items-center justify-between gap-3 bg-rail pr-2 pl-4 text-rail-ink hover:bg-rail-deep active:translate-y-px"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex flex-col leading-tight">
                <span className="font-display text-[1.125rem] font-extrabold whitespace-nowrap">Pay {money(payNow.priceCents * payNow.qty)}</span>
                <span className="text-[0.8125rem] text-rail-muted">with PayPal · copy {copyNo(payNow.serial)}</span>
              </span>
              <ArrowOut />
            </span>
            <span className="pr-1.5">
              <Countdown ms={left} tone={expiring ? "expiring" : "rail"} size="lg" />
            </span>
          </a>
        )}
        {passedNotice && (
          <div role="alert" className="mb-3 flex items-center justify-between gap-3 bg-serial py-2 pr-2 pl-4 text-white">
            <p className="min-w-0 text-[0.9375rem] leading-snug">
              <span className="font-display font-extrabold">Copy {copyNo(passedNotice.serial)} passed.</span>{" "}
              {passedNotice.endReason === "cancelled" ? "It was cancelled." : "Time ran out before payment."}
            </p>
            <span className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => onClaimAgain(passedNotice)} disabled={busy !== null} className="h-10 bg-white px-3 font-display text-[0.9375rem] font-extrabold text-serial disabled:opacity-70">
                Claim again
              </button>
              <button type="button" onClick={onDismissNotice} className="h-10 px-2 text-[0.875rem] underline" aria-label="Dismiss">
                OK
              </button>
            </span>
          </div>
        )}
        {!payNow && !passedNotice && waitingCopy && (
          <a href="#mine" className="mb-3 flex h-11 items-center justify-between gap-3 border border-rule bg-waiting px-4 text-[0.9375rem]">
            <span>
              <span className="label mr-2">Waiting</span>
              No. {waitingPosition ?? 1} in line for {waitingCopy.code} {waitingCopy.singleVariant ? waitingCopy.itemName : waitingCopy.variant}
            </span>
            <span className="text-[0.8125rem] font-semibold underline">Your copy</span>
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
