"use client";

import { CHAIN, CONTRACT_ADDRESS, DEPLOY_TX, explorerContract, explorerTx } from "@/lib/config";
import { ConfigView } from "@/lib/genlayer";
import { short } from "@/lib/format";

const METHODS: { sig: string; kind: "view" | "write" | "payable"; note: string }[] = [
  { sig: "register_agent(agent_id, name, framework, description, manifest_url)", kind: "write", note: "Add an agent to the registry." },
  { sig: "authorize_evaluator(agent_id, evaluator_address)", kind: "write", note: "Owner grants an address evaluation rights." },
  { sig: "revoke_evaluator(agent_id, evaluator_address)", kind: "write", note: "Owner revokes evaluation rights." },
  { sig: "commit_task(agent_id, task) → task_id", kind: "write", note: "Authorized caller commits a task on-chain." },
  { sig: "request_evaluation(task_id, claimed_outcome, evidence, evidence_url) → eval_id", kind: "write", note: "Evaluate a committed task. Validators fetch the evidence URL." },
  { sig: "endorse_agent(agent_id) → endorsement_id", kind: "payable", note: "Stake GEN behind an agent." },
  { sig: "withdraw_endorsement(endorsement_id)", kind: "write", note: "Endorser withdraws stake after 24h cooldown." },
  { sig: "slash_endorsement(endorsement_id)", kind: "write", note: "Agent owner slashes bond on fail verdict." },
  { sig: "refund_endorsement(endorsement_id)", kind: "write", note: "Contract owner refunds in disputes." },
  { sig: "get_agent(agent_id) → agent", kind: "view", note: "One agent with its verity record." },
  { sig: "list_agents() → agent[]", kind: "view", note: "Every registered agent." },
  { sig: "get_task(task_id) / list_tasks_for_agent(agent_id)", kind: "view", note: "Read committed tasks." },
  { sig: "get_evaluation(eval_id) / get_recent_evaluations(limit)", kind: "view", note: "Read evaluations." },
  { sig: "get_endorsement(id) / list_endorsements_for_agent(agent_id)", kind: "view", note: "Read endorsements." },
  { sig: "get_authorized_evaluators(agent_id)", kind: "view", note: "List authorized addresses." },
  { sig: "get_stats() → stats", kind: "view", note: "Counts: agents, evaluations, tasks, fees." },
  { sig: "get_config() → config", kind: "view", note: "Owner, fee_bps, thresholds, cooldown." },
];

export function Docs({ config }: { config: ConfigView | null }) {
  const pass = config?.pass_threshold ?? 75;
  const warn = config?.warn_threshold ?? 45;
  const tol = config?.score_tolerance ?? 12;
  const cooldown = config?.endorsement_cooldown ?? 86400;

  return (
    <section className="section" id="docs">
      <div className="wrap">
        <div className="section-eyebrow">Documentation</div>
        <h2 className="section-title">Security model and contract reference</h2>

        <div className="docs-grid">
          <div className="doc-card">
            <h3>Security: Authorized Evaluators &amp; Task Commitment</h3>
            <p>
              Only the <strong>agent owner</strong> or addresses explicitly authorized via
              <code> authorize_evaluator</code> may submit evaluations. Random callers cannot
              spam evaluations to manipulate an agent&apos;s verity score.
            </p>
            <p style={{ marginTop: 12 }}>
              Before evaluation, the counterparty <strong>commits the task on-chain</strong> via
              <code> commit_task</code>, receiving a <code>task_id</code>. The evaluation
              references that <code>task_id</code>, binding the verdict to a prior on-chain
              record. Each task can only be evaluated once.
            </p>
          </div>

          <div className="doc-card">
            <h3>Evidence Verification &amp; LLM Consensus</h3>
            <p>
              When an <code>evidence_url</code> is provided, validators <strong>fetch the URL
              content</strong> inside the non-deterministic block and cross-reference it against
              the inline evidence in the LLM prompt. If the URL is unreachable or its content
              contradicts the inline text, the score is penalized.
            </p>
            <p style={{ marginTop: 12 }}>
              Validators agree within <b>{tol} points</b>. Verdicts:{" "}
              <span className="chip pass">pass</span> ≥{pass},{" "}
              <span className="chip warn">warn</span> {warn}–{pass - 1},{" "}
              <span className="chip fail">fail</span> &lt;{warn}.
            </p>
          </div>
        </div>

        <div className="docs-grid" style={{ marginTop: 16 }}>
          <div className="doc-card">
            <h3>Endorsement Lifecycle</h3>
            <p>Endorsed GEN follows a complete lifecycle:</p>
            <div className="method"><strong>endorse_agent</strong> — Anyone stakes GEN <span className="kind write">payable</span></div>
            <div className="method"><strong>withdraw_endorsement</strong> — Endorser withdraws after {cooldown / 3600}h cooldown <span className="kind write">write</span></div>
            <div className="method"><strong>slash_endorsement</strong> — Agent owner slashes on fail verdict <span className="kind write">write</span></div>
            <div className="method"><strong>refund_endorsement</strong> — Contract owner refunds in disputes <span className="kind write">write</span></div>
          </div>

          <div className="doc-card">
            <h3>Network and addresses</h3>
            <div className="method">
              contract
              <div className="mono" style={{ marginTop: 6 }}>
                <a href={explorerContract(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">{CONTRACT_ADDRESS}</a>
              </div>
            </div>
            <div className="method">
              deploy tx
              <div className="mono" style={{ marginTop: 6 }}>
                <a href={explorerTx(DEPLOY_TX)} target="_blank" rel="noreferrer">{short(DEPLOY_TX, 14, 10)}</a>
              </div>
            </div>
            <div className="method">network <span className="ret">{CHAIN.name} · chain id {CHAIN.id}</span></div>
            <div className="method">rpc <span className="ret mono">{CHAIN.rpc}</span></div>
          </div>
        </div>

        <div className="doc-card" style={{ marginTop: 16 }}>
          <h3>Contract methods</h3>
          {METHODS.map((m) => (
            <div className="method" key={m.sig}>
              {m.sig}
              <span className={`kind ${m.kind === "view" ? "view" : "write"}`}>{m.kind}</span>
              <div className="ret" style={{ marginTop: 4 }}>{m.note}</div>
            </div>
          ))}
        </div>

        <div className="doc-card" style={{ marginTop: 16 }}>
          <h3>Read it yourself</h3>
          <p>Anyone can read the protocol with genlayer-js and no wallet:</p>
          <pre className="code">
            <span className="cmt">{`// npm i genlayer-js`}</span>
{`\n`}<span className="kw">{`import`}</span>{` { createClient } `}<span className="kw">{`from`}</span>{` "genlayer-js";\n`}
<span className="kw">{`import`}</span>{` { studionet } `}<span className="kw">{`from`}</span>{` "genlayer-js/chains";\n\n`}
{`const client = createClient({ chain: studionet });\n`}
{`const agents = await client.readContract({\n`}
{`  address: "${CONTRACT_ADDRESS}",\n`}
{`  functionName: "list_agents",\n`}
{`  args: [],\n`}
{`});`}
          </pre>
        </div>
      </div>
    </section>
  );
}
