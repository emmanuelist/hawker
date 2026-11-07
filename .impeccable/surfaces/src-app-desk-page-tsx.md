---
version: 1
slug: "src-app-desk-page-tsx"
primary_target: "src/app/desk/page.tsx"
related_targets: ["src/app/s/[stall]/page.tsx"]
---

# Surface brief: desk `/desk` and stall `/s/[stall]`

**Mode:** Operate (both). The landing page `/` gets its own Persuade brief in M2.

**Audience and task:**
- **Desk:** the helper on a laptop (1280–1600 px) beside a Lagos seller mid-live. They set what's on screen and see, at a glance, who holds what, what's about to pass, and what just ended.
- **Stall:** a buyer abroad on a phone (390 px, mobile data). They type a claim, see their numbered copy, and pay on PayPal before the timer ends.

**Constraints:** PRODUCT.md, D-005 (four states, B1–B3), D-012 anti-goals, WCAG 2.2 AA, `prefers-reduced-motion`, real data only (the demo store labelled).

**Memorable moment:** the stamp landing on a copy.
- **PAID:** carbon-blue, read from PayPal.
- **PASSED → @next:** red. The grey copy tears off and the next buyer's copy shows underneath.

**Unresolved:** none blocking M1. The PASSED tear-off reaches full fidelity in M2.

## Direction contract

**THESIS:** Each hold is a numbered carbon copy that ends under one of two stamps. This refuses the category default: a white dashboard of order rows with status pills.

**OWN-WORLD:**
- Ground and copies:
  - Cool board ground `#E6EAF2`; a carbon-blue `#2A3A8F` header rail.
  - State copies: Holding = yellow `#F3DD6A`, Waiting = blue `#CFE0F5`, Paid = white `#FBFCFD` + blue stamp, Passed = grey `#D9DBDE` + red stamp.
  - Red serials `#CF2530`; ink `#171717`.
- Faces:
  - Libre Franklin 800–900 for codes, stamps and labels (uppercase, tracked);
  - Public Sans for UI;
  - Courier Prime for serials, IDs and filled-in fields.
- Material: 1px rules, square corners, copies with a perforated top edge. No paper texture.

**STORY:** The helper sees what's on screen, who holds what and what's about to pass. They trust it because every ending carries PayPal IDs, and they act with one key (N, next item).

**FIRST VIEWPORT:**
- **Header rail:** wordmark, stall, LIVE, reader status, and state counters as copy-tint chips.
- **Left 320 px:** the on-screen code at display scale (~120 px) with variant stock and the next-item control.
- **Centre:** the pad. Holding copies are ordered by time left, each with a serial, handle, the buyer's own words, item, invoice ID, and an exact-length countdown edge.
- **Right 360 px:** chat as written, with Hawker's reading and its source.
- **Foot:** the endings tape.
- **Stall:** item and stock on top, your copy and Pay with PayPal in the middle, the comment box at the bottom.

**FORM:** The Lagos market sales-invoice booklet: numbered duplicate copies and rubber stamps. Position 1 on my ordered list (Impeccable's pick; the roll assigned 4). seed:a46554d5d343f377

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
