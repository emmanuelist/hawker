# State
_Last verified: 2026-11-08 03:20 UTC at 66dfed5_

**Thesis:** Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.
**Milestone:** M0, M1, **M2 done** (2026-11-08 03:18 UTC, E-026 … E-031) → **M3 · Proof surface** (freeze 2026-11-11 17:48 UTC) · **Deadline:** 2026-11-12 20:00 UTC (time left: the clock line)
**Next action:** M3 item 1, the film session: a fresh run on the demo stall with natural handles (docs/PLAN.md), then the video. The benchmark's top finding: judges score from the video and the repo, and neither is judge-visible yet.
**Blocked on:** nothing. The user decides when the repo goes public (D-009).

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| Gate | lint (0 warnings), typecheck, 102 tests, build at 66dfed5; eval 0 phantom / 0 missed | E-007, E-030 |
| Independent re-review | design 27/40 (was 25), measured audit no P0, benchmark 17/24; P1/P2 fixed or settled | E-031, D-021 |
| Landing hero and trace show the AI reading one real copy end to end | deployed: @joy.cebu911 “akin yung xl po” → A2 · XL (Groq, 0.3 s) → PASSED → @dami.lagos911 | E-031 |
| **Every way out, refused** (landing `#refusals`): 9 live attempts; migration 003 makes an ended hold final | deployed: 9 of 9 refused in 11.2 s; hand-off still works under the guard | E-029 |
| Ledger as a sales booklet (`/ledger`, D-019), linked from the landing and desk; legends on endings charts; contrast fixed | deployed | E-028, E-031 |
| Real sandbox payments → PAID 8–13 s after Pay; buyer's copy comes to mid-screen; buzz waits for a visible tab and is accepted by Chrome (Android emulation) | deployed | E-030, E-031 |
| Resilience: deep links, prompt injection (0 holds), double tap (1 copy), reload mid-hold, rate limits with a message | deployed | E-031 |
| Stall: tap/typed claims (Taglish “akin yung” on the fast path), release with a confirm, waiting line, passed notice | deployed | E-025, E-028, E-030, E-031 |
| Desk: next-in-line, tear-off, stubs, questions pinned; laptop notice on phones | deployed | E-022, E-025, E-031 |
| Last-second payment: 1.4 s before → Passed and PayPal refuses; 12 s before → Paid | deployed | E-027 |
| Keep-warm on Render free | deployed | E-021 |

## Deployed
| What | Environment | URL | Last checked |
|---|---|---|---|
| Repo (private, D-009) | GitHub | https://github.com/emmanuelist/hawker | 2026-11-08 03:15 UTC |
| Web service `hawker` (free plan, D-011), AG Studio trial key set (T-27) | Render (Oregon) | https://hawker-8q2t.onrender.com · `/` · `/s/ada` · `/desk` · `/ledger` | 2026-11-08 03:20 UTC at 66dfed5 |
| Database `hawker` in `neon-red-garden` (D-015), migrations 001–003 | Neon (US East 1) | see CONTEXT.md | 2026-11-08 03:20 UTC |

## Broken or unverified
- No video, no README proof, repo private: the M3 work, and the benchmark's whole remaining score.
- Slow-4G LCP re-measured at 2.9–3.1 s (TTFB 0.7–1.1 s on Render free), above E-025's 2.4–2.8 s.
- The physical PAID buzz needs a real Android phone to feel; iOS Safari has no Vibration API.
- Demo data carries test handles (`@race.619`, `@handoff.a950`, `@bench.141`): real holds; film from a fresh session (D-021).
- Both models down at once: the on-screen "fast path only" state isn't re-verified this session.
- One unexplained transient (E-031): the landing pad briefly read "Waiting for the first claim" with an empty stream snapshot.
- Why Groq failed on one deployed call (E-020): unknown without Render logs.

## Claims (docs/EVIDENCE.md)
- C-1 … C-13 verified 2026-11-07/08; every factual sentence on `/`, the stall and the ledger has a row.

## Design
- World: Invoice Pad (D-012), pushed in D-016, reviewed and fixed in D-017; ledger booklet (D-019); refusals (D-020); M2-close fixes (E-031). Reviews run as two isolated sub-agents.

## Open questions
- When the repo goes public (D-009): the user's call; needed before submission.
