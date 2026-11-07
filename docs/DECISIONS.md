# Decisions
Append-only. To change a decision, add a new entry that supersedes it.

## D-001 · Build Hawker, a seller-side live-sale desk · 2026-11-07 · accepted
**Context:** The PayPal AI Hackathon is open-theme. Judges score 1–5 on five equally weighted criteria (implementation, design, impact, innovation, presentation), mostly from the video. One project can win at most one Grand or Honorable Mention prize plus one Sponsor prize. Of the ~297 public repos made for this event, the crowded lanes are agent spend firewalls (~25), freelancer invoicing and escrow (~25), disputes and fraud (~18) and shopping agents (~20).
**Decision:**
- Build a live-sale desk. AI reads live-stream comments; code commits holds in chat order; each buyer gets a PayPal invoice; unpaid holds expire and pass to the next buyer.
- Target a Grand Prize or Honorable Mention (Most Creative, Best Demo Delivery, Best Use of Agentic Commerce), plus Best Use of AG Grid.
**Alternatives:**
- Mutual-aid payouts desk: lower Design and Presentation ceiling, and Venmo payouts are unsupported in the sandbox.
- WebMCP agent-ready storefront: a direct twin was already submitted (ShopBridge).
- Savings circle: a strong entrant exists (susu-steward).
- Accessibility assistant: PayPal isn't load-bearing.
**Consequences:**
- Revisit if a re-scan on 2026-11-10 finds three or more finished live-selling entries.
- One known live-selling entrant (live-desk) uses a buyer-side budget hold; ours is seller-side, invoice per buyer.
**Evidence:** internal/research/DOSSIER.md §2–§7 (gitignored); spikes E-001…E-006.

## D-002 · Stack: one Next.js 16 app, one persistent Node service on Render · 2026-11-07 · accepted
**Context:** Chat ingest is a long-lived socket, and hold timers must fire on time whether or not anyone has the page open.
**Decision:**
- Single Next.js 16.4.5 app (App Router), run with `next start` as a Render web service, which is a persistent process.
- Live updates to the board over Server-Sent Events.
- Versions as pinned in AGENTS.md.
**Alternatives:**
- Serverless hosting (e.g. Vercel functions): rejected. There is no persistent process for the chat socket or timers.
- A separate background worker: deferred; it adds a second service and cost before it's needed.
**Consequences:** the ingest loop and timer sweeper must survive restarts, so their state lives in the database, not in memory. The database choice is made at the start of M1.
**Evidence:** Next 16 self-hosting guide (`node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`).

## D-003 · Payment rail: PayPal Invoicing v2 shareable invoices; Orders v2 as fallback · 2026-11-07 · accepted
**Context:** Buyers are chat handles with no email. The rail needs a payable link, cancellation (for Passed), and a status read.
**Decision:**
- One shareable invoice per buyer: created with no recipient, sent with `send_to_recipient:false`, which yields a payer link and a QR code.
- Cancel on expiry.
- Payment state comes from `GET /v2/invoicing/invoices/{id}`. `INVOICING.INVOICE.PAID` / `CANCELLED` webhooks are confirmation only.
**Alternatives:** Orders v2 with buyer approval and capture. It works end to end (E-003), but its capture webhook never arrived, and an order needs our own checkout page. It's kept as the fallback.
**Consequences:**
- The app's sandbox REST app must keep the Invoicing feature enabled.
- After any feature change, the OAuth token must be terminated (CONTEXT trap T-1).
**Evidence:** E-001, E-002, E-003; the no-email invoice test on 2026-11-07 (E-001 note).

## D-004 · AI on free tiers: Groq Qwen 3.8 27B primary, Gemini 3.5 Flash-Lite failover · 2026-11-07 · accepted
**Context:** The user will not pay for model APIs. The hosted demo must work for judges, who have no keys of their own.
**Decision:**
- A regex fast path handles common claims.
- Leftovers go in micro-batches to Groq `qwen/qwen3.8-27b`, with failover to Gemini `gemini-3.5-flash-lite` on 429/503.
- Fast-path-only operation is a visible degraded mode.
**Alternatives:**
- Anthropic API: paid.
- `openai/gpt-oss-120b`: 56/60, with quantity and multi-item errors.
- `gemini-3.8-flash`: didn't finish a run in about 20 minutes.
- The user's Claude Code subscription: not for powering a public app.
**Consequences:**
- Groq's free limits are 1,000 requests a day and 8,000 tokens a minute, so the system prompt stays short and calls are batched.
- Google may use free-tier inputs. Acceptable, since all data is sandbox or demo.
**Evidence:** E-005.

