import type { Metadata } from "next";
import { Landing } from "./Landing";

export const metadata: Metadata = {
  title: "Hawker · paid through PayPal, or passed to the next buyer",
  description: "Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.",
};

export default function Home() {
  return <Landing />;
}
