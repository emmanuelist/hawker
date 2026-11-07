import type { Metadata } from "next";
import { LedgerShell } from "./LedgerShell";

export const metadata: Metadata = { title: "Ledger · Hawker", description: "Every hold on the demo stall, paid through PayPal or passed to the next buyer, in AG Studio." };

export default function Page() {
  return <LedgerShell stall="ada" />;
}
