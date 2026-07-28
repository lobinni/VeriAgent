// VeriAgent GenLayer client — connects to GenLayer Studio network.

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { CONTRACT_ADDRESS } from "./config";

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
};

let _readClient: ReturnType<typeof createClient> | null = null;
export function readClient() {
  if (!_readClient) {
    _readClient = createClient({ chain: studionet });
  }
  return _readClient;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (err: any) {
      lastErr = err;
      if (i < tries - 1) await sleep(1200 * (i + 1));
    }
  }
  throw lastErr;
}

const read = <T>(functionName: string, args: unknown[] = []) =>
  withRetry<T>(() =>
    readClient().readContract({
      address: CONTRACT_ADDRESS, functionName, args: args as any,
    }) as Promise<T>
  );

// ── Types matching VeriAgent contract v2 (contracts/veriagent.py) ──

export type StatsView = {
  total_agents: number;
  total_evaluations: number;
  total_tasks: number;
  fees_accrued_wei: string;
};

export type ConfigView = {
  owner: string;
  fee_recipient: string;
  fee_bps: number;
  score_tolerance: number;
  pass_threshold: number;
  warn_threshold: number;
  endorsement_cooldown: number;
};

export type AgentView = {
  agent_id: string;
  owner: string;
  name: string;
  framework: string;
  description: string;
  manifest_url: string;
  registered_at: string;
  total_evaluations: number;
  pass: number;
  warn: number;
  fail: number;
  verity_score: number;
  endorsements: number;
  bond_wei: string;
  slashed_wei: string;
};

export type TaskView = {
  task_id: string;
  agent_id: string;
  committer: string;
  task: string;
  committed_at: string;
  evaluated: boolean;
};

export type EvaluationView = {
  eval_id: string;
  agent_id: string;
  task_id: string;
  requester: string;
  task: string;
  claimed_outcome: string;
  evidence: string;
  evidence_url: string;
  evidence_fetched: boolean;
  score: number;
  verdict: string;
  reasoning: string;
  created_at: string;
};

export type EndorsementView = {
  endorsement_id: string;
  agent_id: string;
  endorser: string;
  amount_wei: string;
  created_at: string;
  status: string; // "active" | "withdrawn" | "slashed" | "refunded"
};

export const api = {
  stats: () => read<StatsView>("get_stats"),
  config: () => read<ConfigView>("get_config"),
  listAgents: () => read<AgentView[]>("list_agents"),
  agent: (id: string) => read<AgentView>("get_agent", [id]),
  recent: (limit: number) => read<EvaluationView[]>("get_recent_evaluations", [limit]),
  evalsForAgent: (id: string) => read<EvaluationView[]>("list_evaluations_for_agent", [id]),
  tasksForAgent: (id: string) => read<TaskView[]>("list_tasks_for_agent", [id]),
  endorsementsForAgent: (id: string) => read<EndorsementView[]>("list_endorsements_for_agent", [id]),
  authorizedEvaluators: (id: string) => read<string[]>("get_authorized_evaluators", [id]),
};
