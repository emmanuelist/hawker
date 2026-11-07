# Plan
Build window: 2026-10-01 16:15 UTC → 2026-11-12 20:00 UTC
Started: 2026-11-07 09:00 UTC
Deadline source: https://paypalaihackathon.devpost.com/rules §1 ("Thursday Nov 12, 2026 (12:00 pm Pacific Time)"). Buffer: 10% of the window counted from Started (13.1 h). Freeze: 80% of the window or 48 h before the deadline, whichever is later.

| # | Milestone | When | Exit criteria (a stranger could check these) | Due | Status |
|---|---|---|---|---|---|
| M0 | Rigged | 10% | D-001 recorded; riskiest dependencies spiked with evidence; hello-world deployed to production on Render, `/api/health` reachable from a phone on cellular | 2026-11-07 22:06 UTC | **done** 2026-11-07 09:47 UTC (E-008, E-009) |
| M1 | Walking skeleton | 40% | On the deployed app, one real comment typed on the stall page travels every layer: parsed (fast path or a real model call) → hold persisted in the database → shareable PayPal sandbox invoice created → the buyer's copy on the stall and the hold on the desk, both live | 2026-11-09 13:24 UTC | **done** 2026-11-07 12:48 UTC (E-016, E-020, E-021) |
| M2 | Core claim | 65% | The thesis end to end with real data: one hold ends `Paid` (buyer pays, status re-read from PayPal) and one ends `Passed` (timer expires → invoice cancelled → next buyer holds with a new invoice), both visible in the hold ledger; seller board in AG Studio | 2026-11-10 22:09 UTC | |
| M3 | Proof surface | freeze | README proof section; parsing eval committed and re-runnable; every claim has a verified row; demo video recorded; `benchmark` run | 2026-11-11 17:48 UTC | |
| M4 | Submitted | deadline − buffer | Devpost form submitted with the verbatim thesis; YouTube video public, < 3 min; repo public with license in About; preflight passed from a phone on cellular | 2026-11-12 06:54 UTC | |

## Work items (sprint profile)
### M0 · Rigged
- [x] D-001 build choice recorded, done when DECISIONS.md has it (D-001)
- [x] Riskiest dependencies spiked, done when evidence exists for PayPal invoice pay/cancel/track (E-001, E-002), Orders + payouts (E-003, E-004), parsing on free models (E-005), Twitch read (E-006)
- [x] Repo committed with the gate green locally (4d9e725), done when `npm run lint && npm run typecheck && npm test && npm run build` exits 0 at the first commit
- [x] GitHub remote + CI green (E-007), done when the first CI run on `main` passes (private, D-009)
- [x] Hello-world on Render (E-008, E-009), done when `curl https://hawker-8q2t.onrender.com/api/health` returns `ok: true` with the deployed commit SHA and it loads from a phone on cellular

### M1 · Walking skeleton
- [x] Design direction set: Invoice Pad (D-012); stall page as the buyer surface (D-013)
- [x] Database (E-013): Neon free Postgres (D-014), schema + migrations, done when `npm run db:migrate` applies cleanly to Neon (`db: ok` health check moves to the service item, since `/api/health` must not touch the DB per D-014)
- [x] Claim engine (pure) rules (`src/lib/domain/engine.ts`, 27 tests): comments → holds / waitlist / cancel / expiry → pass, invariants B1–B3, done when `npm test` covers claim, over-stock waitlist, cancel, expiry-pass, a pay-vs-expiry race, and unknown-variant clarify
- [x] Parser (E-010: eval 60/60, 0 phantom, failover exercised): regex fast path + one model client (Groq → Gemini failover, timeout, retries, request-ID logs), done when `npm run eval` re-runs the 60-comment set through the app's own client with 0 phantom claims
- [x] PayPal client (E-011, E-012): token cache + terminate, shareable invoice create / send / get / cancel, done when `npm run sandbox:invoice` creates, reads and cancels a real sandbox invoice
- [x] Direction contract recorded (`.impeccable/surfaces/src-app-desk-page-tsx.md`) before any UI code, done when `impeccable surface-brief read src/app/desk/page.tsx` shows all six blocks + seed reference
- [x] Stall page `/s/[stall]` (E-015, local): on-screen item, live stock, comment box, the buyer's numbered copy with countdown and Pay with PayPal, done when a comment typed on a phone creates a hold and shows its invoice link
- [x] Desk `/desk` (E-015, local): on-screen control, holds live over SSE, chat with parse results, done when that hold appears on the desk without a reload
- [x] Deployed (E-016, E-020, E-021): the M1 round trip works on hawker-8q2t.onrender.com, with keep-warm that never touches the database. Fast-path claim → hold + invoice → stall and desk live → paid on PayPal → PAID stamp 8.1 s later (E-016); Pidgin claim read by the model path (Gemini after a Groq failover; Groq on the next comment) (E-020); idle 20 min, uptime 19 → 1220 s (E-021)

### M2 · Core claim
- [x] Done early in the design pass (D-016, E-022, E-023): landing `/` with the live pad; the PASSED tear-off on the desk; Passed → next buyer with a new invoice verified on the deployed app
- [x] Independent review + fix pass (D-017, E-024, E-025): earlier-on-this-live claims, release / leave the line, passed notice with Claim again, labelled landing replay, server-rendered first views, measured fixes (320 px, targets, h1, focus, LCP 6.4 → 2.8 s)
- [x] **Hold ledger in AG Studio** (E-026, D-018; `/ledger`, confirmed 2026-11-07): an AG Studio dashboard over the stall's real holds, in the Invoice Pad theme, with custom widgets (the copy and its stamp; Paid vs Passed; who still owes now) and a Studio agent wired to Hawker's own model client (Groq → Gemini). Done when the deployed `/ledger` shows every ended hold as Paid with its PayPal transaction or Passed → next, the custom widgets and theme render, and the agent answers "who still owes right now?" from live data. Evidence: screenshots + the agent's transcript.
- [x] **Last-second payment through the UI (B1 in the browser)** (E-027): a buyer pays in the final seconds of a hold. Done when a deployed run ends PAID (not Passed) with the B1 path visible, or, if payment lands after the cancel, PayPal refuses it and the copy ends Passed; never both. Evidence: timings, invoice reads, desk capture.
- [x] **Every way out, refused** (refusals panel; E-029, D-020: also migration 003, an ended hold is final): a judge can try each forbidden ending against the real system and see the real refusal: PayPal won't cancel a paid invoice (`CANNOT_CANCEL_PAID_INVOICE`) or cancel twice (`INVOICE_CANCELED_ALREADY`); the database won't end a hold twice, move Paid → Passed, or hold without an invoice (trigger and constraint names); a passed invoice can't be paid. Probes run in rolled-back transactions and are rate-limited. Done when each probe runs on click on the deployed app and shows its live code and time. Evidence: captures.
- [x] Several real sandbox payments, so Paid isn't 1 against 12+ Passed before the film (D-017): Paid 11 · Passed 25 (E-030)
- [ ] M2 close: independent re-review by two isolated agents (D-017) for an after-score; `benchmark`

### M3 · Proof surface
- [ ] Placeholder

## Cut list
Things deliberately not being built. Each entry links the DECISIONS entry that cut it.
- TikTok / Facebook Live / Instagram comment ingest. These need platform approval; stated as a README limit. D-010
- Scripted chat replay. Not needed now that judges can type on the stall. D-013
- Photo-of-shipping-label OCR. D-010
- Multi-seller accounts. D-010
- Venmo payouts. Not supported in the sandbox (E-004). D-010