## D-005 · The thesis and its invariants · 2026-11-07 · accepted
**Decision:** The claim is "Every hold ends one of two ways: paid through PayPal, or passed to the next buyer." It is enforced as invariants:
- B1: re-read PayPal before passing; PAID is never passed.
- B2: `allow_partial_payment:false`.
- B3: no manual mark-paid and no seller override.
- State vocabulary: `Waiting` → `Holding` → `Paid` | `Passed`.
**Alternatives:** the names Baton, Chit, Spoken, Temi, Earmark, Dibs and Tally were rejected for collisions (internal/THESIS.md).
**Consequences:** any feature that would create a third ending (manual paid, seller cancel without passing, partial payment) is out unless this entry is superseded.
**Evidence:** internal/THESIS.md (break test).

## D-006 · Solo scope cuts · 2026-11-07 · proposed: needs the user's confirmation
**Context:** one builder, about 4.5 days of build time after the buffer.
**Decision:** chat ingest is Twitch (anonymous read-only IRC) plus real-time replay of a recorded session, labelled as a replay. Not built:
- TikTok, Facebook Live and Instagram ingest (each needs platform API approval)
- photo-of-label OCR
- multi-seller accounts
- Venmo payouts (unsupported in the sandbox, E-004)
**Alternatives:** YouTube Live chat ingest is possible with an API key and an owned broadcast. It's deferred, not rejected.
**Consequences:** the README Limits section says which platforms are and aren't read.

## D-007 · Repo visibility · 2026-11-07 · proposed: needs the user's decision
The rules require a public repo with an open-source license at submission. Pending: whether `emmanuelist/hawker` is created private now and flipped to public before submission, or public from day one.

## D-008 · Hosting on Render with the hackathon credit · 2026-11-07 · accepted
**Context:**
- The free Render instance sleeps after inactivity, which would drop the chat socket and timers.
- Render's free Postgres expires after 30 days [unverified], which would fall before judging ends on 2026-12-15.
**Decision:** a paid Render instance funded by the $50 PayPal AI Hackathon credit, which the user has claimed.
**Consequences:** the service must stay up until winners are announced (2026-12-21); credit burn is to be checked at deploy. Whether applying the credit requires a card is [unverified].

## D-009 · Repo private now, public at M3 · 2026-11-07 · accepted · supersedes D-007
**Decision:** `emmanuelist/hawker` is created private. It is made public (MIT license visible in About) at the M3 proof milestone, no later than 2026-11-11 17:48 UTC, before the submission at M4.
**Why:** it hides the work from other entrants while building; judges only need access from submission.
**Evidence:** the user chose "Private now, public later" on 2026-11-07.

## D-010 · Solo scope cuts accepted · 2026-11-07 · accepted · supersedes D-006
**Decision:** D-006 as written. Chat ingest is Twitch plus a labelled real-time replay. Not built: TikTok, Facebook Live and Instagram ingest; label OCR; multi-seller accounts; Venmo payouts. YouTube Live remains deferred.
**Evidence:** the user chose "Accept the cuts" on 2026-11-07.

## D-011 · Render free plan, kept warm; database outside Render · 2026-11-07 · accepted · supersedes D-008
**Context:** creating the Blueprint with a paid plan showed "Payment Information Required". Render needs a card on file for paid instances even with the $50 credit. The user doesn't want to add a card. Render's free-tier docs (render.com/docs/free, read 2026-11-07) say:
- a free web service sleeps after 15 min without inbound HTTP or WebSocket traffic and takes ~1 min to wake;
- each workspace gets 750 free instance hours a month (one service running all month fits);
- Render may restart a free service at any time;
- the filesystem is ephemeral;
- free Render Postgres expires 30 days after creation.
**Decision:**
- `plan: free` for the web service.
- From M1, the app keeps itself awake with a periodic request to its own public URL (`RENDER_EXTERNAL_URL`), and the open seller board sends a heartbeat.
- The database is an external free Postgres with no expiry, chosen at the start of M1. Render Postgres is not used.
- Hold timers are stored as deadlines in the database and swept on every start, so a restart or wake-up passes overdue holds immediately rather than losing them.
**Alternatives:** a paid instance (adding a card; the credit would cover about two months), declined by the user.
**Consequences:**
- A judge visiting a sleeping service waits ~1 min; the keep-warm loop exists to prevent that through 2026-12-21.
- If Render suspends free services (bandwidth exhausted, or "uncommonly high volume" of outbound traffic), the demo is down until the next month or a paid plan. Bandwidth use is to be watched on the billing page.

