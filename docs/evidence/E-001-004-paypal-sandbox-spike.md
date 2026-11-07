# Spike S1 — PayPal sandbox, 2026-11-07 07:05–07:24 UTC
App APP-70B06370VJ205311U (Merchant, attached to a US sandbox business account). Developer login: Nigerian PayPal account.

| Step | Result | Evidence |
|---|---|---|
| OAuth client_credentials | OK, 28 scopes. **No invoicing scope** | — |
| Invoicing (generate-next-number, list) | **403 NOT_AUTHORIZED**. Needs Apps & Credentials → app → Features → Invoicing | debug_id f15825342619d, f2830899bb354 |
| Payout to PayPal email ($1) | **SUCCESS** in ~26 s | batch 6LA95GUAD8M6W, txn 0M3613730Y851704E |
| Payout to Venmo (phone) | **"Recipient wallet not supported in sandbox."** (400, fails the whole batch) | debug_id ca56a9048ba70 |
| Venmo simulator (note POSPYO003) | 201 (simulated only) | debug_id ca56a904bbc4f |
| Orders v2 create (2 line items, $57) | 200 PAYER_ACTION_REQUIRED | order 94A64183T2702740S |
| Buyer login + approval (browser) | OK. Checkout offered **Pay in 4 ($14.25×4)** and **Pay Monthly** | buyer-checkout-pay-later.png, PayerID LCR4PY2433F6Q |
| Capture | **COMPLETED $57.00, seller_protection=ELIGIBLE** | capture 0A6652330E4286109 |
| Add tracking (trackers-batch) + read back | 200; SHIPPED / USPS / 9400100000000000068378 | debug_id ca56a94563a63 |
| Webhook events (placeholder URL) | CHECKOUT.ORDER.APPROVED created 07:20:42, **first listed ~07:22:02 (~80 s)**. PAYMENT.CAPTURE.COMPLETED **not listed within ~2.5 min** | webhook 0GN66691XG438510S |

Implications:
- Don't drive the live board from webhooks alone. Poll order/invoice status, and treat webhooks as confirmation.
- Venmo payouts can't be demoed live in the sandbox.

## Invoicing retest, 07:58–08:02 UTC (after enabling the Invoicing feature)
**Root cause of the earlier 403:** PayPal returns the **same cached access token** for client_credentials until it expires (9 h). The token issued before the feature change kept the old scopes. `POST /v1/oauth2/token/terminate` and then a new token brought in the invoicing scope; `generate-next-invoice-number` → 200.

| Step | Result | Evidence |
|---|---|---|
| Create + send bundled invoice (2 items, $57) | 201 / 200; PayPal-hosted payer page | INV2-NZM6-QBTN-TNRQ-SX3Y, hosted-invoice-page.png |
| Hosted page | Shows items, total, **Pay in 4 message**, PayPal / Apple Pay / card buttons | screenshot |
| Buyer pays (PayPal popup) | Checkout offered Pay in full / **Pay in 4** / **Pay Monthly** / PayPal Credit / **Split this payment** | — |
| Invoice status | **PAID $57.00**, transaction 4GG399535T170464N | GET invoice |
| Tracking on invoice payment | 200, read back | debug_id f468690aa8be2 |
| Create + send + **cancel** second invoice (claim-released path) | **CANCELLED** | INV2-SR3P-LSDP-ULTB-WACY |
| `INVOICING.INVOICE.CANCELLED` event | created 07:59:09.6, immediately after cancel | events API |
| `INVOICING.INVOICE.PAID` event | created **08:00:27.9 (~13 s after paying)**, listed within ~45 s | events API |
| `PAYMENT.CAPTURE.COMPLETED` (from the earlier Orders test) | **never appeared in ~40 min** | events API |

**S1 verdict: PASS.**
- Invoice events are prompt.
- Order-capture events are unreliable in the sandbox.
- Keep polling the order/invoice as the source of truth.
