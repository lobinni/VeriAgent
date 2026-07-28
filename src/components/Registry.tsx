"use client";

import { AgentView } from "@/lib/genlayer";
import { genFromWei, short, timeAgo } from "@/lib/format";
import { explorerAddress } from "@/lib/config";

function VerdictBar({ a }: { a: AgentView }) {
  const total = a.pass + a.warn + a.fail || 1;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="verdict-bar" title={`${a.pass} pass · ${a.warn} warn · ${a.fail} fail`}>
      <span style={{ width: pct(a.pass), background: "var(--pass)" }} />
      <span style={{ width: pct(a.warn), background: "var(--warn)" }} />
      <span style={{ width: pct(a.fail), background: "var(--fail)" }} />
    </div>
  );
}

function scoreColor(score: number, total: number) {
  if (total === 0) return "var(--text-3)";
  if (score >= 75) return "var(--pass)";
  if (score >= 45) return "var(--warn)";
  return "var(--fail)";
}

export function Registry({ agents }: { agents: AgentView[] }) {
  return (
    <section className="section" id="registry">
      <div className="wrap">
        <div className="section-eyebrow">Live registry</div>
        <h2 className="section-title">Registered agents</h2>
        <p className="section-lead">
          Every card is read live from the contract on GenLayer Studio. The verity score is the mean outcome-match score across
          an agent&apos;s validated evaluations.
        </p>

        {agents.length === 0 ? (
          <div className="empty">No agents registered yet.</div>
        ) : (
          <div className="grid">
            {agents.map((a) => (
              <div className="agent-card" key={a.agent_id}>
                <div className="agent-top">
                  <div>
                    <div className="agent-name">{a.name}</div>
                    <div className="mono" style={{ color: "var(--text-3)", fontSize: 12, marginTop: 4 }}>
                      {a.agent_id}
                    </div>
                  </div>
                  <span className="agent-fw">{a.framework || "agent"}</span>
                </div>

                <div className="agent-desc">{a.description}</div>

                <div className="score-ring">
                  <div>
                    <span className="score-num" style={{ color: scoreColor(a.verity_score, a.total_evaluations) }}>
                      {a.total_evaluations === 0 ? "·" : a.verity_score}
                    </span>
                    {a.total_evaluations > 0 && <span className="score-max"> / 100</span>}
                  </div>
                  <div>
                    <div className="score-lbl">Verity score</div>
                    <div className="mono" style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3 }}>
                      {a.total_evaluations} evaluation{a.total_evaluations === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                <VerdictBar a={a} />

                <div className="agent-meta">
                  <span>
                    {a.pass}✓ · {a.warn}~ · {a.fail}✗
                  </span>
                  <span>
                    {a.endorsements > 0
                      ? `${genFromWei(a.bond_wei)} GEN bonded · ${a.endorsements}★`
                      : "no endorsements"}
                  </span>
                </div>
                <div className="agent-meta">
                  <a href={explorerAddress(a.owner)} target="_blank" rel="noreferrer">
                    owner {short(a.owner)}
                  </a>
                  <span>{timeAgo(a.registered_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
