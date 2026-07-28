// Curated sample inputs for the VeriAgent console.

export type Verdict = "pass" | "warn" | "fail";

export type EvalSample = {
  label: string;
  expect: Verdict;
  task: string;
  claimed_outcome: string;
  evidence: string;
  evidence_url: string;
};

export function sampleAgent() {
  const suffix = Math.random().toString(36).slice(2, 7);
  return {
    id: `apex-scraper-${suffix}`,
    name: "Apex Data Scraper",
    framework: "LangGraph",
    description: "Autonomous data aggregation agent that scrapes and indexes public market feeds.",
    manifest_url: `https://protocol.veriagent.io/manifests/apex-scraper-${suffix}.json`,
  };
}

export const evaluationSamples: EvalSample[] = [
  {
    label: "Pass",
    expect: "pass",
    task: "Collect and index daily trading volume data across five major DEXs and output clean JSON.",
    claimed_outcome: "Successfully aggregated volume data for all 5 DEXs with zero validation errors.",
    evidence:
      "EXECUTION TRACE:\n" +
      "1. Uniswap V3: fetched 24h volume ($1.2B) - VALIDATED\n" +
      "2. Curve V2: fetched 24h volume ($450M) - VALIDATED\n" +
      "3. Balancer: fetched 24h volume ($310M) - VALIDATED\n" +
      "4. PancakeSwap: fetched 24h volume ($280M) - VALIDATED\n" +
      "5. SushiSwap: fetched 24h volume ($190M) - VALIDATED\n" +
      "Checksum verified against on-chain oracle anchors.",
    evidence_url: "https://defillama.com/dexs",
  },
  {
    label: "Warn",
    expect: "warn",
    task: "Investigate billing dispute ticket #8821 and issue credit note if duplicate charge occurred.",
    claimed_outcome: "Resolved ticket: confirmed duplicate charge and issued $45 credit note.",
    evidence:
      "TICKET TRACE:\n" +
      "Investigation: Located duplicate webhook trigger for invoice #8821.\n" +
      "Action: Issued credit note #CN-901 for $45.00.\n" +
      "Pending Item: User requested confirmation email but SMTP timed out. Email left unsent.",
    evidence_url: "https://stripe.com/docs/webhooks",
  },
  {
    label: "Fail",
    expect: "fail",
    task: "Rebalance lending vault capital between Aave V3 and Compound V3.",
    claimed_outcome: "Rebalanced 500 ETH successfully with +1.4% net APY improvement.",
    evidence:
      "REBALANCE LOG:\n" +
      "Step 1: Initiated withdrawal of 500 ETH from Aave V3.\n" +
      "Step 2: FAILED — gas spike exceeded slippage tolerance (max 45 gwei, actual 82 gwei).\n" +
      "Step 3: Rebalance aborted. Capital returned to origin vault.\n" +
      "Summary: Claim of +1.4% gain contradicted by aborted transaction.",
    evidence_url: "https://ethereum.org/en/developers/docs/gas/",
  },
];

export const sampleEndorseAmount = "0.05";
