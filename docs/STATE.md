# State
_Last verified: 2026-11-08 09:40 UTC at 0e1e0dd_

**Thesis:** Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.
**Milestone:** M0, M1, **M2 done** (2026-11-08 03:18 UTC, E-026 … E-031) → **M3 · Proof surface** (freeze 2026-11-11 17:48 UTC) · **Deadline:** 2026-11-12 20:00 UTC (time left: the clock line)
**Next action:** draft the Devpost submission (`internal/SUBMISSION.md`, M4) with line-level permalinks; then the benchmark re-run and the RUNOFSHOW backup (docs/PLAN.md).
**Blocked on:** nothing.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| Gate | lint (0 warnings), typecheck, 102 tests (also on a clean clone with no env), build; eval 63 / 63 (regex-only baseline 25 / 63, 18 claims missed), 0 phantom | E-007, E-035 |
| **Video, public on YouTube** (https://youtu.be/xT-LaMUCcXg, cut 4, 2:13.3; played logged-out, E-034): one item's life on the deployed stall; Pidgin and Taglish read by Groq; pass to the next buyer; the ledger agent reading PayPal before she pays; PAID via PayPal; Hawker's widgets and the agent's chart after; 9 of 9 refusals; joy-miners source on the opening card. Fresh judges: cut 1 18, cut 2 19, cut 3 18 /25 | rendered from a real session (show 5) + a ledger re-shoot | E-032, E-033, E-034 |
| Independent re-review | design 27/40 (was 25), measured audit no P0, benchmark 17/24; P1/P2 fixed or settled | E-031, D-021 |
| Landing hero and trace show the AI reading one real copy end to end | deployed: first @joy.cebu911 “akin yung xl po” (E-031); since the film, No. 0045 @amaka.lagos “abeg I go take the XL” (Groq) → PASSED → @jasmine.manila | E-031, E-032 |
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
| Repo (**public**, MIT, D-023) | GitHub | https://github.com/emmanuelist/hawker | 2026-11-08 10:20 UTC (anonymous clone ok; web page pending GitHub's incident) |
| Demo video (public) | YouTube | https://youtu.be/xT-LaMUCcXg | 2026-11-08 09:35 UTC |
| Web service `hawker` (free plan, D-011), AG Studio trial key set (T-27); Hawker icon (0e1e0dd) | Render (Oregon) | https://hawker-8q2t.onrender.com · `/` · `/s/ada` · `/desk` · `/ledger` | 2026-11-08 09:22 UTC at 0e1e0dd |
| Database `hawker` in `neon-red-garden` (D-015), migrations 001–003; live show 5 “Sunday Live” | Neon (US East 1) | see CONTEXT.md | 2026-11-08 04:00 UTC |

## Broken or unverified
- The repo page logged out: not yet seen (GitHub returned 503 to all unauthenticated web requests during an incident, E-036).
- Ledger agent delegation to Studio's lead agent works on the deployed ledger but is unreliable on free models (unconfigured KPI, then "busy"; T-26, E-033); not in the video.
- On the deployed stall Groq once read the Taglish “sakin na lang yung L po” as a question (safe: no hold); the same phrase passed in the eval run after. Now an eval case.
- Slow-4G LCP re-measured at 2.9–3.1 s (TTFB 0.7–1.1 s on Render free), above E-025's 2.4–2.8 s.
- The physical PAID buzz needs a real Android phone to feel; iOS Safari has no Vibration API.
- Demo data carries test handles (`@race.619`, `@handoff.a950`, `@bench.141`): real holds; film from a fresh session (D-021).
- Both models down at once: the on-screen "fast path only" state isn't re-verified this session.
- One unexplained transient (E-031): the landing pad briefly read "Waiting for the first claim" with an empty stream snapshot.
- Why Groq failed on one deployed call (E-020): unknown without Render logs.

## Claims (docs/EVIDENCE.md)
- C-1 … C-21 verified 2026-11-07/08; every factual sentence on `/`, the stall, the ledger, the video, its YouTube description and the README has a row.

## Design
- World: Invoice Pad (D-012), pushed in D-016, reviewed and fixed in D-017; ledger booklet (D-019); refusals (D-020); M2-close fixes (E-031). Reviews run as two isolated sub-agents.

## Open questions
- None open. Submission draft next (M4).
