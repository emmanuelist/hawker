# Plan
Build window: 2026-10-01 16:15 UTC → 2026-11-12 20:00 UTC
Started: 2026-11-07 09:00 UTC
Deadline source: https://paypalaihackathon.devpost.com/rules §1 ("Thursday Nov 12, 2026 (12:00 pm Pacific Time)"). Buffer: 10% of the window counted from Started (13.1 h). Freeze: 80% of the window or 48 h before the deadline, whichever is later.

| # | Milestone | When | Exit criteria (a stranger could check these) | Due | Status |
|---|---|---|---|---|---|
| M0 | Rigged | 10% | D-001 recorded; riskiest dependencies spiked with evidence; hello-world deployed to production on Render, `/api/health` reachable from a phone on cellular | 2026-11-07 22:06 UTC | in progress |
| M1 | Walking skeleton | 40% | On the deployed app, one real Twitch chat comment travels every layer: parsed (fast path or a real model call) → hold persisted in the database → shareable PayPal sandbox invoice created → hold shown on the board, live | 2026-11-09 13:24 UTC | |
| M2 | Core claim | 65% | The thesis end to end with real data: one hold ends `Paid` (buyer pays, status re-read from PayPal) and one ends `Passed` (timer expires → invoice cancelled → next buyer holds with a new invoice), both visible in the hold ledger; seller board in AG Studio | 2026-11-10 22:09 UTC | |
| M3 | Proof surface | freeze | README proof section; parsing eval committed and re-runnable; every claim has a verified row; demo video recorded; `benchmark` run | 2026-11-11 17:48 UTC | |
| M4 | Submitted | deadline − buffer | Devpost form submitted with the verbatim thesis; YouTube video public, < 3 min; repo public with license in About; preflight passed from a phone on cellular | 2026-11-12 06:54 UTC | |

## Work items (sprint profile)
### M0 · Rigged
- [x] D-001 build choice recorded, done when DECISIONS.md has it (D-001)
- [x] Riskiest dependencies spiked, done when evidence exists for PayPal invoice pay/cancel/track (E-001, E-002), Orders + payouts (E-003, E-004), parsing on free models (E-005), Twitch read (E-006)
- [x] Repo committed with the gate green locally (4d9e725), done when `npm run lint && npm run typecheck && npm test && npm run build` exits 0 at the first commit
- [x] GitHub remote + CI green (E-007), done when the first CI run on `main` passes (private, D-009)
- [ ] Hello-world on Render, done when `curl https://<service>.onrender.com/api/health` returns `ok: true` with the deployed commit SHA, and it loads from a phone on cellular

### M1 · Walking skeleton
- [ ] Placeholder: break down at the start of M1. First item: run `impeccable shape` for the seller board before writing UI.

### M2 · Core claim
- [ ] Placeholder

### M3 · Proof surface
- [ ] Placeholder

## Cut list
Things deliberately not being built. Each entry links the DECISIONS entry that cut it.
- TikTok / Facebook Live / Instagram comment ingest. These need platform approval; stated as a README limit. D-010
- Photo-of-shipping-label OCR. D-010
- Multi-seller accounts. D-010
- Venmo payouts. Not supported in the sandbox (E-004). D-010
