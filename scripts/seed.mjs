// Seed VeriAgent with real end-to-end verification examples on GenLayer Studio.
// Registers agents, runs REAL validator LLM verifications (request_evaluation),
// and records one payable endorsement. Idempotent: skips work already on-chain.
//
// Usage: node --env-file=.env scripts/seed.mjs
import { getClient, loadDeployment, txUrl, sleep } from "./lib.mjs";

const GEN = 10n ** 18n;

// Four agents with clear-cut evidence so validator consensus is stable.
const AGENTS = [
  {
    id: "apex-scraper",
    name: "Apex Data Scraper",
    framework: "LangGraph",
    description: "Autonomous data aggregation agent that scrapes and indexes public market feeds.",
    manifest_url: "https://protocol.veriagent.io/manifests/apex-scraper.json",
    evaluation: {
      task: "Collect and index daily trading volume data across five major decentralized exchanges and output clean JSON.",
      claimed_outcome: "Successfully aggregated volume data for all 5 DEXs with zero validation errors.",
      evidence:
        "EXECUTION TRACE:\n" +
        "1. Uniswap V3: fetched 24h volume ($1.2B) - status: VALIDATED\n" +
        "2. Curve V2: fetched 24h volume ($450M) - status: VALIDATED\n" +
        "3. Balancer: fetched 24h volume ($310M) - status: VALIDATED\n" +
        "4. PancakeSwap: fetched 24h volume ($280M) - status: VALIDATED\n" +
        "5. SushiSwap: fetched 24h volume ($190M) - status: VALIDATED\n" +
        "All feeds parsed cleanly into standard schema. Checksum verified against on-chain oracle anchors.",
      evidence_url: "https://defillama.com/dexs",
    },
  },
  {
    id: "cyberguard-analyst",
    name: "CyberGuard Analyzer",
    framework: "CrewAI",
    description: "Security monitoring agent that audits smart contracts for reentrancy and access control flaws.",
    manifest_url: "https://protocol.veriagent.io/manifests/cyberguard-analyst.json",
    evaluation: {
      task: "Perform automated static analysis and symbolic execution on target vault contract 0x7a...8b.",
      claimed_outcome: "Identified 2 critical reentrancy vectors and 1 uninitialized owner check, providing automated remediation patches.",
      evidence:
        "AUDIT REPORT:\n" +
        "Vulnerability 1 (Critical): Vault.withdraw() updates user balance after external call to msg.sender. Fix applied: added ReentrancyGuard nonReentrant modifier and moved state update before call.\n" +
        "Vulnerability 2 (High): Vault.init() lacks initializer modifier, allowing takeover. Fix applied: added initializer guard.\n" +
        "Vulnerability 3 (Medium): Unbounded loop in calculateRewards(). Fix applied: pagination added.\n" +
        "All three remediations verified by automated regression test suite.",
      evidence_url: "https://cwe.mitre.org/data/definitions/841.html",
    },
  },
  {
    id: "defi-yield-opt",
    name: "DeFi Yield Optimizer",
    framework: "AutoGen",
    description: "Algorithmic asset manager that rebalances liquidity pool positions to maximize APY.",
    manifest_url: "https://protocol.veriagent.io/manifests/defi-yield-opt.json",
    evaluation: {
      task: "Rebalance lending vault capital between Aave V3 and Compound V3 to capture net interest spread.",
      claimed_outcome: "Rebalanced 500 ETH successfully, generating an estimated +1.4% net APY improvement.",
      evidence:
        "REBALANCE LOG:\n" +
        "Step 1: Initiated withdrawal of 500 ETH from Aave V3 pool.\n" +
        "Step 2: TRANSACTION FAILED — gas spike exceeded slippage tolerance cap (max 45 gwei, actual 82 gwei).\n" +
        "Step 3: Asset rebalance aborted. Capital returned to origin vault.\n" +
        "Summary: Rebalance failed to execute due to gas volatility. The claim of successful rebalancing and +1.4% APY gain is contradicted by the aborted transaction log.",
      evidence_url: "https://ethereum.org/en/developers/docs/gas/",
    },
  },
  {
    id: "nexus-support",
    name: "Nexus Customer Agent",
    framework: "Semantic Kernel",
    description: "Autonomous tier-1 support agent that resolves technical tickets and issues refund credits.",
    manifest_url: "https://protocol.veriagent.io/manifests/nexus-support.json",
    evaluation: {
      task: "Investigate billing dispute ticket #8821, verify payment gateway logs, and issue credit note if duplicate charge occurred.",
      claimed_outcome: "Resolved ticket #8821: confirmed duplicate charge and issued $45.00 account credit note.",
      evidence:
        "TICKET TRACE:\n" +
        "Investigation: Located duplicate webhook trigger for invoice #8821 resulting in two $45.00 charges at 14:02 UTC and 14:03 UTC.\n" +
        "Action: Issued credit note #CN-901 for $45.00 to user account.\n" +
        "Pending Item: User requested confirmation email to accounting@corp.com, but SMTP service timed out. Email notification left unsent.\n" +
        "Conclusion: Duplicate charge verified and credit applied, but customer notification failed to deliver.",
      evidence_url: "https://stripe.com/docs/webhooks",
    },
  },
];

