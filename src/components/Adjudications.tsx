"use client";

import { EvaluationView } from "@/lib/genlayer";
import { timeAgo, verdictColor } from "@/lib/format";

export function Adjudications({ recent }: { recent: EvaluationView[] }) {
  return (
    <section className="section" id="evaluations">
      <div className="wrap">
        <div className="section-eyebrow">Live evaluations</div>
        <h2 className="section-title">Recent verdicts</h2>
        <p className="section-lead">
          Each verdict is the consensus of GenLayer validators scoring the agent&apos;s claim against its evidence. The
          reasoning shown is written on-chain by the validation round.
        </p>

        {recent.length === 0 ? (
          <div className="empty">No evaluations yet.</div>
        ) : (
          <div className="eval-list">
            {recent.map((e) => (
              <div className="eval-row" key={e.eval_id}>
                <div className="eval-agent">
                  {e.agent_id}
                  <span className="eid">{e.eval_id}</span>
                  <span className="eid">{timeAgo(e.created_at)}</span>
                </div>
                <div className="eval-body">
                  <div className="task">{e.task}</div>
                  <div className="claim">claimed: {e.claimed_outcome}</div>
                  {e.reasoning && <div className="reason">{e.reasoning}</div>}
                  {e.evidence_url && (
                    <div style={{ marginTop: 8 }}>
                      <a href={e.evidence_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5 }}>
                        evidence reference ↗
                      </a>
                    </div>
                  )}
                </div>
                <div className="eval-side">
                  <span className={`chip ${e.verdict}`}>{e.verdict}</span>
                  <span className="eval-score" style={{ color: verdictColor(e.verdict) }}>
                    {e.score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
