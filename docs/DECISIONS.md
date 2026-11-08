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

## D-015 · The database lives in the user's existing Neon project, US East 1 · 2026-11-07 · accepted · supersedes the project and region in D-014
**Context:** D-014 planned a new Neon project `hawker` in AWS US West 2, next to Render Oregon. When the database was created, the user pointed to their existing Neon projects instead (screenshots in session): `neon-red-garden`, which is managed through a Vercel integration, and `neon-indigo-house`, which must not be touched.
**Decision:**
- A separate database `hawker` inside `neon-red-garden` (AWS US East 1), apart from that project's own `neondb`. Connection details in CONTEXT.md.
- Driver, migrations and validation stay as D-014 says.
**Alternatives:**
- A new Neon project in US West 2 (D-014): about 60 ms closer per query. Not used; the database went into the existing project the user shared.
**Consequences:**
- Every query crosses Oregon → Virginia, about 60–70 ms (T-16). Measured on Render: a fast-path claim including the PayPal invoice answered in 3.4 s (E-016), a model-path claim in 4.5 s (E-020); PayPal calls dominate.
- The Vercel-managed project's compute allowance is shared with whatever else uses it.
- Moving to a West project later is a connection-string change plus `npm run db:migrate` and `npm run db:seed`.

## D-016 · Design pass before M2: one-tap claims, the copy as a printed form, the landing now · 2026-11-07 · accepted
**Context:** At the M1 close the user asked whether the UI/UX could be "extremely better… in every way" and to push it without limits. An impeccable critique scored the stall and desk 25/40: `/` was still the M0 placeholder, the stall's variant tiles looked tappable but did nothing, claiming needed typed syntax, and the signature moment stopped at the stamp.
**Decision:**
- Stay in the Invoice Pad world (D-012) and push its execution: the copy becomes a printed sales-invoice form (carbon-blue letterhead and labels, filled-in values), waiting buyers are drawn as sheets under a Holding copy, and stamps land only when they land live.
- One-tap claims on the stall. A tap posts a canonical comment ("mine gold") through the same pipeline, recorded with `comments.via = 'tap'` (migration 002), and every surface shows it as "tapped", so the chat is never presented as typed when it wasn't. Typing works as before.
- Build the landing `/` now (planned for M2/M3): the claim beside a live pad fed by the demo stall, a real trace, the latest real Paid and Passed copies, and one-click checks. Every factual sentence on it has a verified claims row (C-1 … C-8).
- The desk's tear-off ships now (planned as M2's "full fidelity" item).
**Alternatives:**
- Polish the M1 screens only: leaves `/` as a placeholder judges would land on.
- Replace the world: no evidence the world was the problem; the critique found the execution thin, not the direction.
**Consequences:**
- M2's remaining scope is the hold ledger in AG Studio, the last-second payment test, and the refusals panel (to be confirmed).
- Tapped claims always go through the regex fast path; the model path is exercised by typed comments (E-020, E-023).

## D-017 · Independent reviews at milestone closes; "→ next buyer" when no one waits; a labelled replay on the landing · 2026-11-07 · accepted
**Context:** The user asked whether sub-agents would have been better for the critique, and approved two isolated reviewers on the live build (E-024). The design reviewer found the landing contradicting the thesis ("went back to stock" under "Two endings. No third.") and a hero that was usually stale.
**Decision:**
- UI critiques run as two isolated sub-agents (design review; detector + measurements), at milestone closes and before submission, with the user's reference sites as the bar.
- A pass with nobody waiting is stamped and described as "PASSED → next buyer" everywhere (stamp, desk, chat, landing): the copy is open to the next buyer who claims, which is what the thesis says. "Back to stock" is not used.
- When nothing is live, the landing replays the latest real ending, labelled "replay · sped up" with the copy number and how long ago it ended (PRODUCT.md principle 5). Live copies always take precedence.
- First views of the stall and the landing render on the server; the stall's controls stay disabled until hydration so an early tap can't submit a form natively.
**Alternatives:**
- A third ending label ("returned"): contradicts the thesis.
- Showing the static latest copy: a judge rarely sees a stamp land.
- An unlabelled loop: would present old data as live; refused by principle 5.
**Consequences:**
- A review costs ~15–25 min of agent time per run.
- Before recording the film, run several real sandbox payments so the Paid count isn't 1 against 12+ Passed (real data, not a mock).

