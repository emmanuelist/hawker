# State
_Last verified: 2026-11-07 11:25 UTC at 8932580_

**Thesis:** Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.
**Milestone:** M0 · Rigged **done** 09:47 UTC → **M1 · Walking skeleton** (checkpoint 2026-11-09 13:24 UTC) · **Deadline:** 2026-11-12 20:00 UTC (time left: the clock line)
**Next action:** the user adds `DATABASE_URL` to the Render service's environment; then verify the M1 round trip on https://hawker-8q2t.onrender.com (stall comment → hold + invoice → desk live), record the evidence, and close M1.
**Blocked on:** `DATABASE_URL` missing on Render (the deployed stream reports `DATABASE_URL not set`). The user adds it in the dashboard.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| Gate, locally and in CI | lint (0 warnings), typecheck, 57 tests, build, all green at 4404e14 | E-007 |
| Hello-world live on Render free plan | `/api/health` returns the deployed commit; loads on a phone over mobile data | E-008, E-009 |
| Claim engine rules (resolve, claim/wait/duplicate, B1 ending, strict FIFO, cents) | `npm test` (27 tests) | src/lib/domain/engine.test.ts |
| Parsing through the app pipeline | `npm run eval`: 60/60 commerce-critical, 0 phantom, Groq→Gemini failover exercised | E-010 |
| PayPal shareable invoice client | `npm run sandbox:invoice`: create→UNPAID→cancel→CANCELLED; 2nd cancel refused `INVOICE_CANCELED_ALREADY` | E-011 |
| PayPal refuses cancelling a PAID invoice (B1 at PayPal) | live call: 422 `CANNOT_CANCEL_PAID_INVOICE` | E-012 |
| Database on Neon with DB-enforced invariants | migrate + seed; DB refused Holding-without-invoice and Paid→Passed | E-013 |
| Service layer end to end (hold, wait, expire→pass→promote, cancel; invoices CANCELLED at PayPal) | `npm run e2e:service` 9/9 (re-run after the perf change) | E-014 |
| Stall + desk live in the browser, including the PASSED → @next reversal | local production build on real Neon + PayPal sandbox | E-015 |

## Deployed
| What | Environment | URL | Last checked |
|---|---|---|---|
| Repo (private, D-009) | GitHub | https://github.com/emmanuelist/hawker | 2026-11-07 |
| Web service `hawker` (free plan, D-011), auto-deploys `main` | Render | https://hawker-8q2t.onrender.com | 2026-11-07 09:43 UTC (E-008), still the hello-world |

## Broken or unverified
- The deployed app can't reach the database until `DATABASE_URL` is set on Render.
- PAID through the UI (buyer pays the hosted invoice → poll → PAID stamp) is not yet exercised in the browser; the PayPal side is proven (E-001, E-012).
- Latency: a fast-path claim took ~13 s locally from Lagos (≈20 queries × ~200 ms to US East). Two fixes shipped (8932580); remeasure on Render.
- The client doesn't yet show the SSE `oops` event (it stays on "Opening…").
- Keep-warm is built (scheduler, `RENDER_EXTERNAL_URL`) but unverified on Render.

## Claims not yet verified
- C-1 the thesis: needs the hold ledger on the deployed app (M2).
- C-2 multilingual parsing: verified on the eval set (E-010); unverified on the deployed stall.

## Design
- World: Invoice Pad (D-012); buyer surface = stall page (D-013).
- Contract: `.impeccable/surfaces/src-app-desk-page-tsx.md`. Brief: `internal/design/BRIEF-shape.md`. PRODUCT.md written.

## Open questions
- none
