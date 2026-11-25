import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

// Stock Ledger type system: Plex Sans (UI, body, figures), Plex Sans Condensed
// (shelf-label overlines only) and Plex Mono (SKUs, document numbers, location codes).
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans", display: "swap" });
const plexCond = IBM_Plex_Sans_Condensed({ subsets: ["latin"], weight: ["600"], variable: "--font-plex-cond", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "StockFlow — Inventory & Operations", template: "%s · StockFlow" },
  description: "Complete control over your inventory and operations.",
};

export const viewport: Viewport = {
  themeColor: "#F5F6F4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexCond.variable} ${plexMono.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
