# State
_Last verified: 2026-11-07 12:50 UTC at 2fe7219_

**Thesis:** Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.
**Milestone:** M1 · Walking skeleton **done** 12:48 UTC → **M2 · Core claim** (checkpoint 2026-11-10 22:09 UTC) · **Deadline:** 2026-11-12 20:00 UTC (time left: the clock line)
**Next action:** the user confirms the M2 work items (proposed in chat at the M1 close; phase gate, AGENTS rule 3); then write them into docs/PLAN.md and start the first one.
**Blocked on:** nothing.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| Gate, locally and in CI | lint (0 warnings), typecheck, 57 tests, build; CI run 42372203619 green at 2fe7219 | E-007 |
| **M1 round trip on the deployed app, paid for real (sandbox)** | stall comment → hold + invoice → stall and desk live → buyer pays on PayPal → PAID stamp 8.1 s later; PayPal reads `PAID` with txn `82433159Y3061500A` | E-016 |
| A passed hold can't be paid late | paying copy No. 0003's invoice after it passed: PayPal shows "This invoice was canceled.", stays `CANCELLED`, 0 paid | E-017 |
| Model path on the deployed app | Pidgin claim read by Gemini after a Groq failure; next comment read by Groq | E-020 |
| Keep-warm on Render free | 20 min with no requests from us; uptime 19 → 1220 s, same process | E-021 |
| A database outage never strands the page | unreachable DB → "Can't read the stall · retrying"; recovered to Live without a reload | E-018 |
| Desk fits 1024 / 1280 / 1440 px | scrollWidth = innerWidth; stamps inside copies | E-019 |
| Claim engine, parsing eval, PayPal client and refusals, DB invariants, service e2e | `npm test`, `npm run eval`, `npm run sandbox:invoice`, `npm run e2e:service` (earlier this session) | E-010 – E-014 |
| PASSED → @next hand-off in the browser | local production build | E-015 |

## Deployed
| What | Environment | URL | Last checked |
|---|---|---|---|
| Repo (private, D-009) | GitHub | https://github.com/emmanuelist/hawker | 2026-11-07 12:24 UTC |
| Web service `hawker` (free plan, D-011), auto-deploys `main` | Render (Oregon) | https://hawker-8q2t.onrender.com · stall `/s/ada` · desk `/desk` | 2026-11-07 12:47 UTC at 2fe7219 (E-020, E-021) |
| Database `hawker` in Neon project `neon-red-garden` (D-015) | Neon (US East 1) | see CONTEXT.md | 2026-11-07 12:47 UTC |

## Broken or unverified
- Why Groq failed on one deployed call (E-020): unknown without Render logs; failover covered it.
- Whether a checkout attempt on a cancelled invoice leaves an authorization on the buyer's account (E-017): not checked.
- A last-second payment racing the expiry on the deployed app (B1 path through the UI): proven at PayPal (E-012) and in the engine tests, not exercised in the browser.
- The stall's join form and composer at 320 px; the desk below 1024 px: not rendered.

## Claims not yet verified
- C-1 the thesis: both endings shown on the deployed app (E-016, E-017); still needs the hold ledger and judge-runnable checks (M2/M3).
- C-2 multilingual parsing: eval set (E-010) and Pidgin on the deployed stall (E-020); Taglish unverified there.

## Design
- World: Invoice Pad (D-012); buyer surface = stall page (D-013).
- Contract: `.impeccable/surfaces/src-app-desk-page-tsx.md`. Brief: `internal/design/BRIEF-shape.md`. PRODUCT.md written.

## Open questions
- The M2 work items (see the next action).
