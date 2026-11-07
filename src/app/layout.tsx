import type { Metadata, Viewport } from "next";
import { Courier_Prime, Libre_Franklin, Public_Sans } from "next/font/google";
import "./globals.css";

const franklin = Libre_Franklin({ variable: "--font-franklin", subsets: ["latin"] });
const publicSans = Public_Sans({ variable: "--font-public", subsets: ["latin"] });
const courier = Courier_Prime({ variable: "--font-courier", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Hawker",
  description: "Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.",
};

export const viewport: Viewport = {
  themeColor: "#2a3a8f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${franklin.variable} ${publicSans.variable} ${courier.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
