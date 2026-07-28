// VeriAgent configuration — deployed on GenLayer Studio network.

export const CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_VERIAGENT_CONTRACT_ADDRESS ||
  "0xb91f66881b27EA184c92468579dCFcB0F39bDFE4"
) as `0x${string}`;

export const DEPLOY_TX =
  "0x6c34a8759b8bb34650eac1e42a714f32c0bbce41e0c7fadc904fcdc3db54fb4a";

export const REPO_URL = "https://github.com/gihakman/VeriAgent";
export const LIVE_APP_URL = "https://veri-agent.vercel.app";

export const CHAIN = {
  id: 61999,
  name: "GenLayer Studio",
  slug: "studionet" as const,
  currency: "GEN",
  rpc: "https://studio.genlayer.com/api",
  explorer: "https://explorer-studio.genlayer.com",
};

export const explorerTx = (hash: string) => `${CHAIN.explorer}/tx/${hash}`;
export const explorerContract = (addr: string) => `${CHAIN.explorer}/contracts/${addr}`;
export const explorerAddress = (addr: string) => `${CHAIN.explorer}/address/${addr}`;

export const PASS_THRESHOLD = 75;
export const WARN_THRESHOLD = 45;