## D-012 · Visual world: Invoice Pad, with the stamp as the signature move · 2026-11-07 · accepted
**Context:** `impeccable shape` direction round. The roll assigned Pools Coupon; the hand also held Invoice Pad (Impeccable's pick), Gate Board (competitive challenger), five declined challengers and the category standard. Quality bar: the user's Warrant (live site) and Enoch208's live sites (Clasp, Morrow, Rectify, Selo, Vow, Lens), each with a hero that *is* the mechanism, a refusal section with real codes, and live proof.
**Decision:**
- Invoice Pad: Lagos market sales-invoice booklets (numbered duplicate copies, carbon-blue print, red serials, rubber stamps).
- Every hold is a numbered copy. PAID and PASSED → @next are stamps; a PASSED copy tears off to reveal the next buyer's copy.
- Surfaces:
  - landing `/` (Persuade) with a live invoice-pad instrument and an "Every way out, refused" section;
  - desk `/desk` (Operate);
  - stall page (Operate, phone-first).
- Imagery is code-drawn. Higgsfield plates only if truly needed, sparingly: the user has limited free credits.
**Alternatives:**
- Pools Coupon: betting connotation next to PayPal's gambling restrictions.
- Gate Board: generic airport look, not Lagos.
- Category standard: doesn't stand out.
**Consequences:** anti-goals are binding: no cream/parchment ground, no handwriting fonts, no ruled-ledger tables, no decorative paper texture. The brief is in internal/design/BRIEF-shape.md; the direction contract is in the surface brief.
**Evidence:** user choice 2026-11-07; seed reference seed:a46554d5d343f377.

## D-013 · Buyers claim on a Hawker stall page; Twitch becomes optional · 2026-11-07 · accepted · supersedes the ingest part of D-010
**Context:**
- The user has no Twitch account.
- The persona's seller streams on Instagram or TikTok, which can't be read without platform approval.
- A Twitch reply bot needs two accounts and a token setup.
- Judges couldn't take part in a Twitch flow.
**Decision:**
- The seller pins one stall link on any live stream.
- On the stall page (phone-first) the buyer sees the on-screen item and live stock, types a comment as they normally would, and their numbered copy appears immediately with the countdown and Pay with PayPal (shareable invoice link).
- The stall chat is the primary, authoritative chat source.
- Twitch anonymous read (E-006) stays an optional second source if time allows, and the scripted replay is dropped. Judges can create real holds themselves.
**Alternatives:** Twitch chat + reply bot, rejected for the reasons above.
**Consequences:**
- M1's exit becomes "one real comment typed on the stall".
- Buyer identity is a per-device session plus a chosen handle.
- D-010's other cuts stand: no TikTok/FB/IG ingest, no OCR, no multi-seller, no Venmo payouts.

## D-014 · Database: Neon free Postgres, `postgres` driver, plain SQL migrations · 2026-11-07 · accepted
**Context:** D-011 needs an external database with no expiry and no card. Neon's free plan (neon.com/docs/introduction/plans, read 2026-11-07): $0, 1 GB storage and 100 CU-hours per project per month, 5 GB egress, scale-to-zero after 5 min that cannot be disabled; no expiry stated.
**Decision:**
- Neon free project `hawker` in AWS US West 2 (near Render Oregon).
- The `postgres` 4.1.0 driver with hand-written SQL migrations in `db/migrations/`.
- `zod` 4.6.7 validates model output and request bodies.
**Alternatives:**
- Render free Postgres: expires in 30 days.
- Supabase free: pauses after inactivity.
- An ORM (drizzle 0.45): more surface than this schema needs.
**Consequences:**
- The keep-warm request and `/api/health` must not query the database, or the compute allowance burns 24/7. The DB is touched only on real events and while holds are open.
- Neon cold start adds latency to the first query after 5 idle minutes.
