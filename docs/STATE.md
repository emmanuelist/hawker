# State
_Last verified: 2026-11-07 09:45 UTC at ba911fb_

**Thesis:** Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.
**Milestone:** M0 · Rigged **done** 09:47 UTC → next M1 · Walking skeleton (checkpoint 2026-11-09 13:24 UTC) · **Deadline:** 2026-11-12 20:00 UTC (time left: the clock line)
**Next action:** on the user's go-ahead, start M1: `impeccable shape` for the seller board and Hold card, choose the external free database (D-011), then break M1 into work items in PLAN.md.
**Blocked on:** nothing.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| Gate on the hello-world app, locally and in CI | local gate exit 0; GitHub Actions run green | E-007 |
| PayPal sandbox invoice create → send → pay → PAID; cancel → CANCELLED; tracking | pre-build spike, sandbox REST | E-001, E-002 |
| Orders v2 capture + tracking (fallback rail); payouts to a PayPal email | pre-build spike | E-003, E-004 |
| Comment parsing on free models (Groq Qwen 300/300, Gemini Flash-Lite 178/180) | pre-build spike | E-005 |
| Anonymous Twitch chat read | pre-build spike | E-006 |

## Deployed
| What | Environment | URL | Last checked |
|---|---|---|---|
| Repo (private, D-009) | GitHub | https://github.com/emmanuelist/hawker | 2026-11-07 |
| Web service `hawker` (free plan, D-011), auto-deploys from `main` | Render | https://hawker-8q2t.onrender.com (health: `/api/health`) | 2026-11-07 09:43 UTC, commit ba911fb (E-008); phone on mobile data 09:47 UTC (E-009) |

## Broken or unverified
- No product code yet. The claim engine, parser client, PayPal client and ingest start in M1.
- Database choice is open (D-002 consequence); decide at the start of M1.
- Design direction not set; run `impeccable shape` before the first real UI.
- Render free plan sleeps after 15 min idle (D-011); the keep-warm loop isn't built yet (M1).

## Claims not yet verified
- C-1 the thesis: needs the hold ledger on the deployed app (M2).
- C-2 multilingual parsing: needs the committed eval in `eval/` and the app's own model client (M1/M3).

## Open questions
- none