## D-018 · The ledger's agent: code-backed tools first, Studio's agents for the rest; large turns to Gemini · 2026-11-07 · accepted
**Context:** The hold ledger runs on AG Studio 3.1.0 with its agent framework, through Hawker's own adapter and model client (Groq → Gemini, rule 11). Measured on the local build: AG Studio's built-in agents send 5k–30k-token turns; Groq's free tier refuses turns over its per-minute window (413, T-25); a long delegation chain can exhaust Gemini's free per-minute quota; and the built-in agents on `gemini-3.5-flash-lite` once reported a chart they never added (T-26).
**Decision:**
- Hawker's agent fronts the chat with small, code-backed tools: `who_owes_now` (re-reads each open invoice from PayPal), `ledger_totals` (counts and sums computed in integer cents from the ledger rows) and `add_breakdown_chart` (the model picks a field and a measure from enums; code builds the widget with `api.setState`, undoable). Anything else goes to Studio's lead agent via `delegate_to`, and the agent may only claim a change the lead reports.
- The model client keeps Groq first for every turn that fits Groq's per-minute window; a turn estimated over 4,000 tokens goes straight to Gemini; Groq 403/413 and empty answers fail over; a Gemini 429 waits 6 s before its retry.
**Alternatives:**
- Let the model write queries and widget configs through Studio's own tools for everything: 30k-token turns, quota exhaustion, and a false "added" in testing.
- A paid model: ruled out (free tiers only).
**Consequences:**
- The common questions answer in ~2 Groq turns of ~1k tokens each (measured: who owes, paid vs passed, add a chart).
- Open-ended dashboard edits depend on Gemini's free quota and can be slow (~45 s, ~12 calls).

## D-019 · The ledger as a sales booklet, with motion · 2026-11-07 · accepted
**Context:** The user asked for the AG Studio ledger to be as decorative as it can be and never below standard, and chose "Booklet + full motion" from three directions. The ledger had Studio's default look: grey pill filter, plain grid cells, tool calls as bare rows in the chat.
**Decision:**
- Every widget is a sheet on the board with a gutter between sheets; its title prints on a carbon-blue binding band with a perforated tear line (Studio theme params first, `ledger.css` scoped to `.hawker-ledger` for the rest).
- A custom stamp-filter widget replaces the button filter: Waiting and Holding as printed labels on their copy tints, Paid and Passed as real stamps, each count on numbering wheels; one tap cross-filters the page; its own counts ignore the filter it sets.
- Grid cells render as stubs through the grid widget's `createCellRenderer`: red serials, a small PAID / PASSED stamp over the hand-off line, quoted comments, the reader as a printed tag.
- The agent's tool calls print as receipt slips (`aiToolDisplay`) from the same structured result the model reads: the PayPal read with its time, the ledger count, the chart added.
- Motion only for changes seen live: the shell diffs each read of the rows (`live.ts`); a new copy slides in as a stub, an ending lands its stamp, the endings sheet re-stamps, an optional stamp sound plays; a ticker runs along the binding with a pause control. Reduced motion stills all of it.
- The agent's charts always stack both endings, because Studio has no per-widget series colour and a passed-only chart would draw in the Paid colour.
**Alternatives:**
- "Booklet" without motion: calmer, but the user chose the motion layer.
- A fully custom dashboard instead of Studio: loses the AG Studio prize integration.
**Consequences:**
- Studio class names come from 3.1.0's rendered DOM; an upgrade that renames one falls back to Studio's own look for that piece.
- AG Grid auto-sizes columns by the plain text, so custom cells are kept no wider than their text (the ending stub is stacked).

