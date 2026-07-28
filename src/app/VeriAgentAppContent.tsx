"use client";

import { useEffect } from "react";
import { Header } from "@/components/Header";
import { Logo, LogoMark } from "@/components/Logo";
import { GitHubIcon } from "@/components/GitHubIcon";
import { Registry } from "@/components/Registry";
import { Adjudications } from "@/components/Adjudications";
import { Console } from "@/components/Console";
import { Docs } from "@/components/Docs";
import { useWallet } from "@/hooks/useWallet";
import { useContractData } from "@/hooks/useContractData";
import { CHAIN, CONTRACT_ADDRESS, DEPLOY_TX, REPO_URL, explorerContract, explorerTx } from "@/lib/config";
import { genFromWei, short } from "@/lib/format";

const STEPS = [
  {
    t: "Register",
    d: "An agent is added to the protocol with a handle, framework, and description. Its owner is the wallet that registers it.",
  },
  {
    t: "Submit a claim",
    d: "A counterparty submits a task the agent accepted, the outcome the agent claims, and the evidence of its work.",
  },
  {
    t: "Validators adjudicate",
    d: "GenLayer validators each score the claim against the evidence with an LLM and reach consensus within tolerance.",
  },
  {
    t: "Verity score updates",
    d: "The verdict and reasoning are written on-chain and folded into the agent's running verity score.",
  },
];

function Hero({
  agents,
  evaluations,
  totalBond,
  endorsements,
}: {
  agents: number | null;
  evaluations: number | null;
  totalBond: string | null;
  endorsements: number | null;
}) {
  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <div>
          <div className="section-eyebrow">Verification protocol for AI agents · GenLayer</div>
          <h1>
            On-chain verification for <span className="accent">autonomous agents</span>.
          </h1>
          <p className="lead">
            Before you let an unfamiliar AI agent transact, you need to know whether it delivers what it claims. VeriAgent
            records each agent&apos;s work, has GenLayer validators adjudicate the evidence, and keeps the verdicts on-chain
            where anyone can read them.
          </p>
          <div className="hero-cta">
            <a className="btn btn-primary" href="#console">
              Open the console
            </a>
            <a className="btn btn-ghost" href="#how">
              How it works
            </a>
          </div>
        </div>

        <div className="hero-card">
          <h4>Live on {CHAIN.name}</h4>
          <div className="kv">
            <span className="k">Contract</span>
            <span className="v">
              <a href={explorerContract(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">
                {short(CONTRACT_ADDRESS, 8, 6)}
              </a>
            </span>
          </div>
          <div className="kv">
            <span className="k">Deploy tx</span>
            <span className="v">
              <a href={explorerTx(DEPLOY_TX)} target="_blank" rel="noreferrer">
                {short(DEPLOY_TX, 8, 6)}
              </a>
            </span>
          </div>
          <div className="kv">
            <span className="k">Agents on record</span>
            <span className="v">{agents ?? "…"}</span>
          </div>
          <div className="kv">
            <span className="k">Validations</span>
            <span className="v">{evaluations ?? "…"}</span>
          </div>
          <div className="kv">
            <span className="k">Total bond staked</span>
            <span className="v">{totalBond != null ? `${genFromWei(totalBond)} GEN` : "…"}</span>
          </div>
          <div className="kv">
            <span className="k">Endorsements</span>
            <span className="v">{endorsements ?? "…"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="wrap">
        <div className="section-eyebrow">How it works</div>
        <h2 className="section-title">Claims in, validated verdicts out</h2>
        <p className="section-lead">
          The interface owns the presentation. The contract owns the registry, the adjudication, and the
          resulting verity scores. Validators own the judgment no oracle can produce.
        </p>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div className="step" key={s.t}>
              <div className="idx">{i + 1}</div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div>
          <Logo size={26} />
          <p style={{ maxWidth: "46ch", marginTop: 12, fontSize: 14 }}>
            An on-chain verification protocol for autonomous AI agents, validated by GenLayer validators.
          </p>
        </div>
        <div className="footer-links">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
          >
            <GitHubIcon size={16} /> GitHub
          </a>
          <a href={explorerContract(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">
            Contract
          </a>
          <a href={explorerTx(DEPLOY_TX)} target="_blank" rel="noreferrer">
            Deploy tx
          </a>
          <a href="#docs">Docs</a>
          <a href="#console">Console</a>
          <a href="https://docs.genlayer.com" target="_blank" rel="noreferrer">
            Built on GenLayer
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function VeriAgentApp() {
  const wallet = useWallet();
  const data = useContractData();

  // Lightweight scroll reveal.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.08 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [data.loading]);

  return (
    <>
      <Header wallet={wallet} />
      <main>
        <Hero
          agents={data.stats?.total_agents ?? null}
          evaluations={data.stats?.total_evaluations ?? null}
          totalBond={
            data.agents.length > 0
              ? data.agents.reduce((sum, a) => {
                  const b = BigInt(a.bond_wei || "0");
                  return (BigInt(sum) + b).toString();
                }, "0")
              : null
          }
          endorsements={
            data.agents.length > 0
              ? data.agents.reduce((sum, a) => sum + (a.endorsements || 0), 0)
              : null
          }
        />
        <HowItWorks />
        <Registry agents={data.agents} />
        <Adjudications recent={data.recent} />

        <section className="section" id="console">
          <div className="wrap">
            <div className="section-eyebrow">Interactive console</div>
            <h2 className="section-title">Read and write the live contract</h2>
            <p className="section-lead">
              Register an agent, request a validation round, or endorse an agent with GEN. Transactions are signed by your
              wallet on {CHAIN.name} and show live status with a link to the explorer. Use the
              sample buttons at the top of each form to prefill a realistic request.
            </p>
            {data.error && (
              <div className="notice" style={{ borderLeftColor: data.retrying ? "var(--warn)" : "var(--fail)" }}>
                {data.error}
                {data.retrying && <span className="spinner" style={{ marginLeft: 10, verticalAlign: "middle" }} />}
                {!data.retrying && (
                  <>
                    {" "}
                    <a href="#console" onClick={(e) => { e.preventDefault(); data.refresh(); }}>
                      retry now
                    </a>
                  </>
                )}
              </div>
            )}
            <Console wallet={wallet} agents={data.agents} onDone={data.refresh} />
          </div>
        </section>

        <Docs config={data.config} />
      </main>
      <Footer />
      <div style={{ display: "none" }}>
        <LogoMark />
      </div>
    </>
  );
}
