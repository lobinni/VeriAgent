"use client";

import { useCallback, useEffect, useState } from "react";
import { CHAIN } from "@/lib/config";

export type WalletStatus = "disconnected" | "connecting" | "connected";

export type Wallet = {
  address: `0x${string}` | null;
  chainId: number | null;
  status: WalletStatus;
  error: string | null;
  hasProvider: boolean;
  onCorrectChain: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  ensureChain: () => Promise<void>;
  getWriteClient: () => Promise<any>;
};

function getProvider(): any | null {
  if (typeof window === "undefined") return null;
  return (window as any).ethereum ?? null;
}

const hexToNum = (v: unknown): number | null => {
  if (typeof v === "string") return parseInt(v, 16);
  if (typeof v === "number") return v;
  return null;
};

// Add GenLayer Studio network to MetaMask
async function addNetwork(provider: any) {
  await provider.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: "0x" + CHAIN.id.toString(16),
        chainName: CHAIN.name,
        nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
        rpcUrls: [CHAIN.rpc],
        blockExplorerUrls: [CHAIN.explorer],
      },
    ],
  });
}

// Switch MetaMask to the correct chain
async function switchChain(provider: any) {
  const chainHex = "0x" + CHAIN.id.toString(16);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainHex }],
    });
  } catch (err: any) {
    // 4902 = chain not added yet
    if (err?.code === 4902 || err?.message?.includes("Unrecognized chain")) {
      await addNetwork(provider);
    } else {
      throw err;
    }
  }
}

export function useWallet(): Wallet {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);

  const provider = getProvider();
  const hasProvider = !!provider;

  const refreshChain = useCallback(async () => {
    if (!provider) return;
    try {
      const id = await provider.request({ method: "eth_chainId" });
      setChainId(hexToNum(id));
    } catch { /* ignore */ }
  }, [provider]);

  const ensureChain = useCallback(async () => {
    if (!provider) throw new Error("No wallet found.");
    await switchChain(provider);
    await refreshChain();
  }, [provider, refreshChain]);

  const connect = useCallback(async () => {
    setError(null);
    if (!provider) {
      setError("No browser wallet found. Install MetaMask or a compatible wallet.");
      return;
    }
    setStatus("connecting");
    try {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      const acct = accounts?.[0] as `0x${string}` | undefined;
      if (!acct) throw new Error("No account authorized.");
      setAddress(acct);

      // Auto switch/add GenLayer Studio network
      await switchChain(provider);
      await refreshChain();

      setStatus("connected");
    } catch (err: any) {
      setStatus("disconnected");
      setError(err?.shortMessage || err?.message || "Failed to connect wallet.");
    }
  }, [provider, refreshChain]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setStatus("disconnected");
    setError(null);
  }, []);

  const getWriteClient = useCallback(async () => {
    if (!address) throw new Error("Connect a wallet first.");
    if (!provider) throw new Error("No wallet found.");

    await switchChain(provider);
    await refreshChain();

    const { createClient } = await import("genlayer-js");
    const { studionet } = await import("genlayer-js/chains");

    return createClient({
      chain: studionet,
      account: address,
      provider: provider,
    });
  }, [address, provider, refreshChain]);

  // Listen for wallet events
  useEffect(() => {
    if (!provider?.on) return;
    const onAccounts = (accts: string[]) => {
      if (!accts || accts.length === 0) {
        setAddress(null);
        setStatus("disconnected");
      } else {
        setAddress(accts[0] as `0x${string}`);
        setStatus("connected");
      }
    };
    const onChain = (id: string) => setChainId(hexToNum(id));
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider]);

  return {
    address,
    chainId,
    status,
    error,
    hasProvider,
    onCorrectChain: chainId === CHAIN.id,
    connect,
    disconnect,
    ensureChain,
    getWriteClient,
  };
}
