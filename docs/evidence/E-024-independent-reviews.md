# E-024 · Two independent reviews of the deployed UI (2026-11-07)

Run as two isolated sub-agents on the live build (5fbae7f / ddba840 code), per the impeccable
critique method: A = design review (no detector output), B = detector + measured browser evidence.
Neither saw the other's report. Raw screenshots and scripts stayed in `.playwright-mcp/review-a|b/`
(gitignored, local only); this file is the durable summary.

## A · Design review: 25/40 (Acceptable)
Desk ≈27, stall ≈25, landing ≈21/32 (H7, H10 n/a). Verdict: authored for this product, not a
category template; strongest on the desk and the stall's Holding state; weakest below the landing
hero and in imagery.

Priority issues (as reported):
1. P1 The landing contradicted its thesis: "went back to stock" under "Two endings. No third.";
   the hero usually showed a stale passed copy; counters 1 paid vs 10–11 passed.
2. P1 A buyer's pass was invisible and a dead end (Pay bar vanished, stamp off-screen, no way on).
3. P1 At 320 px the Pay button's timer was clipped; tiles wrapped 2+1.
4. P1 One-tap claim with no undo or release.
5. P2 Cold-start blank screens ("Opening…" ×5 on the landing for 2–5 s).
6. P2 Buyer chat showed operator detail (model, latency) and stale "Held … pay within 3:00".
7. P2 The desk's "→ @next" was 8.6 px rotated text.
Single biggest lever named: make the hero always show a stamp landing (a labelled replay of the
latest real chain when nothing is live, per PRODUCT.md principle 5).

## B · Detector + measurements
- CLI regex scan: `[]` (an undercount: element rules don't run in CLI mode). In-page overlay
  (injected inline): landing 17, stall 22, desk 35 findings, almost all undersized text (10 px print
  labels; `span.stamp-to` 8.64 px on desk stubs).
- Measured failures: landing at 320 px clipped (hero scrollWidth 364); targets under 44 px on the
  landing header and links (24 px); desk had 0 h1; the desk's Sound button focus ring was invisible
  on the rail (1.00:1); 13 stub rows truncated at 1024 px hiding the amount; stall LCP on slow 4G
  6416 / 5024 ms.
- Passed: 0 contrast failures across ~470 text nodes; no unnamed controls; 0 console errors or
  failed requests; logical keyboard order with visible rings elsewhere (8.29–9.73:1); reduced
  motion honoured; Paid/Passed never by colour alone.
