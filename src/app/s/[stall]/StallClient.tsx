"use client";
// The buyer's phone screen (D-013): what's on screen, your copies, the comment box, the chat.
import { useMemo, useRef, useState } from "react";
import { Copy } from "@/components/Copy";
import { money, useLiveSnapshot, useServerNow } from "@/components/live";
import type { SnapshotHold } from "@/lib/service/snapshot";

const order: Record<SnapshotHold["state"], number> = { Holding: 0, Waiting: 1, Paid: 2, Passed: 3 };

export function StallClient({ stall }: { stall: string }) {
  const [nonce, setNonce] = useState(0);
  const { snap, offset, link } = useLiveSnapshot(stall, "stall", nonce);
  const now = useServerNow(offset);
  const [announce, setAnnounce] = useState("");

  const me = snap?.me ?? null;
  const mine = useMemo(
    () =>
      (snap?.holds ?? [])
        .filter((h) => me && h.buyerId === me.buyerId)
        .sort((a, b) => order[a.state] - order[b.state] || b.serial - a.serial),
    [snap, me],
  );

  // Announce changes to *my* copies once, politely (one live region per page). React's
  // "store information from previous renders" pattern: compare with the previous list during render.
  const [prevMine, setPrevMine] = useState(mine);
  if (prevMine !== mine) {
    const before = new Map(prevMine.map((h) => [h.id, h.state]));
    const msgs: string[] = [];
    for (const h of mine) {
      const prev = before.get(h.id);
      if (prev && prev !== h.state) {
        if (h.state === "Holding") msgs.push(`Copy ${h.serial} is held for you. Pay before the timer ends.`);
        if (h.state === "Paid") msgs.push(`Copy ${h.serial} is paid. It's yours.`);
        if (h.state === "Passed") msgs.push(`Copy ${h.serial} passed${h.passedTo ? ` to @${h.passedTo}` : ""}.`);
      }
    }
    setPrevMine(mine);
    if (msgs.length) setAnnounce(msgs.join(" "));
  }

  if (!snap) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[30rem] items-center justify-center px-4">
        <p className="text-ink-muted">{link === "gone" ? "This stall isn't live right now." : "Opening the stall…"}</p>
      </main>
    );
  }

  const item = snap.items.find((i) => i.code === snap.onScreen) ?? null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[30rem] flex-col px-4 pb-40">
      <h1 className="sr-only">
        {snap.stall.name} — {snap.show.title}
      </h1>
      <div className="flex items-center justify-between gap-3 pt-4 pb-3">
        <p className="font-display text-[0.95rem] font-black tracking-[0.12em] uppercase">Hawker</p>
        <p className="flex items-center gap-2 text-[0.8125rem] text-ink-muted">
          <span className={`inline-block size-2 rounded-full ${link === "live" ? "bg-[#1f7a3f]" : "bg-serial"}`} aria-hidden="true" />
          {link === "live" ? "Live" : link === "reconnecting" ? "Reconnecting…" : "Connecting…"}
        </p>
      </div>

      <p className="text-[0.9375rem] font-semibold">
        {snap.stall.name} · {snap.show.title}
        {snap.stall.isDemo && <span className="ml-2 font-mono text-[0.75rem] font-normal text-ink-muted">demo store</span>}
      </p>

      {item ? (
        <section aria-labelledby="onscreen" className="mt-4 border-y border-rule py-4">
          <div className="flex items-end justify-between gap-4">
            <h2 id="onscreen" className="font-display text-[4.5rem] leading-[0.82] font-black tracking-[-0.03em]">
              {item.code}
            </h2>
            <div className="pb-1 text-right">
              <p className="font-semibold leading-tight">{item.name}</p>
              <p className="font-mono text-lg font-bold num">{money(item.priceCents)}</p>
            </div>
          </div>
          <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-2">
            {item.variants.map((v) => (
              <li key={v.label} className={`border border-rule px-3 py-2 ${v.available > 0 ? "bg-paid" : "bg-passed"}`}>
                <p className="font-semibold capitalize">{v.label}</p>
                <p className="text-[0.8125rem] text-ink-muted num">
                  {v.available > 0 ? `${v.available} left` : "sold out"}
                  {v.waiting > 0 && ` · ${v.waiting} in line`}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.8125rem] text-ink-muted">
            Type what you want, the way you would on the live: “mine gold”, “M2 black”, “I go take 2”. Holds last{" "}
            {Math.round(snap.stall.windowSeconds / 60)} min{snap.stall.isDemo ? " (demo window)" : ""}.
          </p>
        </section>
      ) : (
        <p className="mt-4 border-y border-rule py-4 text-ink-muted">The seller hasn&rsquo;t put an item on screen yet.</p>
      )}

      {me && mine.length > 0 && (
        <section aria-labelledby="mine" className="mt-6">
          <h2 id="mine" className="font-display text-lg font-extrabold">
            Your copies
          </h2>
          <div className="mt-3 grid gap-4">
            {mine.map((h) => (
              <Copy key={h.id} hold={h} now={now} windowSeconds={snap.stall.windowSeconds} variant="stall" payable />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="chat" className="mt-8">
        <h2 id="chat" className="font-display text-lg font-extrabold">
          The chat
        </h2>
        {snap.comments.length === 0 ? (
          <p className="mt-2 text-ink-muted">No comments yet. Be first.</p>
        ) : (
          <ol className="mt-2 divide-y divide-rule">
            {snap.comments.slice(0, 14).map((c) => (
              <li key={c.seq} className="py-2.5">
                <p className="text-[0.8125rem] font-semibold">
                  @{c.handle}
                  {c.mine && <span className="ml-1.5 font-normal text-ink-muted">you</span>}
                </p>
                <p className="[overflow-wrap:anywhere]">{c.text}</p>
                {c.outcome ? (
                  <p className="mt-0.5 text-[0.8125rem] text-ink-muted">{c.outcome}</p>
                ) : (
                  !c.intent && <p className="mt-0.5 text-[0.8125rem] text-ink-muted">Reading…</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>

      <Composer stall={stall} joined={!!me} handle={me?.handle ?? null} onJoined={() => setNonce((n) => n + 1)} />
    </main>
  );
}

function Composer({ stall, joined, handle, onJoined }: { stall: string; joined: boolean; handle: string | null; onJoined: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function join(handleValue: string) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/stalls/${encodeURIComponent(stall)}/buyer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handleValue }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) setNote({ text: json.error ?? "Couldn't join. Try again.", error: true });
      else onJoined();
    } catch {
      setNote({ text: "No connection. Try again.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function send(text: string) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/stalls/${encodeURIComponent(stall)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = (await res.json()) as { outcome?: string | null; error?: string };
      if (!res.ok) setNote({ text: json.error ?? "That didn't send. Try again.", error: true });
      else {
        setNote(json.outcome ? { text: json.outcome, error: false } : null);
        if (inputRef.current) inputRef.current.value = "";
      }
    } catch {
      setNote({ text: "No connection. Your comment wasn't sent.", error: true });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-rule bg-board/95 backdrop-blur-[2px]">
      <div className="mx-auto max-w-[30rem] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {note && (
          <p className={`mb-2 text-[0.875rem] ${note.error ? "text-serial" : "text-ink"}`} role="status">
            {note.text}
          </p>
        )}
        {joined ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = inputRef.current?.value.trim();
              if (v) void send(v);
            }}
          >
            <label htmlFor="comment" className="sr-only">
              Comment as @{handle}
            </label>
            <input
              id="comment"
              ref={inputRef}
              name="comment"
              maxLength={280}
              autoComplete="off"
              enterKeyHint="send"
              placeholder={`Comment as @${handle}: “mine gold”`}
              className="h-12 min-w-0 flex-1 border border-rule bg-paid px-3 text-base placeholder:text-ink-muted"
              disabled={busy}
            />
            <button type="submit" disabled={busy} className="h-12 bg-rail px-5 font-display font-extrabold text-rail-ink disabled:opacity-60">
              {busy ? "Reading…" : "Send"}
            </button>
          </form>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = new FormData(e.currentTarget).get("handle");
              if (typeof v === "string" && v.trim()) void join(v.trim().toLowerCase());
            }}
          >
            <label htmlFor="handle" className="sr-only">
              Your name in the chat
            </label>
            <input
              id="handle"
              name="handle"
              required
              minLength={2}
              maxLength={25}
              pattern="[a-zA-Z0-9._]{2,25}"
              autoComplete="nickname"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="Your name in the chat, e.g. funmi.dc"
              className="h-12 min-w-0 flex-1 border border-rule bg-paid px-3 text-base placeholder:text-ink-muted"
              disabled={busy}
            />
            <button type="submit" disabled={busy} className="h-12 bg-rail px-5 font-display font-extrabold text-rail-ink disabled:opacity-60">
              {busy ? "Joining…" : "Join"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
