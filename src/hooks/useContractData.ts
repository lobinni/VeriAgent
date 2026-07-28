"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, AgentView, EvaluationView, StatsView, ConfigView } from "@/lib/genlayer";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type ContractData = {
  stats: StatsView | null;
  config: ConfigView | null;
  agents: AgentView[];
  recent: EvaluationView[];
  loading: boolean;
  error: string | null;
  retrying: boolean;
  refresh: () => Promise<void>;
};

export function useContractData(): ContractData {
  const [stats, setStats] = useState<StatsView | null>(null);
  const [config, setConfig] = useState<ConfigView | null>(null);
  const [agents, setAgents] = useState<AgentView[]>([]);
  const [recent, setRecent] = useState<EvaluationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await api.stats();
      setStats(s);
      await sleep(200);
      const c = await api.config();
      setConfig(c);
      await sleep(200);
      const a = await api.listAgents();
      setAgents(a);
      await sleep(200);
      const r = await api.recent(12);
      setRecent(r);
      // Success — reset retry counter
      retryCount.current = 0;
      setRetrying(false);
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || "Failed to read the contract.";
      if (msg.includes("contract not found")) {
        setError(
          "Contract is deployed but the RPC is still indexing it. " +
          "Auto-retrying… Data will appear once the RPC has caught up."
        );
        // Auto-retry: back off 10s → 15s → 20s → 30s, max 12 attempts
        if (retryCount.current < 12) {
          retryCount.current += 1;
          setRetrying(true);
          const delay = Math.min(10000 + retryCount.current * 5000, 30000);
          retryTimer.current = setTimeout(() => {
            refresh();
          }, delay);
        } else {
          setRetrying(false);
          setError(
            "Contract is deployed but the GenLayer RPC has not indexed it yet. " +
            "This can take a few minutes after deployment. Please try refreshing the page later."
          );
        }
      } else {
        setError(msg);
        setRetrying(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [refresh]);

  return { stats, config, agents, recent, loading, error, retrying, refresh };
}
