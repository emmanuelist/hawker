# State
_Last verified: 2026-11-07 13:40 UTC at ddba840_

**Thesis:** Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.
**Milestone:** M1 **done** 12:48 UTC → design pass done (D-016) → **M2 · Core claim** (checkpoint 2026-11-10 22:09 UTC) · **Deadline:** 2026-11-12 20:00 UTC (time left: the clock line)
**Next action:** the user confirms the remaining M2 items (hold ledger in AG Studio, last-second payment through the UI, the refusals panel; phase gate, AGENTS rule 3); then write them into docs/PLAN.md and start the first.
**Blocked on:** nothing.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| Gate, locally and in CI | lint (0 warnings), typecheck, 57 tests, build at ddba840 | E-007 |
| Landing `/`: the claim beside a live pad, real trace, real Paid/Passed copies, one-click checks | deployed render 1440/390, console clean | E-022 |
| Stall: one-tap claims (`via = 'tap'`, shown "tapped"), Pay bar, line position, PAID stamp | deployed + local renders 320/390 | E-022 |
| Desk: next-in-line on Holding copies, tear-off into stubs, blank next copy when empty | deployed + local renders 1024/1280/1440 | E-022 |
| Passed → next buyer with a new invoice, on the deployed app | No. 0010 PASSED → @dami.lagos911, No. 0011 Holding `INV2-N7FY…L5VW` | E-023 |
| Taglish, Pidgin and English read on the deployed stall | “akin yung xl po” → Groq claim; Pidgin E-020; English E-016 | E-023 |
| Real sandbox payment → PAID stamp in 8.1 s | deployed | E-016 |
| A passed invoice can't be paid late | deployed | E-017 |
| Keep-warm on Render free (uptime 19 → 1220 s idle) | deployed | E-021 |
| A database outage never strands the page | local, unreachable DB → retry → recovered | E-018 |
| Engine, parsing eval, PayPal client + refusals, DB invariants, service e2e | earlier this session | E-010 – E-014 |

## Deployed
| What | Environment | URL | Last checked |
|---|---|---|---|
| Repo (private, D-009) | GitHub | https://github.com/emmanuelist/hawker | 2026-11-07 13:27 UTC |
| Web service `hawker` (free plan, D-011), auto-deploys `main` | Render (Oregon) | https://hawker-8q2t.onrender.com · `/` · `/s/ada` · `/desk` | 2026-11-07 13:35 UTC at ddba840 |
| Database `hawker` in `neon-red-garden` (D-015), migrations 001–002 | Neon (US East 1) | see CONTEXT.md | 2026-11-07 13:27 UTC |

## Broken or unverified
- A last-second payment racing the expiry through the UI (B1 in the browser): proven at PayPal (E-012) and in engine tests only.
- Why Groq failed on one deployed call (E-020): unknown without Render logs; failover covered it.
- Whether a checkout attempt on a cancelled invoice leaves an authorization (E-017): not checked.
- The buyer's PAID moment (stamp across the copy + vibration) after this design pass: built, not yet exercised with a real payment.
- One desk tab was found scrolled (scrollTop 199) after the hand-off; not reproduced with live updates (stays 0). Likely a person scrolling the shared browser.

## Claims (docs/EVIDENCE.md)
- C-1 … C-8 verified 2026-11-07; every factual sentence on `/` has a row. README checks for C-1 still to come (M3).

## Design
- World: Invoice Pad (D-012), pushed in D-016. Contract: `.impeccable/surfaces/src-app-desk-page-tsx.md`. Critique snapshot (local, gitignored): `.impeccable/critique/`.

## Open questions
- The remaining M2 items (see the next action).
