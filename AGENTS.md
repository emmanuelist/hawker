# Hawker: build rules and pinned context

> Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.

Hawker reads a live-sale chat in English, Pidgin or Taglish, turns each "mine" into a timed hold, and settles it with a PayPal invoice. It is built for the PayPal AI Hackathon; the deadline is in `docs/PLAN.md`.

**Read `docs/STATE.md` first.** It is the current truth: what works, what's deployed, what's next.
Strategy and research live in `internal/` (gitignored): `internal/THESIS.md` (claim, break test, signature component) and `internal/research/DOSSIER.md` (rules, prizes, competitors, spikes).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repo layout

```
src/app        Next.js App Router: pages and route handlers (UI, API, SSE)
src/lib        domain code: claim engine (pure), parser (regex fast path + model client),
               PayPal client, chat ingest — added from M1
eval/          parsing eval set + runner — added in M1
docs/          STATE, PLAN, DECISIONS, EVIDENCE, CONTEXT (see the protocol below)
internal/      strategy, research, spikes — gitignored, never commit
```

Run everything from the root: `npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`.

## Pinned versions

Looked up on 2026-11-07, never from memory. Re-check before any upgrade.

| | Pinned |
|---|---|
| Node | 26.13.0 (newest LTS; `.node-version`). **Node 20 is end-of-life and must never appear.** |
| Next.js | 16.4.5, App Router, `cacheComponents` on. **Next 15 and older must never appear.** |
| React / React DOM | 19.3.1 |
| TypeScript | 6.0.3. **Not 7.x**: typescript-eslint 8.72.1 accepts `>=4.8.4 <6.1.0`. |
| ESLint | 9.39.5 with eslint-config-next 16.4.5 (ESLint 10 not adopted; plugin peers) |
| Tailwind | 4.3.5 (+ `@tailwindcss/turbopack` 4.3.5) |
| Vitest | 5.1.0 |
| AG Studio | `ag-studio` / `ag-studio-react` 3.1.0, installed when the board is built (M2) |
| PayPal | REST over `fetch` against `https://api-m.sandbox.paypal.com`. No PayPal SDK installed. **Never use the hosted MCP server `mcp.sandbox.paypal.com`** (broken, paypal/agent-toolkit#119). |
| Models | Groq `qwen/qwen3.8-27b` (primary), Gemini `gemini-3.5-flash-lite` (failover). Exact IDs only, never `-latest` aliases. |

```bash
curl -s https://endoflife.date/api/nodejs.json | jq -r '[.[] | select(.lts != false)][0].latest'
npm view <pkg> version ; npm view <pkg> peerDependencies
```

## Rules

1. **No mocks, no fake data, no demo mode.** Every rendered value comes from a real source.
   Authoritative stores: PayPal is authoritative for payment state; the stall chat (D-013), and
   Twitch only if added, is authoritative for what buyers said and in what order; the database is
   authoritative for holds and the waitlist.
2. **Verify every SDK and API call before writing it**: installed types for packages
   (`node_modules/<pkg>/**/*.d.ts`), the provider's current API reference for HTTP APIs, and
   `docs/CONTEXT.md` for calls already verified. If a call cannot be verified, stop and say so.
3. **Phase-gated.** Build the current milestone only (in `docs/STATE.md`), then stop for confirmation.
4. **Every write persists, and the response returns the persisted row**, never an object built in memory.
5. **Tests cover failure paths**, not just the happy path.
6. **No secrets in the repo.** Env vars only; blank-valued keys in `.env.example`.
7. **Never cut scope silently.** Cuts are the user's decision. Present the tradeoff on technical
   merit and record an accepted cut in `docs/DECISIONS.md`.
8. **The claim is an invariant** (D-005). Every hold ends `Paid` or `Passed`, and nothing else:
   - before passing a hold, re-read its invoice from PayPal; `PAID` is never passed (B1);
   - every invoice sets `allow_partial_payment: false` (B2);
   - there is no manual mark-paid and no seller override (B3).
9. **One state vocabulary everywhere**: `Waiting` → `Holding` → `Paid` | `Passed`. The same words in the
   UI, API, database, logs and README.
10. **The AI proposes, code commits.** Model output is a parse proposal. Deterministic code commits
    holds in chat-arrival order, validates item codes and variants against the catalog, and turns
    anything unknown or ambiguous into a clarifying reply. The model never decides who gets an item.
11. **One model client.** The regex fast path runs first. Every model call goes through one client with
    a timeout, retries with backoff, failover from Groq to Gemini on 429/503, and a log of prompt and
    output against a request ID. When both are unavailable the board keeps working on the fast path
    and says so on screen.
12. **Payment truth is the PayPal status read (`GET /v2/invoicing/invoices/{id}`); webhooks only confirm.**
    Sandbox order-capture webhooks were never delivered in testing (E-003).
13. **Do not copy code from `paypaldev/hackathon-paypal-ag-grid-boilerplate`.** It has no license.
    Wire AG Studio from AG Grid's own docs.

## Frontend conventions

- Design direction is **Invoice Pad** (D-012). The direction contract lives in the surface brief
  (`impeccable surface-brief read src/app/desk/page.tsx`); PRODUCT.md holds product truth. Anti-goals
  are binding: no cream/parchment ground, no handwriting fonts, no ruled-ledger tables, no decorative
  paper texture, no generic SaaS cards. Signature move: the stamp (PAID / PASSED → @next).
- Headless behaviour (Radix, React Aria, Base UI) is fine; styled kits (MUI, Chakra, Ant, daisyUI) are not.
- Fonts through `next/font` only. Never add `<link>` tags to font CDNs.
- Every animation checks `prefers-reduced-motion`; timelines are killed on cleanup.
- Async calls wrap in `try/catch` with a shared error component; a failure never strands a flow in
  an in-flight state.
- **Money:** integer minor units (cents) inside the app; decimal strings with a currency code
  (`{ "currency_code": "USD", "value": "57.00" }`) only at the PayPal boundary. Never float arithmetic.

## Verification before any gate

`npm run lint` (zero warnings) · `npm run typecheck` · `npm test` · `npm run build`.
All green before any milestone closes; CI runs the same commands on every push.

## Where things live
| Concern | File |
|---|---|
| Current truth: what works, what's deployed, what's next | docs/STATE.md (read it first) |
| Time left and current phase | the clock line printed at session start (.claude/hooks/clock.mjs) |
| Milestones, the build window and its checkpoints | docs/PLAN.md |
| Work items | the checklist in docs/PLAN.md (sprint profile) |
| Why we chose what we chose | docs/DECISIONS.md (append-only) |
| Proof that things work, and every public claim it backs | docs/EVIDENCE.md (raw captures in docs/evidence/) |
| Demo script, video script, submission draft | docs/RUNOFSHOW.md, docs/VIDEO.md, internal/SUBMISSION.md |
| Verified facts about dependencies, and traps | docs/CONTEXT.md. Read it before touching any integration. |
| Research, strategy | internal/ (gitignored) |

## Operating protocol
- **Start:** read docs/STATE.md and the clock line, then the open work items for the current milestone and the last 3 entries of docs/DECISIONS.md. Say the next action back before starting.
- **Work:** one item at a time. Sprint profile: a small commit to `main` that passes the gate, with the evidence in the message.
- **Parallel agents** only on independent items with their own acceptance criteria, each in its own git worktree, each merged only when its gate is green. Never two agents on the demo path at once.
- **Before publishing** a post, README change, submission or video: every factual sentence in it has a `verified` row in the claims table in docs/EVIDENCE.md, re-checked against live state today.
- **Finish** (or `/foundation handoff`): append EVIDENCE and DECISIONS, update CONTEXT and the claims table, close work items with evidence, rewrite docs/STATE.md, commit.
- **Truth rule:** never write a claim into STATE, README, an issue or a commit message that wasn't verified this session. Write "unverified" instead.
- **Decisions:** never relitigate an accepted decision without new evidence; supersede it with a new entry.
