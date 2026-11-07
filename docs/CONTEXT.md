# Context
Verified facts about everything this project depends on. Each entry says how it was
verified, so no session has to re-derive it or trust training data. Read before
touching an integration.

## Platforms and environments
| Name | Kind | ID | Endpoint (env var) | Console | Verified |
|---|---|---|---|---|---|
| PayPal sandbox | Payments sandbox | REST app `APP-70B06370VJ205311U` ("live-sale-desk"), attached to a **US** sandbox Business account; features include **Invoicing** (enabled 2026-11-07), Payouts, Subscriptions, Payment links | `https://api-m.sandbox.paypal.com` (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`) | developer.paypal.com/dashboard (Sandbox toggle) | 2026-11-07, OAuth + calls in E-001…E-004 |
| PayPal sandbox buyer | Test account | US Personal sandbox account; logs in at sandbox.paypal.com | `SANDBOX_BUYER_EMAIL`, `SANDBOX_BUYER_PASSWORD` (scripts only) | Testing Tools → Sandbox Accounts | 2026-11-07, paid E-001 and E-003 |
| Groq | Model API (free tier) | org-level limits | `https://api.groq.com/openai/v1` (`GROQ_API_KEY`) | console.groq.com | 2026-11-07, E-005 |
| Google Gemini API | Model API (free tier) | Nigeria is on the official available-regions list | `https://generativelanguage.googleapis.com/v1beta` (`GEMINI_API_KEY`, header `x-goog-api-key`) | aistudio.google.com | 2026-11-07, E-005 |
| Twitch chat | Chat source | anonymous IRC over WebSocket | `wss://irc-ws.chat.twitch.tv:443` | — | 2026-11-07, E-006 |
| Neon | Postgres (free, Vercel-managed org) | project `neon-red-garden` (broad-glade-55248869), branch `main`, **database `hawker`** (separate from that project's `neondb`), pooled endpoint `ep-sparkling-cell-a44mims4-pooler.us-east-1.aws.neon.tech`, AWS US East 1 | `DATABASE_URL` (pooled, `sslmode=require&channel_binding=require`) | console.neon.tech | 2026-11-07, E-013 |
| Render | Hosting | Web service `hawker`, **free plan** (a paid plan requires a card on file even with the $50 credit, D-011), Blueprint `exs-dbneutm7bikc73ccae0g`, auto-deploys `main` | https://hawker-8q2t.onrender.com | dashboard.render.com | 2026-11-07, E-008 |

## SDKs and APIs
| API | Calls we use (exact) | Verified in |
|---|---|---|
| PayPal OAuth | `POST /v1/oauth2/token` (Basic client:secret, `grant_type=client_credentials`) → `access_token`, `scope`, `expires_in` (32400). `POST /v1/oauth2/token/terminate` body `token=<t>&token_type_hint=ACCESS_TOKEN` → 200 | E-001 run |
| PayPal Invoicing v2 | `POST /v2/invoicing/invoices` (no `primary_recipients` → shareable) → 201 `{id}` · `POST /v2/invoicing/invoices/{id}/send` body `{send_to_recipient:false, send_to_invoicer:false}` → 200 `{href: https://www.sandbox.paypal.com/invoice/p/#<id>}` · `GET /v2/invoicing/invoices/{id}` → `status` (`UNPAID`/`PAID`/`CANCELLED`), `payments.transactions[].payment_id` · `POST /v2/invoicing/invoices/{id}/cancel` body `{subject, note, send_to_recipient}` → 200 · `POST /v2/invoicing/invoices/{id}/generate-qr-code` body `{width,height}` → 200 (multipart image) · `POST /v2/invoicing/generate-next-invoice-number` → `{invoice_number}` | E-001, E-002; docs `developer.paypal.com/api/invoicing.md` (raw copies in internal/research/raw/paypal-docs-2026-11-07/) |
| PayPal Add Tracking | `POST /v1/shipping/trackers-batch` `{trackers:[{transaction_id, tracking_number, status:"SHIPPED", carrier:"USPS", notify_buyer}]}` → 200 · `GET /v1/shipping/trackers/{txn}-{tracking}` | E-001, E-003 |
| PayPal Orders v2 (fallback) | `POST /v2/checkout/orders` (intent CAPTURE, `payment_source.paypal.experience_context`) → `payer-action` link · `POST /v2/checkout/orders/{id}/capture` with `PayPal-Request-Id` | E-003 |
| PayPal Payouts | `POST /v1/payments/payouts` → batch; `GET /v1/payments/payouts/{batch}` | E-004 |
| PayPal Webhooks | `POST /v1/notifications/webhooks` `{url, event_types:[{name}]}` (max 10 per app) · `GET /v1/notifications/webhooks-events` | E-001…E-003 |
| Groq chat completions | `POST /chat/completions` `{model, temperature:0, messages}`; Qwen accepts `reasoning_effort:"none"`. Response headers `x-ratelimit-limit-tokens: 8000`, `x-ratelimit-limit-requests: 1000` | E-005 |
| Gemini generateContent | `POST /models/{model}:generateContent` `{system_instruction:{parts}, contents:[{role,parts}], generationConfig:{responseMimeType:"application/json", temperature:0}}` | E-005 |
| Twitch IRC | send `PASS SCHMOOPIIE`, `NICK justinfan<n>`, `JOIN #<channel>`; reply `PONG :tmi.twitch.tv` to `PING`; messages match `^:(\w+)!\S+ PRIVMSG #(\w+) :(.*)$` | E-006 |

## Models (AI builds)
| Model (exact) | Provider | Limits (read 2026-11-07) | Eval | Verified |
|---|---|---|---|---|
| `qwen/qwen3.8-27b` | Groq | 1,000 requests/day, 8,000 tokens/min; a 10-comment batch is ~898 in + ~318 out tokens | 300/300 commerce-critical, ~2 s per batch | E-005 |
| `gemini-3.5-flash-lite` | Google | free tier; exact limits only in AI Studio; occasional 503 "high demand" | 178/180, ~4–5 s per batch | E-005 |

## Traps
- **T-15 · Invoice refusal codes (verified 2026-11-07):** cancel twice → 422 `INVOICE_CANCELED_ALREADY` (E-011); cancel a PAID invoice → 422 `CANNOT_CANCEL_PAID_INVOICE`, status stays PAID (E-012). `configuration.partial_payment.allow_partial_payment` and `allow_tip` live under `configuration`; `detail.reference` ≤ 120 chars; `invoice_number` auto-generated if omitted (invoicing/object.md).
- **T-16 · The database is in AWS US East 1 while the Render service is in Oregon**, about 60–70 ms per round trip. Keep transactions short; PayPal calls (1–2 s) dominate anyway. The branch was archived and unarchives on the first query (a few seconds once).
- **T-17 · A cancelled invoice can't be paid (verified 2026-11-07, E-017).** PayPal's checkout still opens from the hosted page and accepts "Complete Purchase", but the popup closes, the page then reads "This invoice was canceled." and the invoice stays `CANCELLED` with 0 paid. Nothing is recorded as paid against the invoice. Whether the checkout left an authorization on the buyer's account was not checked.
- **T-18 · Scripting the hosted invoice payment (sandbox, 2026-11-07).** The page has two PayPal zoid iframes (`title="PayPal-paypal"` and `title="PayPal-card"`); click the link "PayPal" in the first. The popup goes `hermes`/`checkoutnow` → `/pay`, a login page with **Log In** and **Pay with Debit or Credit Card** (guest; don't click it). After login the review button is "Pay" (or "Complete Purchase" when already logged in). On a mobile viewport the popup sometimes fails to open; a desktop context is reliable.
- **T-19 · EventSource never reconnects after an error response** (e.g. a 500 before the stream opens); it closes for good. `live.ts` reopens it after 5 s (E-018). A server-side read failure after the stream opens is sent as `event: oops` and retried by the server.
- **T-20 · CSS grid: a `whitespace-nowrap` child sets the min width of an implicit `auto` column** and widens the whole page past the viewport (the desk's tape at 1280 px, E-019). Give layout grids `minmax(0,1fr)` columns.
- **T-21 · Live lists that prepend need `overflow-anchor: none`.** With the default scroll anchoring, a new comment added at the top of a scrolled column shifts the column to keep the old lines in place, hiding the newest. The desk's chat and pad columns turn it off (2026-11-07).
- **T-22 · The scheduler assumes one process per database.** Deadlines and the stall queue are in memory, and a server loads every open hold when it starts. A local server pointed at the shared Neon database while Render runs would expire the same holds as Render and could promote the next buyer twice. Run local previews with `HAWKER_SCHEDULER=off`, or only when no hold is open.
- **T-23 · Gemini 3 tool calls need their thought signature back** (verified 2026-11-07). Through the OpenAI-compatible endpoint, each tool call carries `extra_content.google.thought_signature`; replaying the call without it returns 400 "Function call is missing a thought_signature". A call Gemini didn't make (e.g. from Groq) is accepted with the documented placeholder `skip_thought_signature_validator`. `src/lib/ai/client.ts` + the ledger adapter keep and resend them.
- **T-24 · Groq answers 403 "Access denied. Please check your network settings." from some networks (a VPN here).** The chat client fails over to Gemini on it.
- **T-25 · Groq's free tier caps a single turn at its per-minute input window (~8k tokens for `qwen/qwen3.8-27b`) and answers 413 above it.** AG Studio's built-in agents send 5k–30k-token turns (measured); turns estimated over 4k tokens go straight to Gemini, and 413 fails over (D-018). Gemini's free per-minute quota can also run out on a long delegation chain (429 "exceeded your current quota"); the client waits 6 s before retrying.
- **T-26 · AG Studio's built-in agents on a small free model can report a change they didn't make** (a "chart added" reply with no `add_widget` call, 2026-11-07). Hawker's common dashboard action is a deterministic tool (`add_breakdown_chart`) that code executes through `api.getState()/setState()`; the agent may only claim a delegated change the lead reports.
- **T-27 · AG Studio without a licence key** prints a "License Key Not Found" banner to the console and shows a watermark; a free trial key (request from AG Grid) removes both. `<AgStudioProvider licenseKey>`. **Set on Render 2026-11-07** as `NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY` (a build-time variable: changing it needs a redeploy); verified: 0 licence console messages, watermark elements `ag-hidden`. The 45-day trial runs to about 2026-12-22, which covers judging (Dec 1–15, winners ~Dec 21).
- **T-1 · PayPal reuses the same OAuth access token for up to 9 h.** After enabling a feature (Invoicing) the old token kept the old scopes and every call returned 403 `NOT_AUTHORIZED`. Fix: `POST /v1/oauth2/token/terminate`, then request a new token. (E-001 notes)
- **T-2 · `invoicer.email_address`, if sent, must match the token's sandbox Business account.** Omit it. (invoicing troubleshooting doc)
- **T-3 · Venmo payouts are unsupported in the sandbox**, and one Venmo item fails the whole batch. (E-004)
- **T-4 · Sandbox order-capture webhooks are unreliable** (never delivered in 40 min); invoice webhooks arrived in seconds. Read status from PayPal. (E-003, E-001)
- **T-5 · The Webhooks Simulator signs with a special webhook ID, so signature verification fails on simulated events.** Test with real sandbox transactions. (invoicing troubleshooting doc)
- **T-6 · Hosted PayPal MCP server `mcp.sandbox.paypal.com` fails every call** ("Unsupported cache mode: default"), paypal/agent-toolkit#119, open since 2026-10-30.
- **T-7 · `docs.paypal.ai` was retired.** Links redirect to 404 (AI-Toolkit commit 2026-09-21). Use developer.paypal.com and its `llms.txt` / `.md` pages.
- **T-8 · Transaction Search lags up to 3 h.** Never drive the live board from it.
- **T-9 · A sandbox merchant registered in a send-only country can't receive payments** (forum 45513). Use a US sandbox Business account.
- **T-10 · Groq's free tier returns 429 on the token-per-minute limit and occasional 503 "over capacity"; Gemini Flash-Lite occasionally returns 503 "high demand".** Retry with backoff and fail over.
- **T-11 · `gemini-3.8-flash` is too slow for live parsing** (one 6-batch run didn't finish in ~20 min).
- **T-12 · `paypaldev/hackathon-paypal-ag-grid-boilerplate` has no license.** Don't copy from it.
- **T-14 · Render free web services sleep after 15 min without inbound HTTP/WebSocket traffic** and take ~1 min to wake; Render may restart them at any time; free Render Postgres expires after 30 days (render.com/docs/free, 2026-11-07).
- **T-13 · Next 16: with `cacheComponents` on, `GET` route handlers prerender unless they touch request-time data.** Call `await connection()` (from `next/server`) for per-request output. (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`)

## Environment
| Var | Purpose | Where to get it |
|---|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Sandbox REST app | developer.paypal.com → Apps & Credentials (Sandbox) → live-sale-desk |
| `SANDBOX_BUYER_EMAIL`, `SANDBOX_BUYER_PASSWORD` | End-to-end scripts only (paying as the buyer) | Testing Tools → Sandbox Accounts → US Personal → View/Edit |
| `GROQ_API_KEY` | Primary model | console.groq.com → API Keys |
| `GEMINI_API_KEY` | Failover model | aistudio.google.com → Get API key |
| `RENDER_GIT_COMMIT` | Commit shown by `/api/health` | Set by Render at runtime (verified 2026-11-07, E-008) |
| `HAWKER_SCHEDULER` | `off` disables the hold scheduler, for a local preview against the shared database while Render runs | Local only; never set on Render (T-22) |
