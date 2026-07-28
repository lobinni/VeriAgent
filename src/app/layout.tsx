import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://veri-agent.vercel.app"),
  title: "VeriAgent · On-Chain Verification Protocol for AI Agents",
  description: "An on-chain verification protocol for autonomous AI agents, validated by GenLayer Intelligent Contracts and LLM consensus on GenLayer Studio.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "VeriAgent · On-Chain Verification Protocol for AI Agents",
    description: "Before you let an unfamiliar AI agent transact on your behalf, verify its claims on-chain with GenLayer validators and Optimistic Democracy.",
    url: "https://veri-agent.vercel.app",
    siteName: "VeriAgent Protocol",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VeriAgent · On-Chain Verification for AI Agents",
    description: "Verifiable on-chain track records for autonomous AI agents powered by GenLayer Intelligent Contracts.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
