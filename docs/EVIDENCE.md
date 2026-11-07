# Evidence
Every public claim, and the proof behind it. Proofs are append-only. Claims are re-checked
against live state before anything is published.

## Claims
| # | Claim (verbatim) | Appears in | Proof | Status | Checked |
|---|---|---|---|---|---|
| C-1 | Every hold ends one of two ways: paid through PayPal, or passed to the next buyer. | Planned: repo description, README subtitle, Devpost tagline, video closing card | Planned: hold ledger on the hosted demo (every row `Paid` + PayPal invoice/transaction ID, or `Passed` → next handle + timestamp) and judge-runnable checks in the README. The pre-build rail is proven by E-001, E-002. | unverified (not built) | 2026-11-07 |
| C-2 | Hawker reads a live-sale chat in English, Pidgin or Taglish. | Planned: README subtitle, video | Pre-build spike E-005 (300/300 on Groq `qwen/qwen3.8-27b`). Needs the committed, re-runnable eval in `eval/` and the same result through the app's own model client. | unverified (spike only) | 2026-11-07 |

## Proofs
These are pre-build dependency spikes run on 2026-11-07, before the first commit: scripts in `internal/research/spikes/` (gitignored) and `eval/spike-2026-11-07/`. They prove the rails Hawker depends on, not Hawker itself.

| # | Date | Proves | Proof | Commit |
|---|---|---|---|---|
| E-001 | 2026-11-07 | A bundled PayPal sandbox invoice (2 items, $57) is created, sent, paid by a sandbox buyer on PayPal's hosted page (Pay in 4 / Pay Monthly offered), and reads back `PAID`. Tracking attaches to its transaction. `INVOICING.INVOICE.PAID` was created ~13 s after payment. | Invoice `INV2-NZM6-QBTN-TNRQ-SX3Y`, txn `4GG399535T170464N` · `docs/evidence/E-001-004-paypal-sandbox-spike.md` · `docs/evidence/E-001-hosted-invoice-page.png`. Also: an invoice with **no recipient email** (`INV2-6VWV-2WRZ-7XG6-WWHH`) yields a payer link and a QR code. | pre-repo |
| E-002 | 2026-11-07 | A sent invoice is cancelled (the Passed path); status reads `CANCELLED`; the `INVOICING.INVOICE.CANCELLED` event fired immediately. | Invoice `INV2-SR3P-LSDP-ULTB-WACY` · same capture file | pre-repo |
| E-003 | 2026-11-07 | Orders v2 fallback: create → buyer approval → capture `COMPLETED`, `seller_protection=ELIGIBLE` → tracking SHIPPED/USPS. The `PAYMENT.CAPTURE.COMPLETED` webhook was **not** delivered within ~40 min. | Order `94A64183T2702740S`, capture `0A6652330E4286109` · `docs/evidence/E-003-buyer-checkout-pay-later.png` | pre-repo |
| E-004 | 2026-11-07 | Payouts to a PayPal email succeed (~26 s). Venmo payouts return "Recipient wallet not supported in sandbox." | Batch `6LA95GUAD8M6W`, txn `0M3613730Y851704E`; Venmo error debug_id `ca56a9048ba70` | pre-repo |
| E-005 | 2026-11-07 | Parsing 60 labelled comments, commerce-critical errors only: Groq `qwen/qwen3.8-27b` 300/300 (5 runs, ~2 s per batch of 10); Gemini `gemini-3.5-flash-lite` 178/180 (two safe misses → clarify); 0 phantom claims on either. | `docs/evidence/E-005-parsing-free-apis.md`; inputs and runners in `eval/spike-2026-11-07/` | pre-repo |
| E-006 | 2026-11-07 | Twitch chat can be read with no account or key: 186 messages in 20 s across 5 live channels. | `docs/evidence/E-006-twitch-anonymous-read.md` | pre-repo |
| E-007 | 2026-11-07 | CI gate green on GitHub for the hello-world: `npm ci`, lint (0 warnings), typecheck (`next typegen && tsc --noEmit`), test, build | [CI run 42359269913](https://github.com/emmanuelist/hawker/actions/runs/42359269913) (private repo until D-009) | 7e1d387 |
