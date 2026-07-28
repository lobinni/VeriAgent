"use client";

import { useState, useCallback } from "react";

export type TxPhase = "idle" | "signing" | "pending" | "success" | "error";

export type TxState = {
  phase: TxPhase;
  hash: string | null;
  message: string;
  error: string | null;
};

const initial: TxState = { phase: "idle", hash: null, message: "", error: null };

export function useTx() {
  const [state, setState] = useState<TxState>(initial);

  const reset = useCallback(() => setState(initial), []);

  const run = useCallback(
    async (action: () => Promise<string>, onDone?: () => void) => {
      setState({ phase: "signing", hash: null, message: "Awaiting wallet signature…", error: null });
      try {
        const hash = await action();
        setState({ phase: "pending", hash, message: "Submitted. Waiting for validator consensus…", error: null });

        const { createClient } = await import("genlayer-js");
        const { studionet } = await import("genlayer-js/chains");
        const client = createClient({ chain: studionet });

        await client.waitForTransactionReceipt({
          hash: hash as any,
          status: "ACCEPTED" as any,
          interval: 5000,
          retries: 80,
        });
        setState({ phase: "success", hash, message: "Accepted on GenLayer Studio.", error: null });
        onDone?.();
      } catch (err: any) {
        const msg = err?.shortMessage || err?.message || "Transaction failed.";
        setState((s) => ({ phase: "error", hash: s.hash, message: "", error: msg }));
      }
    },
    []
  );

  return { state, run, reset };
}
