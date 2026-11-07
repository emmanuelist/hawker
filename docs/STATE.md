# State
_Last verified: 2026-11-07 10:47 UTC at 4404e14_

**Thesis:** Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.
**Milestone:** M0 · Rigged **done** 09:47 UTC → **M1 · Walking skeleton** (checkpoint 2026-11-09 13:24 UTC) · **Deadline:** 2026-11-12 20:00 UTC (time left: the clock line)
**Next action:** once `DATABASE_URL` (Neon, pooled) is in `.env`: `npm run db:migrate && npm run db:seed`, then build the service layer (claim → hold → invoice, expiry sweeper with the B1 re-read, payment poll), then the stall `/s/ada` and desk `/desk` per the direction contract (PLAN M1).
**Blocked on:** the user creating the Neon project and pasting `DATABASE_URL` into `.env` (and later into Render's environment), D-014.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| Gate, locally and in CI | lint (0 warnings), typecheck, 57 tests, build, all green at 4404e14 | E-007 |
| Hello-world live on Render free plan | `/api/health` returns the deployed commit; loads on a phone over mobile data | E-008, E-009 |
| Claim engine rules (resolve, claim/wait/duplicate, B1 ending, strict FIFO, cents) | `npm test` (27 tests) | src/lib/domain/engine.test.ts |
| Parsing through the app pipeline | `npm run eval`: 60/60 commerce-critical, 0 phantom, Groq→Gemini failover exercised | E-010 |
| PayPal shareable invoice client | `npm run sandbox:invoice`: create→UNPAID→cancel→CANCELLED; 2nd cancel refused `INVOICE_CANCELED_ALREADY` | E-011 |
| PayPal refuses cancelling a PAID invoice (B1 at PayPal) | live call: 422 `CANNOT_CANCEL_PAID_INVOICE` | E-012 |

## Deployed
| What | Environment | URL | Last checked |
|---|---|---|---|
| Repo (private, D-009) | GitHub | https://github.com/emmanuelist/hawker | 2026-11-07 |
| Web service `hawker` (free plan, D-011), auto-deploys `main` | Render | https://hawker-8q2t.onrender.com | 2026-11-07 09:43 UTC (E-008), still the hello-world |

## Broken or unverified
- `db/migrations/001_init.sql` and `scripts/seed.ts` are written but **never run** (no database yet).
- No service layer, stall or desk UI yet.
- Keep-warm loop not built; the Render free plan sleeps after 15 min idle (D-011).

## Claims not yet verified
- C-1 the thesis: needs the hold ledger on the deployed app (M2).
- C-2 multilingual parsing: verified on the eval set (E-010); unverified on the deployed stall.

## Design
- World: Invoice Pad (D-012); buyer surface = stall page (D-013).
- Contract: `.impeccable/surfaces/src-app-desk-page-tsx.md`. Brief: `internal/design/BRIEF-shape.md`. PRODUCT.md written.

## Open questions
- none
