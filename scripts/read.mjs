// Read live VeriAgent state from GenLayer Studio (view methods only, no writes).
// Usage: node --env-file=.env scripts/read.mjs
import { getClient, loadDeployment, EXPLORER } from "./lib.mjs";

async function main() {
  const { client } = getClient();
  const { address } = loadDeployment();
  console.log("Contract:", address);
  console.log("Explorer:", `${EXPLORER}/contracts/${address}`);

  const config = await client.readContract({ address, functionName: "get_config", args: [] });
  const stats = await client.readContract({ address, functionName: "get_stats", args: [] });
  const agents = await client.readContract({ address, functionName: "list_agents", args: [] });

  console.log("\nconfig:", config);
  console.log("stats:", stats);
  console.log(`\nagents (${agents.length}):`);
  for (const a of agents) {
    console.log(
      `  - ${a.agent_id} "${a.name}" [${a.framework}]  verity=${a.verity_score}  ` +
        `evals=${a.total_evaluations} (pass ${a.pass} / warn ${a.warn} / fail ${a.fail})  ` +
        `endorsements=${a.endorsements}`
    );
  }

  const recent = await client.readContract({
    address,
    functionName: "get_recent_evaluations",
    args: [10],
  });
  console.log(`\nrecent evaluations (${recent.length}):`);
  for (const e of recent) {
    console.log(`  - ${e.eval_id}: ${e.verdict} (score ${e.score}) :: ${e.reasoning.slice(0, 90)}`);
  }
}

main().catch((err) => {
  console.error("Read failed:", err?.message || err);
  process.exit(1);
});
