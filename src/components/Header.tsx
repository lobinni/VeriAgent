"use client";

import { Logo } from "@/components/Logo";
import { GitHubIcon } from "@/components/GitHubIcon";
import { Wallet } from "@/hooks/useWallet";
import { CHAIN, CONTRACT_ADDRESS, REPO_URL, explorerContract } from "@/lib/config";
import { short } from "@/lib/format";

export function Header({ wallet }: { wallet: Wallet }) {
  const { status, address, onCorrectChain } = wallet;

  return (
    <header className="header" id="top">
      <div className="wrap header-inner">
        <Logo />
        <nav>
          <a href="#how">How it works</a>
          <a href="#registry">Registry</a>
          <a href="#evaluations">Evaluations</a>
          <a href="#console">Console</a>
          <a href="#docs">Docs</a>
        </nav>
        <div className="header-right">
          <a
            className="icon-btn"
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="VeriAgent on GitHub"
            title="View source on GitHub"
          >
            <GitHubIcon size={18} />
          </a>
          <a
            className="netbadge"
            href={explorerContract(CONTRACT_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            title="View the deployed contract on the GenLayer Studio explorer"
            style={{ borderBottom: "none" }}
          >
            <span className="dot" />
            {CHAIN.name}
          </a>
          {status === "connected" && address ? (
            <button
              className="btn"
              onClick={wallet.disconnect}
              title={onCorrectChain ? address : "Wallet is not on GenLayer Studio"}
            >
              <span className="dot" style={{ background: onCorrectChain ? "var(--pass)" : "var(--warn)" }} />
              <span className="mono">{short(address)}</span>
            </button>
          ) : (
            <button className="btn btn-primary" onClick={wallet.connect} disabled={status === "connecting"}>
              {status === "connecting" ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
