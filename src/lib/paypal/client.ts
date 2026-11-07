// PayPal REST client (sandbox). Every endpoint and field here is verified in docs/CONTEXT.md
// (E-001…E-004) and developer.paypal.com/invoicing/object.md. PayPal is authoritative for payment
// state (AGENTS.md rule 12): callers read status with getInvoice, never assume it.
import { centsToValue } from "../domain/engine";

const BASE = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";
const TIMEOUT_MS = 15000;

export class PayPalError extends Error {
  constructor(
    public readonly status: number,
    public readonly name: string,
    public readonly debugId: string | null,
    public readonly issue: string | null,
    message: string,
  ) {
    super(message);
  }
}

let cached: { token: string; expiresAt: number } | null = null;

function basicAuth(): string {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not set");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function token(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) throw new PayPalError(res.status, "AUTH_FAILED", null, null, json.error_description ?? "token request failed");
  cached = { token: json.access_token, expiresAt: Date.now() + Math.max(60, (json.expires_in ?? 600) - 120) * 1000 };
  return cached.token;
}

/** CONTEXT trap T-1: PayPal reuses a token for up to 9 h; terminate it after changing app features. */
export async function terminateToken(): Promise<void> {
  const t = await token();
  await fetch(`${BASE}/v1/oauth2/token/terminate`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: `token=${encodeURIComponent(t)}&token_type_hint=ACCESS_TOKEN`,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  cached = null;
}

async function call<T>(method: string, path: string, body?: unknown, requestId?: string): Promise<{ json: T; debugId: string | null }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        Authorization: `Bearer ${await token()}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const debugId = res.headers.get("paypal-debug-id");
    const text = await res.text();
    const json = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
    if (res.status === 401 && attempt === 0) {
      cached = null; // expired or revoked token: refresh once
      continue;
    }
    if (!res.ok) {
      const details = json.details as { issue?: string; description?: string }[] | undefined;
      throw new PayPalError(
        res.status,
        String(json.name ?? "PAYPAL_ERROR"),
        debugId,
        details?.[0]?.issue ?? null,
        `${method} ${path} → ${res.status} ${String(json.name ?? "")}: ${details?.[0]?.description ?? String(json.message ?? "")}`,
      );
    }
    return { json: json as T, debugId };
  }
  throw new PayPalError(401, "AUTH_FAILED", null, null, "unauthorized after token refresh");
}

export interface InvoiceLine {
  name: string;
  qty: number;
  unitCents: number;
}

export interface InvoiceRead {
  id: string;
  status: string; // DRAFT | SENT | UNPAID | PAID | PARTIALLY_PAID | CANCELLED | PAYMENT_PENDING …
  payerLink: string | null;
  totalCents: number;
  paidCents: number;
  transactionId: string | null;
  paidAt: string | null;
}

const toCents = (value: string | undefined) => (value ? Math.round(Number(value) * 100) : 0);

/** Create and send a shareable invoice (no recipient email, D-003). allow_partial_payment is always false (B2). */
export async function createShareableInvoice(input: {
  lines: InvoiceLine[];
  note: string;
  reference: string;
  idempotencyKey: string;
}): Promise<{ id: string; payerLink: string; debugId: string | null }> {
  const created = await call<{ id?: string; href?: string }>(
    "POST",
    "/v2/invoicing/invoices",
    {
      detail: {
        currency_code: "USD",
        note: input.note,
        reference: input.reference.slice(0, 120),
        terms_and_conditions: "Live-sale hold. Unpaid holds pass to the next buyer when the timer ends.",
      },
      items: input.lines.map((l) => ({
        name: l.name.slice(0, 200),
        quantity: String(l.qty),
        unit_amount: { currency_code: "USD", value: centsToValue(l.unitCents) },
      })),
      configuration: { allow_tip: false, partial_payment: { allow_partial_payment: false } },
    },
    `${input.idempotencyKey}-create`,
  );
  const id = created.json.id ?? created.json.href?.split("/").pop();
  if (!id) throw new PayPalError(500, "NO_INVOICE_ID", created.debugId, null, "create returned no id");
  const sent = await call<{ href?: string }>(
    "POST",
    `/v2/invoicing/invoices/${id}/send`,
    { send_to_recipient: false, send_to_invoicer: false },
    `${input.idempotencyKey}-send`,
  );
  const payerLink = sent.json.href ?? `https://www.sandbox.paypal.com/invoice/p/#${id}`;
  return { id, payerLink, debugId: sent.debugId };
}

export async function getInvoice(id: string): Promise<InvoiceRead> {
  const { json } = await call<{
    id: string;
    status: string;
    detail?: { metadata?: { recipient_view_url?: string } };
    amount?: { value?: string };
    payments?: { paid_amount?: { value?: string }; transactions?: { payment_id?: string; payment_date?: string }[] };
  }>("GET", `/v2/invoicing/invoices/${id}`);
  const tx = json.payments?.transactions?.[0];
  return {
    id: json.id,
    status: json.status,
    payerLink: json.detail?.metadata?.recipient_view_url ?? null,
    totalCents: toCents(json.amount?.value),
    paidCents: toCents(json.payments?.paid_amount?.value),
    transactionId: tx?.payment_id ?? null,
    paidAt: tx?.payment_date ?? null,
  };
}

/**
 * Cancel for a Passed hold. B1: callers re-read first; if PayPal still refuses because the invoice
 * was paid in the meantime, this returns { cancelled: false } and the hold ends Paid instead.
 */
export async function cancelInvoice(id: string, note: string, idempotencyKey: string): Promise<{ cancelled: boolean; error?: PayPalError }> {
  try {
    await call(
      "POST",
      `/v2/invoicing/invoices/${id}/cancel`,
      { subject: "Hold passed", note, send_to_recipient: false, send_to_invoicer: false },
      `${idempotencyKey}-cancel`,
    );
    return { cancelled: true };
  } catch (e) {
    if (e instanceof PayPalError && e.status >= 400 && e.status < 500) return { cancelled: false, error: e };
    throw e;
  }
}
