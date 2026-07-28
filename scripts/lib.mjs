// Shared helpers for VeriAgent deploy / verify / seed scripts.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROOT = resolve(__dirname, "..");
export const CONTRACT_PATH = resolve(ROOT, "contracts/veriagent.py");
export const DEPLOYMENT_PATH = resolve(__dirname, "deployment.json");
export const EXPLORER = "https://explorer-studio.genlayer.com";

export function requirePrivateKey() {
  const pk = process.env.ACCOUNT_PRIVATE_KEY;
  if (!pk || !pk.startsWith("0x") || pk.length < 40) {
    throw new Error(
      "ACCOUNT_PRIVATE_KEY missing or malformed. Set it in .env and run with node --env-file=.env."
    );
  }
  return pk;
}

export function getClient() {
  const account = createAccount(requirePrivateKey());
  const client = createClient({ chain: studionet, account });
  return { client, account };
}

export function readContractCode() {
  return readFileSync(CONTRACT_PATH, "utf-8");
}

export function saveDeployment(record) {
  writeFileSync(DEPLOYMENT_PATH, JSON.stringify(record, null, 2) + "\n");
}

export function loadDeployment() {
  if (process.env.VERIAGENT_CONTRACT_ADDRESS) {
    return { address: process.env.VERIAGENT_CONTRACT_ADDRESS };
  }
  if (existsSync(DEPLOYMENT_PATH)) {
    return JSON.parse(readFileSync(DEPLOYMENT_PATH, "utf-8"));
  }
  throw new Error(
    "No deployment found. Run deploy first or set VERIAGENT_CONTRACT_ADDRESS."
  );
}

export function txUrl(hash) {
  return `${EXPLORER}/tx/${hash}`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
