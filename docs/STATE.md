# State
_Last verified: 2026-11-07 14:55 UTC at d2beaa1_

**Thesis:** Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.
**Milestone:** M1 **done** → design pass (D-016) → independent review + fixes (D-017) → **M2 · Core claim** (checkpoint 2026-11-10 22:09 UTC) · **Deadline:** 2026-11-12 20:00 UTC (time left: the clock line)
**Next action:** the user confirms the remaining M2 items (hold ledger in AG Studio, last-second payment through the UI, the refusals panel; phase gate, AGENTS rule 3); then write them into docs/PLAN.md and start the first.
**Blocked on:** nothing.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| Gate | lint (0 warnings), typecheck, 70 tests, build at d2beaa1 | E-007 |
| Landing: live pad, labelled replay of the latest real ending, server-rendered first view | deployed: replay Holding at 2 s, stamped by 5.5 s; LCP 2.4 / 2.2 s on slow 4G | E-025 |
| Stall: tap/typed claims, earlier-on-this-live, release, passed notice + Claim again, 30 s warning | deployed flows (No. 0014–0016) | E-025 |
| Stall first view from the server; controls wait for hydration | slow 4G: LCP 2.8 / 2.3 s (was 6.4 / 5.0); joined at 6.6 s, URL clean | E-025 |
| Desk: next-in-line, tear-off, stubs, questions pinned, P/N, one h1, visible focus on the rail | deployed 1024–1440 | E-022, E-025 |
| Passed → next buyer with a new invoice; Taglish/Pidgin/English read | deployed | E-023, E-020 |
| Real sandbox payment → PAID stamp in 8.1 s | deployed | E-016 |
| A passed invoice can't be paid late | deployed | E-017 |
| Keep-warm on Render free | deployed | E-021 |
| Engine, parser (incl. tapped claims and named cancels), PayPal client, DB invariants | `npm test` 70, earlier E-010 – E-014 | — |

## Deployed
| What | Environment | URL | Last checked |
|---|---|---|---|
| Repo (private, D-009) | GitHub | https://github.com/emmanuelist/hawker | 2026-11-07 14:41 UTC |
| Web service `hawker` (free plan, D-011) | Render (Oregon) | https://hawker-8q2t.onrender.com · `/` · `/s/ada` · `/desk` | 2026-11-07 14:50 UTC at d2beaa1 |
| Database `hawker` in `neon-red-garden` (D-015), migrations 001–002 | Neon (US East 1) | see CONTEXT.md | 2026-11-07 14:50 UTC |

## Broken or unverified
- No after-score yet: the fixes address all 7 priority issues of the review (E-024), but no independent re-review has scored them.
- Paid count is 1 against 12+ Passed on the demo stall; run real sandbox payments before the film (D-017).
- A last-second payment racing the expiry through the UI (B1 in the browser): proven at PayPal (E-012) and in engine tests only.
- The buyer's PAID moment after the redesign (stamp across the copy, vibration): built, not exercised with a payment since.
- Code doesn't yet answer stock questions ("is the L still there?") from the catalog; they read as questions for the seller.
- Why Groq failed on one deployed call (E-020): unknown without Render logs.

## Claims (docs/EVIDENCE.md)
- C-1 … C-9 verified 2026-11-07; every factual sentence on `/` has a row.

## Design
- World: Invoice Pad (D-012), pushed in D-016, reviewed and fixed in D-017. Reviews run as two isolated sub-agents.

## Open questions
- The remaining M2 items (see the next action).
