"use client";

import dynamic from "next/dynamic";

// Disable SSR for the entire app since genlayer-js requires browser APIs (window.ethereum)
const VeriAgentAppContent = dynamic(() => import("./VeriAgentAppContent"), { ssr: false });

export default function Page() {
  return <VeriAgentAppContent />;
}
