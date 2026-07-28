// Deploy VeriAgent to GenLayer Studio and verify it is live by reading a view method.
// Usage: node --env-file=.env scripts/deploy.mjs
import {
  getClient,
  readContractCode,
  saveDeployment,
  txUrl,
  EXPLORER,
} from "./lib.mjs";

async function main() {
  const { client, account } = getClient();
  const code = readContractCode();

  const feeRecipient = process.env.FEE_RECIPIENT?.trim() || "";
  const feeBps = Number.parseInt(process.env.FEE_BPS ?? "100", 10) || 0;

  console.log("Deployer:", account.address);
  console.log("Chain:    GenLayer Studio (61999)");
  console.log("fee_recipient:", feeRecipient || "(deployer)");
  console.log("fee_bps:", feeBps);
  console.log("Deploying VeriAgent ...");

  const deployHash = await client.deployContract({
    code,
    args: [feeRecipient, feeBps],
    consensusMaxRotations: 3,
  });
  console.log("Deploy tx:", deployHash);
  console.log("Deploy tx URL:", txUrl(deployHash));

  console.log("Waiting for the deploy transaction to be ACCEPTED ...");
  const receipt = await client.waitForTransactionReceipt({
    hash: deployHash,
    status: "ACCEPTED",
    interval: 5000,
    retries: 60,
  });

  const address =
    receipt?.data?.contract_address ||
    receipt?.txDataDecoded?.contractAddress ||
    receipt?.data?.contractAddress ||
    receipt?.contractAddress;

  const execName = receipt?.txExecutionResultName || receipt?.statusName;
  console.log("Execution result:", execName, "| status:", receipt?.status_name || receipt?.statusName);

  if (!address) {
    console.error("No contract address in receipt. Summary:");
    console.error({
      status: receipt?.status_name || receipt?.statusName,
      exec: receipt?.txExecutionResultName,
      result: receipt?.resultName,
    });
    throw new Error("Deploy did not yield a contract address (execution may have failed).");
  }
  console.log("Contract address:", address);

  // Verify the contract is actually live by reading a view method.
  console.log("Verifying by reading get_config() ...");
  const config = await client.readContract({
    address,
    functionName: "get_config",
    args: [],
  });
  const stats = await client.readContract({
    address,
    functionName: "get_stats",
    args: [],
  });

  console.log("get_config ->", config);
  console.log("get_stats  ->", stats);

  saveDeployment({
    network: "genlayer-studio",
    chainId: 61999,
    address,
    deployTx: deployHash,
    deployTxUrl: txUrl(deployHash),
    explorer: EXPLORER,
    feeRecipient: config.fee_recipient,
    feeBps: config.fee_bps,
    deployedAt: new Date().toISOString(),
  });
  console.log("\nSaved scripts/deployment.json");
  console.log("VERIFIED LIVE. Contract:", `${EXPLORER}/contracts/${address}`);
}

main().catch((err) => {
  console.error("Deploy failed:", err?.message || err);
  process.exit(1);
});
