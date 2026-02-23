import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aegis",
  description: "autonomous wallet infrastructure for AI agents on Solana",
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