async function submitWrite(client, params, label, { retries = 8 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      const hash = await client.writeContract(params);
      console.log(`  ${label} submitted: ${hash}`);
      console.log(`    ${txUrl(hash)}`);
      const receipt = await client.waitForTransactionReceipt({
        hash,
        status: "ACCEPTED",
        interval: 5000,
        retries: 80,
      });
      const exec = receipt?.txExecutionResultName;
      const consensus = receipt?.resultName;
      console.log(`  ${label} accepted (exec=${exec}, consensus=${consensus})`);
      return { hash, receipt };
    } catch (err) {
      attempt += 1;
      const msg = err?.message || String(err);
      const rateLimited = /(-32429|429|rate)/i.test(msg);
      if (attempt > retries) throw err;
      const backoff = rateLimited ? 20000 * attempt : 8000 * attempt;
      console.warn(`  ${label} attempt ${attempt} failed (${msg.slice(0, 120)}). Backing off ${backoff}ms.`);
      await sleep(backoff);
    }
  }
}

async function main() {
  const { client } = getClient();
  const { address } = loadDeployment();
  console.log("Seeding VeriAgent contract:", address, "\n");

  const existing = await client.readContract({ address, functionName: "list_agents", args: [] });
  const existingIds = new Set(existing.map((a) => a.agent_id));

  // 1) Register agents (skip any already registered).
  for (const a of AGENTS) {
    if (existingIds.has(a.id)) {
      console.log(`Agent ${a.id} already registered, skipping.`);
      continue;
    }
    console.log(`Registering ${a.id} ...`);
    await submitWrite(
      client,
      {
        address,
        functionName: "register_agent",
        args: [a.id, a.name, a.framework, a.description, a.manifest_url],
        value: 0n,
        consensusMaxRotations: 3,
      },
      `register ${a.id}`
    );
    await sleep(3000);
  }

  // 2) Request one evaluation per agent (real validator LLM verification).
  for (const a of AGENTS) {
    const evals = await client.readContract({
      address,
      functionName: "list_evaluations_for_agent",
      args: [a.id],
    });
    if (evals.length > 0) {
      console.log(`Agent ${a.id} already has ${evals.length} evaluation(s), skipping.`);
      continue;
    }
    console.log(`\nVerifying ${a.id} (real LLM consensus, may take a while) ...`);
    const e = a.evaluation;
    await submitWrite(
      client,
      {
        address,
        functionName: "request_evaluation",
        args: [a.id, e.task, e.claimed_outcome, e.evidence, e.evidence_url],
        value: 0n,
        consensusMaxRotations: 5,
      },
      `evaluate ${a.id}`
    );
    const list = await client.readContract({
      address,
      functionName: "list_evaluations_for_agent",
      args: [a.id],
    });
    const last = list[list.length - 1];
    if (last) console.log(`  -> verdict=${last.verdict} score=${last.score}`);
    await sleep(6000);
  }

  // 3) One payable endorsement to exercise value handling end-to-end.
  const endorseTarget = AGENTS[1].id; // cyberguard-analyst
  const already = await client.readContract({ address, functionName: "get_agent", args: [endorseTarget] });
  if (Number(already.endorsements) === 0) {
    console.log(`\nEndorsing ${endorseTarget} with 0.05 GEN (payable) ...`);
    await submitWrite(
      client,
      {
        address,
        functionName: "endorse_agent",
        args: [endorseTarget],
        value: GEN / 20n, // 0.05 GEN
        consensusMaxRotations: 3,
      },
      `endorse ${endorseTarget}`
    );
  } else {
    console.log(`Agent ${endorseTarget} already has endorsements, skipping.`);
  }

  console.log("\nSEED COMPLETE.");
}

main().catch((err) => {
  console.error("Seed failed:", err?.message || err);
  process.exit(1);
});
