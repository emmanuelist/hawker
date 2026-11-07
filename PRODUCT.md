# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **The seller.** A Lagos fashion seller (Ankara, Adire, beaded accessories) who sells by live stream to customers at home and in the diaspora (US, UK). Buyers abroad pay in USD with PayPal. The seller streams from a phone and talks to the camera; they don't operate Hawker mid-stream. (Confirmed 2026-11-07.)
- **The helper.** A partner or assistant on a laptop beside the seller who works the Hawker board during the live sale. They set which item is on screen, watch holds form from the chat, watch payments land, and watch unpaid holds pass to the next buyer. They're under time pressure while the chat scrolls fast. (Confirmed 2026-11-07.)
- **The buyer.** A viewer of the live stream, often abroad, usually on a phone. They open the stall link the seller pins on the live, type as they normally would ("gold one for me abeg"), and see their numbered copy appear with a countdown and Pay with PayPal, all on one screen. (Confirmed 2026-11-07; stall page per D-013.)

## Product Purpose

Live sellers lose stock and sales to people who type "mine" and never pay. Today the claims are written in a notebook, invoices are typed by hand into DMs, and an item can sit "reserved" for days.

Hawker reads the live chat (English, Nigerian Pidgin, Taglish, emoji) and turns each claim into a timed hold. Each buyer gets one PayPal invoice for their held items. If the timer runs out, the hold passes automatically to the next buyer in line.

Success is that every hold ends one of two ways, paid through PayPal or passed to the next buyer, with no notebook, no hand-typed invoices and no item stuck with a non-payer.

## Positioning

The claim, used verbatim everywhere: **"Every hold ends one of two ways: paid through PayPal, or passed to the next buyer."**

- **What's different:** chat arrival order decides who holds an item, code enforces the timer, and PayPal is the only way a hold becomes Paid. The AI only reads what buyers meant; it never decides who gets an item.
- **Why PayPal:** buyers abroad can pay a small Lagos seller with buyer protection, in USD, with PayPal, card or Pay Later, and no buyer email is needed (shareable invoices).
- **Known neighbour:** one other hackathon entry (live-desk) uses a buyer-side budget hold. Hawker is seller-side, invoice per buyer, with timed passing.

## Operating Context

- **During a live sale:**
  - The seller holds up an item and says its code and variants ("A3, the beaded clutch, red, gold or black").
  - The helper marks it as on screen.
  - Viewers comment: "mine gold", "M2 black", "I go take 2", "akin yung black", "cancel my red", "how much?".
- **After the sale:** payments land over the next minutes; unpaid holds pass to the waitlist; shipping follows, and tracking is attached to PayPal for Seller Protection.
- **Chat source:** the Hawker stall page (D-013). The seller pins the stall link on any live (Instagram, TikTok, YouTube), and buyers claim there. Twitch chat reading is an optional extra. TikTok, Facebook Live and Instagram chats are not read; they need platform approval (D-010).
- **Money:** USD; PayPal sandbox during the hackathon.
- **Hold lifecycle:** `Waiting` (in line) → `Holding` (timer running, invoice open) → `Paid` | `Passed`. These four words are used everywhere: UI, API, data, logs, README.

## Capabilities and Constraints

- **Parsing:** a regex fast path, then a model.
  - Models: Groq `qwen/qwen3.8-27b`, failing over to Gemini `gemini-3.5-flash-lite`, both on free tiers.
  - Measured: 300/300 and 178/180 commerce-critical on 60 labelled comments, with 0 phantom claims (E-005).
  - Unclear comments ("red", "L") hold nothing and get a clarifying reply.
- **Invariants:**
  - Before passing a hold, Hawker re-reads PayPal; a paid invoice is never passed.
  - No partial payments.
  - No manual mark-paid and no seller override (D-005).
- **Hosting:** Render free plan, which sleeps after 15 minutes idle. The app must keep itself warm, and all state lives in an external database (D-011).
- **Undecided:**
  - default payment-window length (demo uses a short window, disclosed);
  - database provider.

## Brand Commitments

- Name: **Hawker** (a street seller calling out wares). One word. Never paired with category nouns.
- The thesis sentence above, verbatim, on the repo, README, video and submission.
- The state vocabulary `Waiting`, `Holding`, `Paid`, `Passed`.

## Evidence on Hand

- PayPal sandbox proofs:
  - invoices paid and cancelled, tracking, payouts, Orders fallback (`docs/evidence/E-001`…`E-004`);
  - a screenshot of PayPal's hosted invoice page showing Pay in 4 (`docs/evidence/E-001-hosted-invoice-page.png`).
- Parsing eval inputs and results (`docs/evidence/E-005-parsing-free-apis.md`, `eval/spike-2026-11-07/`).
- Live deployment: https://hawker-8q2t.onrender.com (E-008, E-009).
- **Absent, never fabricate:**
  - no real seller has used Hawker;
  - there are no customer quotes, testimonials, sales figures or adoption numbers.
  - The demo store is the builder's own demo catalog and is labelled as such.
- Industry context: the joy reserver problem is anecdotal from press (Philippine Star, The Sun Malaysia); no quantified study exists.

## Product Principles

1. **The claim is the product.** Every hold visibly ends Paid or Passed; nothing on any surface implies a third ending.
2. **Code decides, the AI reads.** Show what the buyer actually wrote next to what Hawker understood, so a misread is visible and correctable.
3. **The helper never hunts.** At a glance under time pressure: what's on screen, who holds what, how long is left, what just got paid, what just passed.
4. **The buyer is abroad and on a phone.** The hold page is light, fast on mobile data, and goes straight to PayPal.
5. **Real or nothing.** Every value comes from the chat, the database or PayPal. A replayed session is labelled as a replay.

## Accessibility & Inclusion

- Target WCAG 2.2 AA.
- Paid and Passed are never told apart by colour alone: each ending carries a word and a mark.
- Countdown rings respect `prefers-reduced-motion` and always show the time as text.
- Buyer pages must work on a small phone over a slow mobile connection.
- Chat text is shown as written (Pidgin, Taglish, emoji), never "corrected".
