import type { Metadata } from "next";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://aegis.vercel.app";
const TITLE = "Aegis";
const DESCRIPTION = "Autonomous wallet infrastructure for AI agents on Solana. Structured intents, policy enforcement, and real-time execution — all on-chain.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: TITLE,
    template: `%s · ${TITLE}`,
  },
  description: DESCRIPTION,
  keywords: [
    "Solana",
    "AI agents",
    "autonomous wallet",
    "structured intents",
    "DeFi",
    "on-chain",
    "policy engine",
  ],
  authors: [{ name: "Aegis" }],
  creator: "Aegis",
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
    ],
    apple: [
      { url: "/logo.png", type: "image/png" },
    ],
    shortcut: "/logo.png",
  },
  openGraph: {
    type: "website",
    url: APP_URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: TITLE,
    images: [
      {
        url: "/opengraph-image.png",
        width: 800,
        height: 800,
        alt: "Aegis — autonomous wallet infrastructure for AI agents",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/twitter-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}