## D-020 · An ended hold is final in the database; the refusals panel on the landing · 2026-11-07 · accepted (migration 003 applied by the user 2026-11-07 19:07 UTC; E-029)
**Context:** Building "Every way out, refused" showed that claim C-5 ("the database … refuses any change to a hold that has ended") was broader than the guard: `holds_transition_guard` (001) refused only a change of ending. Ending a Passed copy again (a new `ended_at`/`end_reason`) was **accepted**, and erasing a Paid copy was refused only incidentally, by the `events_hold_id_fkey` foreign key.
**Decision:**
- Migration `003_ended_is_final.sql`: an ended hold can't change its ending, be ended again, have any part of its record rewritten, or be deleted (`hold_ended: …`). The one write the app makes after an ending stays allowed: a Passed hold's hand-off link, set once from empty. Dry-run against Neon inside a rolled-back transaction: 9 forbidden writes refused, the app's 3 writes (leave the line, set the hand-off link, a no-op write) allowed.
- The refusals panel sits on the landing between "Two endings. No third." and "Check it yourself": nine attempts on real copies from the demo stall: three at PayPal (cancel a paid invoice, cancel a passed invoice again, and a live read showing a passed invoice CANCELLED with $0.00 paid plus its pay page to try), six in the database in rolled-back transactions. A probe counts as refused only when the expected guard answers; anything else shows as accepted or as an error, in the refuser's own words.
**Alternatives:**
- Narrow C-5's wording instead of the guard: weaker, and "end it twice" would stay possible.
- A probe that records a payment on a cancelled invoice through PayPal's API: it could mark a cancelled invoice paid if PayPal accepted it, so it isn't attempted; the pay page link lets anyone try paying instead.
**Consequences:**
- Until 003 is applied, the panel honestly shows 7 of 9 refused ("end twice" accepted, "erase" refused by the foreign key), so it isn't deployed before the migration.
- PayPal probes are three sandbox API calls each; attempts are limited to 30 a minute per visitor and 1,500 a day.

## D-021 · M2 close: benchmark "not doing" list, settled · 2026-11-08 · accepted
**Context:** The M2-close benchmark (`internal/benchmarks/2026-11-08-191e7b8.md`, 17/24) and the independent design review (27/40, E-031) proposed more than the deadline allows. The benchmark keeps at most five fixes; the rest are recorded here so later passes don't propose them again.
**Decision — not doing:**
- A measured advantage against the incumbent (a seller reading the chat by hand): no honest measurement before the deadline; the README states the eval and its regex-only baseline instead.
- Rewriting or hiding test-buyer handles (`@race.619`, `@handoff.a950`, `@bench.141`) in the demo data: they're real holds (rule 1). The film is shot from a fresh session with natural handles (M3).
- The ledger at 1024 px scrolling sideways under Studio's panels: Studio's own minimum canvas width; the ledger is a desktop surface.
- Ellipsis on long items and comments in the ledger grid: AG Grid sizes columns by plain text (T-28).
- Locking the ledger in view mode, or collapsing its assistant panel by default: edit mode and the agent are what the AG Studio prize rewards.
- Other sponsor prizes (Render Workflows, Bryntum, Channel3, APIMatic): one sponsor prize at most (rules §8); AG Grid is the target.
- Changing what happens when PayPal is unreachable at expiry (the hold keeps Holding and retries rather than invent an ending): correct by design; stated as a README limit.
- A PayPal mark on the Pay bar: PayPal's brand assets have their own usage rules; the button text names PayPal.
**Consequences:** the remaining score is in M3: the video (Demo quality, Presentation, Stage 1) and the README proof with a public repo (Evidence, Stage 1).

## D-022 · The narration voice's vendor is not named on public surfaces · 2026-11-08 · accepted (the user's call)
**Context:** The demo video's narration is a synthetic voice from a third-party text-to-speech service, used only by internal scripts, never by the app. The rules ask entrants to name the AI tools used and how (dossier, rules §4). The README's "AI used, and how" named the service.
**Decision:** The user chose not to name it. The README, `.env.example`, the claims table and the build docs no longer mention it; the voice settings moved to `internal/video/production/NARRATION.md` (gitignored). The README still names the AI in the product (Groq, Gemini, AG Studio's agent framework) and the build tool (Claude Code).
**Consequences:** Earlier commits still contain the name (two commit messages and file contents); only a history rewrite would remove those, and that's the user's call before the repo goes public (D-009).

## D-023 · The repo is public · 2026-11-08 · accepted (supersedes D-009's private-until-decided)
**Context:** D-009 kept the repo private until the user decided. The submission needs a public repo with its license visible, and the README's CI badge and clone command need it. The git history keeps earlier mentions that D-022 removed from current files; the user chose to leave history as it is, since a rewrite would change every commit ID the evidence cites.
**Decision:** Public on 2026-11-08 at the user's go-ahead, after a secret scan of the full history (clean). About: the verbatim thesis, the live app, MIT, topics paypal, ag-grid, live-selling, nextjs, hackathon.
**Consequences:** Anything committed from now on is public at once; `internal/` stays gitignored (strategy, research, video production). Check the rules before pushing after the deadline (the repo may be judged as it stood then).
