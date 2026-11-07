# State
_Last verified: 2026-11-07 09:20 UTC at the first commit (foundation)_

**Thesis:** Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.
**Milestone:** M0 · Rigged (checkpoint 2026-11-07 22:06 UTC) · **Deadline:** 2026-11-12 20:00 UTC (time left: the clock line)
**Next action:** confirm CI green on GitHub, then deploy the hello-world to Render and confirm `/api/health` from a phone on cellular (PLAN M0 items 4–5).
**Blocked on:** Render dashboard access: the user connects the repo and applies the $50 credit.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| Local gate on the hello-world app | `npm run lint && npm run typecheck && npm test && npm run build` exit 0 | first commit |
| PayPal sandbox invoice create → send → pay → PAID; cancel → CANCELLED; tracking | pre-build spike, sandbox REST | E-001, E-002 |
| Orders v2 capture + tracking (fallback rail); payouts to a PayPal email | pre-build spike | E-003, E-004 |
| Comment parsing on free models (Groq Qwen 300/300, Gemini Flash-Lite 178/180) | pre-build spike | E-005 |
| Anonymous Twitch chat read | pre-build spike | E-006 |

## Deployed
| What | Environment | URL | Last checked |
|---|---|---|---|
| nothing yet | — | — | — |

## Broken or unverified
- No product code yet. The claim engine, parser client, PayPal client and ingest start in M1.
- Database choice is open (D-002 consequence); decide at the start of M1.
- Design direction not set; run `impeccable shape` before the first real UI.
- Whether the Render credit can be applied without a card: unverified (D-008).

## Claims not yet verified
- C-1 the thesis: needs the hold ledger on the deployed app (M2).
- C-2 multilingual parsing: needs the committed eval in `eval/` and the app's own model client (M1/M3).

## Open questions
- none
