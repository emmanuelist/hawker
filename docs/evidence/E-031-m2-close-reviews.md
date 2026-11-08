# E-031 · M2 close: two independent reviews, the benchmark, and the fixes (2026-11-08)

Run on the deployed build 191e7b8 (the fixes landed in facab37 and 66dfed5 while review B was
still measuring, so some of B's numbers predate them; noted below). Same method as E-024 so the
scores compare: A = design review (no detector), B = detector + measured browser evidence, as two
isolated sub-agents that never saw each other's report or E-024's score. Raw screenshots and scripts
stayed in `.playwright-mcp/review-a|b/` (gitignored, local only); this file is the durable summary.

## A · Design review: 27/40 (Acceptable; was 25/40 in E-024)
Desk 28, stall 27, ledger 25, landing 23/32 (≈29/40; H7 and H10 n/a). Verdict: authored for this
product, not a template; strongest on the desk and the refusals panel ("real PayPal 422 codes and
real Postgres constraint names … the most convincing proof section"); weakest in the landing's story
(the AI never visibly reading), the ledger's AG Studio defaults, and small screens.

Priority issues as reported, and what happened:
| # | Issue | Fix |
|---|---|---|
| P1 | Landing never shows the AI reading: every example is English shorthand; "A model reads…" shows "fast path" | Replay and trace now use the latest copy a model read (snapshot `showcase`): @joy.cebu911 “akin yung xl po” → A2 · XL, read by Groq, 0.3 s (facab37) |
| P1 | Hero chat line and copy were different buyers; test-looking handles | The chat line is always the comment of the copy on the pad (facab37); test handles stay (real data, D-021); film from a fresh session |
| P1 | PASSED stamp wrapped mid-handle at 390/320 | One line, ellipsis if very long (facab37); measured single line at 390 and 320 |
| P1 | Ledger not linked; blank ~11 s on first load | Linked from the landing nav and the desk; the desk logo links home; live counts while Studio loads (facab37) |
| P2 | Ledger: Studio defaults, cropped grid, chart told apart by colour only | Legend on the endings charts (facab37); Send/placeholder contrast and 11 px tags (66dfed5); cropping and edit mode kept (D-021) |
| P2 | Release: 113×21 px, irreversible, next to the Pay bar | 44 px control with an inline confirm, "Keep it" focused (facab37) |
| P2 | Desk at 390 clipped; the mobile landing sent phones there | Desk says it's for a laptop; the mobile landing's one action is the stall (facab37) |
| P3 | "mine l" reads as "mine I"; "hold 53" vs No. 0036; insert attempts cited an existing copy | Tapped claims keep the catalog's spelling ("mine M"); refusals show the hold id beside the copy and say "a new copy" (facab37) |

## B · Detector + measurements
- **Detector** (URL mode timed out on the open event stream; re-run with `--cdp`): landing, stall, desk 1–2 advisories each (stragglers; em dashes in outcome strings); ledger 56 warnings (47 small text, 5 nested cards inside AG Studio, 2 low contrast, 1 marquee, 1 bounce easing); `src/app` 1 advisory (overshoot easing on the number wheels, off under reduced motion).
- **Failures, P1:** AG Studio's Send 2.59:1 and placeholder 3.2:1 on the ledger → fixed, measured 8.29:1 and 6.48:1 (66dfed5).
- **P2:** slow-4G LCP `/` 3.12 / 2.67 s, `/s/ada` 2.94 / 2.89 s (TTFB 0.66–1.08 s on Render free; E-025 measured 2.4/2.2 and 2.8/2.3 s): not changed this pass. Ledger text at 10–10.5 px → 11 px (66dfed5). Release 113×21 px → measured before facab37; now 121×44. Landing Replay 42×20 px → 44 px target (66dfed5).
- **P3:** 11 px uppercase print labels (landing 30, stall 30–43, desk 143 nodes): a world-level choice, kept; ledger h1 name ran into its subtitle → fixed; no skip link → added; desk targets 39 px (laptop surface, kept).
- **Passed:** no overflow in 12 surface/width combinations (incl. Holding at 320/390); 0 contrast failures on landing, stall and desk (193 / 166 / 810 text nodes; stamps 5.50:1 red, 7.25:1 blue after blend); one h1 per page, no skipped levels, no unnamed controls; every focus stop visible (2 px #2a3a8f, 8.29:1); 0 console errors or failed requests in 12 loads; CLS 0.0002–0.003; reduced motion stills the replay, the ledger ticker, the refusals reply and the desk; the ledger's Amount column no longer truncates.
- **Not measured:** physical devices and screen readers; the desk/ledger keyboard walk. One unexplained transient at 03:08 UTC: the landing pad read "Waiting for the first claim" with `holds: []` in the stream for a few minutes (before facab37; the showcase now keeps the pad filled when no recent copy exists).

## Benchmark (internal/benchmarks/2026-11-08-191e7b8.md): 17/24
Rubric 2 · Evidence 2 · Differentiation 2 · Integration 3 · Resilience 3 · Measurable 2 · Demo 1 · First screen 2.
Top finding: judges score from the video and the repo, and neither exists in judge-visible form yet; M3 is now the whole score. Resilience: 10 of 10 failure paths handled on the deployed build (deep links, injection read as chatter with 0 holds, double tap → 1 copy, reload mid-hold, 32 quick attempts → 429 with a message, cold first screens).

## The PAID buzz on a phone (deployed, Android emulation, real payments)
Pixel 7 profile (412×839, Android 14 Chrome UA), a spy on `navigator.vibrate`, the invoice paid from a desktop window:
- Visible stall: `vibrate([24, 60, 48])` called once at PAID; the stamp landed at 466–545 px of 839, above the comment bar (779).
- Stall hidden while PayPal confirmed (191e7b8): no call while hidden; on becoming visible, one call, **accepted by Chrome (returned true)**, stamp mid-screen.
- iOS Safari has no Vibration API (MDN browser-compat-data: Safari `version_added: false`, iOS mirrors it); Firefox for Android returns true without vibrating. The physical buzz itself needs a real Android device to feel.
Capture: `E-031-stall-paid-phone.png`, `E-031-landing-hero-1440.png`.
