# State
_Last verified: 2026-11-07 19:45 UTC at 3ff24bf_

**Thesis:** Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.
**Milestone:** M1 **done** → design pass (D-016) → independent review + fixes (D-017) → **M2 · Core claim** (ledger, last-second payment, ledger booklet D-019 done) (checkpoint 2026-11-10 22:09 UTC) · **Deadline:** 2026-11-12 20:00 UTC (time left: the clock line)
**Next action:** M2 item 3, the refusals panel “Every way out, refused” (docs/PLAN.md).
**Blocked on:** nothing.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| Gate | lint (0 warnings), typecheck, 90 tests, build at 3ff24bf | E-007 |
| **Ledger as a sales booklet** (`/ledger`, D-019): sheets with binding bands, stamp filter on number wheels (cross-filters, own counts whole), stub cells, agent receipts, ticker, live motion only for live changes, reduced motion stilled | deployed: new copy slid in 6.3 s after a tap, countdown right on first frame, PayPal receipt for the open copy, release → stamp landed 4.3 s later | E-028 |
| Hold ledger in AG Studio: real holds, custom widgets; Hawker's agent with PayPal/totals/chart tools, delegating to Studio's agents | deployed, three agent questions answered | E-026, E-028 |
| A tap right after joining claims (was dropped) | deployed No. 0022, local No. 0020–0021 | E-028 |
| Landing: live pad, labelled replay of the latest real ending, server-rendered first view | deployed: replay Holding at 2 s, stamped by 5.5 s; LCP 2.4 / 2.2 s on slow 4G | E-025 |
| Stall: tap/typed claims, earlier-on-this-live, release, passed notice + Claim again, 30 s warning | deployed flows (No. 0014–0016, 0019, 0022) | E-025, E-028 |
| Desk: next-in-line, tear-off, stubs, questions pinned, P/N, one h1, visible focus on the rail | deployed 1024–1440 | E-022, E-025 |
| Passed → next buyer with a new invoice; Taglish/Pidgin/English read | deployed | E-023, E-020 |
| Real sandbox payment → PAID stamp in 8.1 s | deployed | E-016 |
| A payment in the last seconds: 1.4 s before → Passed and PayPal refuses it; 12 s before → Paid; never both | deployed | E-027 |
| A passed invoice can't be paid late | deployed | E-017 |
| Keep-warm on Render free | deployed | E-021 |
| Engine, parser (incl. tapped claims and named cancels), PayPal client, DB invariants, ledger live diff | `npm test` 90 | — |

## Deployed
| What | Environment | URL | Last checked |
|---|---|---|---|
| Repo (private, D-009) | GitHub | https://github.com/emmanuelist/hawker | 2026-11-07 19:30 UTC |
| Web service `hawker` (free plan, D-011), AG Studio trial key set (T-27) | Render (Oregon) | https://hawker-8q2t.onrender.com · `/` · `/s/ada` · `/desk` · `/ledger` | 2026-11-07 19:45 UTC at 3ff24bf |
| Database `hawker` in `neon-red-garden` (D-015), migrations 001–002 | Neon (US East 1) | see CONTEXT.md | 2026-11-07 19:45 UTC |

## Broken or unverified
- No after-score yet: no independent re-review has scored the D-017 fixes or the D-019 ledger.
- Paid count is 2 against 20 Passed on the demo stall (test copies No. 0019–0022 added Passed); run real sandbox payments before the film (D-017).
- The buyer's PAID moment after the redesign (stamp across the copy, vibration): built, not exercised with a payment since.
- Ledger: the stamp sound is built, not heard in a test (needs a real audio check); open-ended edits delegated to Studio's agents depend on Gemini's free quota (T-26).
- Ledger at 1024 px: Studio's canvas scrolls sideways under its side panels (Studio's own minimum width); long items and comments truncate with an ellipsis in the grid.
- Code doesn't yet answer stock questions ("is the L still there?") from the catalog; they read as questions for the seller.
- Why Groq failed on one deployed call (E-020): unknown without Render logs.

## Claims (docs/EVIDENCE.md)
- C-1 … C-9 verified 2026-11-07; every factual sentence on `/` has a row. The ledger adds no public claim.

## Design
- World: Invoice Pad (D-012), pushed in D-016, reviewed and fixed in D-017; the ledger as a booklet with motion (D-019). Reviews run as two isolated sub-agents.

## Open questions
- The remaining M2 items (see the next action).
