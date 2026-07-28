"use client";

import { TxState } from "@/hooks/useTx";
import { explorerTx } from "@/lib/config";
import { short } from "@/lib/format";

export function TxStatus({ state }: { state: TxState }) {
  if (state.phase === "idle") return null;

  const cls =
    state.phase === "success" ? "tx ok" : state.phase === "error" ? "tx err" : "tx pending";
  const busy = state.phase === "signing" || state.phase === "pending";

  const head =
    state.phase === "signing"
      ? "Signing"
      : state.phase === "pending"
      ? "Pending"
      : state.phase === "success"
      ? "Confirmed"
      : "Failed";

  return (
    <div className={cls} role="status" aria-live="polite">
      <div className="tx-head">
        {busy ? <span className="spinner" /> : null}
        <span>{head}</span>
      </div>
      {state.error ? (
        <div className="tx-phase" style={{ color: "var(--fail)" }}>
          {state.error}
        </div>
      ) : (
        <div className="tx-phase">{state.message}</div>
      )}
      {state.hash ? (
        <div style={{ marginTop: 8 }}>
          <a href={explorerTx(state.hash)} target="_blank" rel="noreferrer">
            View tx {short(state.hash, 10, 8)} ↗
          </a>
        </div>
      ) : null}
    </div>
  );
}
