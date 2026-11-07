import type { Metadata } from "next";
import { DeskClient } from "./DeskClient";

export const metadata: Metadata = { title: "Desk · Hawker" };

/** The demo desk for the demo stall (D-013). */
export default function Page() {
  return <DeskClient stall="ada" />;
}
