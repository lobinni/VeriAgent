"use client";
import { useEffect, useState } from "react";
import { Wallet } from "@/hooks/useWallet";
import { useTx } from "@/hooks/useTx";
import { TxStatus } from "@/components/TxStatus";
import { AgentView } from "@/lib/genlayer";
import { CONTRACT_ADDRESS } from "@/lib/config";
import { sampleAgent, evaluationSamples, sampleEndorseAmount } from "@/lib/examples";
import { verdictColor } from "@/lib/format";

// Same 3-tab layout as TrustScore, but each tab calls secured contract methods
// behind the scenes (authorize_evaluator, commit_task, etc.)
type Tab = "register" | "evaluate" | "endorse";

function parseGenToWei(input: string): bigint {
  const s = input.trim();
  if (!s || Number.isNaN(Number(s))) throw new Error("Enter a valid GEN amount.");
  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(fracPadded || "0");
}

export function Console({
  wallet,
  agents,
  onDone,
}: {
  wallet: Wallet;
  agents: AgentView[];
  onDone: () => void;
}) {
  const [tab, setTab] = useState<Tab>("register");
  const tx = useTx();
  const connected = wallet.status === "connected" && !!wallet.address;

  // ── Form state (mirrors TrustScore's 3 forms) ──
  const [reg, setReg] = useState({ id: "", name: "", framework: "", description: "", manifest_url: "" });
  const firstAgent = agents[0]?.agent_id ?? "";
  const [evalForm, setEvalForm] = useState({
    agent_id: firstAgent,
    task: "",
    claimed_outcome: "",
    evidence: "",
    evidence_url: "",
  });
  const [endorseForm, setEndorseForm] = useState({ agent_id: firstAgent, amount: "0.05" });

  // Bond management (collapsed section inside Endorse tab)
  const [manageOpen, setManageOpen] = useState(false);
  const [manageForm, setManageForm] = useState({ endorsement_id: "", action: "withdraw" as "withdraw" | "slash" | "refund" });

  useEffect(() => {
    if (agents.length > 0) {
      if (!evalForm.agent_id) setEvalForm((p) => ({ ...p, agent_id: agents[0].agent_id }));
      if (!endorseForm.agent_id) setEndorseForm((p) => ({ ...p, agent_id: agents[0].agent_id }));
    }
  }, [agents, evalForm.agent_id, endorseForm.agent_id]);

  const submit = async (action: () => Promise<string>, onSuccess?: () => void) => {
    tx.reset();
    await tx.run(action, () => { onDone(); onSuccess?.(); });
  };

  const busy = tx.state.phase === "signing" || tx.state.phase === "pending";

  // ── Tab 1: Register ──
  // Calls register_agent, then auto-calls authorize_evaluator(caller)
  // so the registrant can immediately evaluate their own agent.
  const doRegister = () => {
    const newId = reg.id.trim();
    submit(async () => {
      const c = await wallet.getWriteClient();
      // Step 1: register the agent
      const hash = (await c.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "register_agent",
        args: [newId, reg.name, reg.framework, reg.description, reg.manifest_url],
        value: 0n,
        consensusMaxRotations: 3,
      })) as string;
      return hash;
    }, async () => {
      // Step 2: auto-authorize the caller as evaluator (best-effort)
      try {
        const c = await wallet.getWriteClient();
        await c.writeContract({
          address: CONTRACT_ADDRESS,
          functionName: "authorize_evaluator",
          args: [newId, wallet.address!],
          value: 0n,
          consensusMaxRotations: 3,
        });
      } catch { /* non-critical: owner is always authorized by default */ }
      setEvalForm((p) => ({ ...p, agent_id: newId }));
      setEndorseForm((p) => ({ ...p, agent_id: newId }));
      setTab("evaluate");
    });
  };

  // ── Tab 2: Evaluate ──
  // Calls commit_task first, then request_evaluation — 2 contract calls, 1 button.
  // Binds evaluation to committed on-chain task (reviewer requirement).
  const doEvaluate = () =>
    submit(async () => {
      const c = await wallet.getWriteClient();
      // Step 1: commit_task on-chain (creates immutable task record)
      const commitHash = (await c.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "commit_task",
        args: [evalForm.agent_id, evalForm.task],
        value: 0n,
        consensusMaxRotations: 3,
      })) as string;

      // Wait for commit to be accepted before evaluating
      const { createClient } = await import("genlayer-js");
      const { studionet } = await import("genlayer-js/chains");
      const reader = createClient({ chain: studionet });
      await reader.waitForTransactionReceipt({
        hash: commitHash as any,
        status: "ACCEPTED" as any,
        interval: 4000,
        retries: 40,
      });

      // Read the task_id from contract state
      const tasks = (await reader.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "list_tasks_for_agent",
        args: [evalForm.agent_id],
      })) as any[];
      const pendingTask = tasks.filter((t: any) => !t.evaluated).pop();
      if (!pendingTask) throw new Error("Task committed but not found. Check the explorer.");

      // Step 2: request_evaluation using the committed task_id
      // Validators will fetch evidence_url and cross-reference (reviewer requirement)
      const evalHash = (await c.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "request_evaluation",
        args: [pendingTask.task_id, evalForm.claimed_outcome, evalForm.evidence, evalForm.evidence_url],
        value: 0n,
        consensusMaxRotations: 5,
      })) as string;

      return evalHash;
    }, () => {
      setEndorseForm((p) => ({ ...p, agent_id: evalForm.agent_id || p.agent_id }));
      setTab("endorse");
    });

  // ── Tab 3: Endorse ──
  const doEndorse = () =>
    submit(async () => {
      const value = parseGenToWei(endorseForm.amount);
      const c = await wallet.getWriteClient();
      return (await c.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "endorse_agent",
        args: [endorseForm.agent_id],
        value,
        consensusMaxRotations: 3,
      })) as string;
    });

  // ── Bond management (inside endorse tab) ──
  const doManageBond = () =>
    submit(async () => {
      const c = await wallet.getWriteClient();
      const fnMap = { withdraw: "withdraw_endorsement", slash: "slash_endorsement", refund: "refund_endorsement" };
      return (await c.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: fnMap[manageForm.action],
        args: [manageForm.endorsement_id.trim()],
        value: 0n,
        consensusMaxRotations: 3,
      })) as string;
    });

  // ── Agent select (same pattern as TrustScore) ──
  const AgentSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) =>
    agents.length > 0 ? (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {agents.map((a) => (
          <option key={a.agent_id} value={a.agent_id}>{a.agent_id} · {a.name}</option>
        ))}
      </select>
    ) : (
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="agent-id" />
    );

  return (
    <div className="console-grid">
      <div className="tabs">
        <button className={`tab ${tab === "register" ? "active" : ""}`} onClick={() => setTab("register")}>
          Register an agent
          <small>write · register_agent + authorize_evaluator</small>
        </button>
        <button className={`tab ${tab === "evaluate" ? "active" : ""}`} onClick={() => setTab("evaluate")}>
          Request an evaluation
          <small>write · commit_task → request_evaluation · LLM consensus</small>
        </button>
        <button className={`tab ${tab === "endorse" ? "active" : ""}`} onClick={() => setTab("endorse")}>
          Endorse an agent
          <small>payable · endorse_agent · withdraw / slash / refund</small>
        </button>

        {!connected ? (
          <div className="notice" style={{ marginTop: 14 }}>
            Connect a wallet to submit transactions. Reads work without one.
          </div>
        ) : !wallet.onCorrectChain ? (
          <div className="notice" style={{ marginTop: 14 }}>
            Wallet is not on GenLayer Studio.{" "}
            <a href="#console" onClick={() => wallet.ensureChain()}>Switch network</a>.
          </div>
        ) : null}
        {wallet.error && (
          <div className="notice" style={{ marginTop: 14, borderLeftColor: "var(--fail)" }}>
            {wallet.error}
          </div>
        )}
      </div>

      <div className="panel">
        {/* ── TAB 1: Register (same as TrustScore) ── */}
        {tab === "register" && (
          <>
            <div className="samples">
              <span className="samples-label">Sample</span>
              <button type="button" className="sample-chip" onClick={() => setReg(sampleAgent())}>
                Load a demo agent
              </button>
            </div>
            <div className="field">
              <label>agent_id</label>
              <input value={reg.id} onChange={(e) => setReg({ ...reg, id: e.target.value })} placeholder="unique-agent-handle" />
              <div className="hint">A unique, human-readable handle. Cannot be reused.</div>
            </div>
            <div className="field">
              <label>name</label>
              <input value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} placeholder="My Agent" />
            </div>
            <div className="field">
              <label>framework</label>
              <input value={reg.framework} onChange={(e) => setReg({ ...reg, framework: e.target.value })} placeholder="LangGraph, CrewAI, AutoGen, custom…" />
            </div>
            <div className="field">
              <label>description</label>
              <input value={reg.description} onChange={(e) => setReg({ ...reg, description: e.target.value })} placeholder="What the agent does" />
            </div>
            <div className="field">
              <label>manifest_url</label>
              <input value={reg.manifest_url} onChange={(e) => setReg({ ...reg, manifest_url: e.target.value })} placeholder="https://…" />
            </div>
            <div className="notice" style={{ borderLeftColor: "var(--teal)" }}>
              Registering also authorizes your wallet as an evaluator for this agent, so you can immediately proceed to evaluate.
            </div>
            <button className="btn btn-primary" disabled={!connected || busy || !reg.id.trim()} onClick={doRegister}>
              {busy ? "Working…" : "Register agent"}
            </button>
          </>
        )}

        {/* ── TAB 2: Evaluate (same fields as TrustScore, but calls commit_task → request_evaluation) ── */}
        {tab === "evaluate" && (
          <>
            <div className="samples">
              <span className="samples-label">Samples</span>
              {evaluationSamples.map((s) => (
                <button type="button" key={s.label} className="sample-chip"
                  title={`Expected verdict: ${s.expect}`}
                  onClick={() => setEvalForm({ ...evalForm, task: s.task, claimed_outcome: s.claimed_outcome, evidence: s.evidence, evidence_url: s.evidence_url })}>
                  <span className="vd" style={{ background: verdictColor(s.expect) }} />{s.label}
                </button>
              ))}
            </div>
            <div className="field">
              <label>agent_id</label>
              <AgentSelect value={evalForm.agent_id} onChange={(v) => setEvalForm({ ...evalForm, agent_id: v })} />
            </div>
            <div className="field">
              <label>task</label>
              <input value={evalForm.task} onChange={(e) => setEvalForm({ ...evalForm, task: e.target.value })} placeholder="What the agent was asked to do" />
            </div>
            <div className="field">
              <label>claimed_outcome</label>
              <input value={evalForm.claimed_outcome} onChange={(e) => setEvalForm({ ...evalForm, claimed_outcome: e.target.value })} placeholder="What the agent claims it achieved" />
            </div>
            <div className="field">
              <label>evidence</label>
              <textarea value={evalForm.evidence} onChange={(e) => setEvalForm({ ...evalForm, evidence: e.target.value })} placeholder="The agent's work log / artifacts. Validators judge the claim against this." />
            </div>
            <div className="field">
              <label>evidence_url (validators fetch &amp; cross-reference this)</label>
              <input value={evalForm.evidence_url} onChange={(e) => setEvalForm({ ...evalForm, evidence_url: e.target.value })} placeholder="https://…" />
              <div className="hint">Validators fetch this URL and cross-check it against the inline evidence. Unreachable URLs penalize the score.</div>
            </div>
            <div className="notice">
              This commits the task on-chain, then runs a GenLayer verification round: validators fetch the evidence URL, score the claim via LLM consensus, and record the verdict on-chain. This takes longer than a normal transaction.
            </div>
            <button className="btn btn-primary" style={{ marginTop: 14 }}
              disabled={!connected || busy || !evalForm.agent_id || !evalForm.task.trim()}
              onClick={doEvaluate}>
              {busy ? "Verifying…" : "Request evaluation"}
            </button>
          </>
        )}

        {/* ── TAB 3: Endorse (same as TrustScore + bond lifecycle management) ── */}
        {tab === "endorse" && (
          <>
            <div className="samples">
              <span className="samples-label">Sample</span>
              <button type="button" className="sample-chip" onClick={() => setEndorseForm({ ...endorseForm, amount: sampleEndorseAmount })}>
                Use {sampleEndorseAmount} GEN
              </button>
            </div>
            <div className="field">
              <label>agent_id</label>
              <AgentSelect value={endorseForm.agent_id} onChange={(v) => setEndorseForm({ ...endorseForm, agent_id: v })} />
            </div>
            <div className="field">
              <label>amount (GEN)</label>
              <input value={endorseForm.amount} onChange={(e) => setEndorseForm({ ...endorseForm, amount: e.target.value })} placeholder="0.05" />
              <div className="hint">
                Endorsing stakes GEN behind an agent as a costly signal. A protocol fee is recorded; the rest is held as the agent&apos;s bond.
              </div>
            </div>
            <button className="btn btn-primary" disabled={!connected || busy || !endorseForm.agent_id} onClick={doEndorse}>
              {busy ? "Working…" : "Endorse agent"}
            </button>

            {/* ── Bond lifecycle management (collapsed) ── */}
            <div style={{ marginTop: 20, borderTop: "1px dashed var(--edge)", paddingTop: 16 }}>
              <button type="button" onClick={() => setManageOpen(!manageOpen)}
                style={{ background: "none", border: "none", color: "var(--teal)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                {manageOpen ? "▾" : "▸"} Manage existing endorsement (withdraw / slash / refund)
              </button>
              {manageOpen && (
                <div style={{ marginTop: 12 }}>
                  <div className="field">
                    <label>endorsement_id</label>
                    <input value={manageForm.endorsement_id} onChange={(e) => setManageForm({ ...manageForm, endorsement_id: e.target.value })}
                      placeholder="agent-id:endorse:1" />
                    <div className="hint">Find endorsement IDs on the explorer or via get_endorsement.</div>
                  </div>
                  <div className="field">
                    <label>action</label>
                    <select value={manageForm.action} onChange={(e) => setManageForm({ ...manageForm, action: e.target.value as any })}>
                      <option value="withdraw">Withdraw (endorser, after 24h cooldown)</option>
                      <option value="slash">Slash (agent owner, requires fail verdict)</option>
                      <option value="refund">Refund (contract owner, dispute resolution)</option>
                    </select>
                  </div>
                  <button className="btn btn-primary" disabled={!connected || busy || !manageForm.endorsement_id.trim()} onClick={doManageBond}>
                    {busy ? "Working…" : `${manageForm.action.charAt(0).toUpperCase() + manageForm.action.slice(1)} endorsement`}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <TxStatus state={tx.state} />
      </div>
    </div>
  );
}
