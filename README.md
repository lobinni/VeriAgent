# VeriAgent

> On-chain verification protocol for autonomous AI agents, built as a GenLayer Intelligent Contract.
>
> 🌐 **Live Application:** [https://veri-agent-three.vercel.app](https://veri-agent-three.vercel.app)

Before you let an unfamiliar AI agent transact on your behalf, you need to know whether it delivers what it claims. VeriAgent records each agent's work, has GenLayer validators independently verify the evidence behind a claim, and keeps the verdicts on-chain where anyone can read them.

- **Live Web App:** [https://veri-agent-three.vercel.app](https://veri-agent-three.vercel.app)
- **Contract (GenLayer Studio):** [`0xb91f66881b27EA184c92468579dCFcB0F39bDFE4`](https://explorer-studio.genlayer.com/address/0xb91f66881b27EA184c92468579dCFcB0F39bDFE4)
- **Deploy Transaction:** [`0x6c34a875...54fb4a`](https://explorer-studio.genlayer.com/tx/0x6c34a8759b8bb34650eac1e42a714f32c0bbce41e0c7fadc904fcdc3db54fb4a)
- **Network:** GenLayer Studio Network (chain id 61999)

---

## Security Model

### 1. Authorized Evaluators — No Anonymous Reputation Manipulation

Only the **agent owner** or addresses the owner has explicitly **authorized as counterparties** may submit evaluations. Random callers cannot spam evaluations to manipulate an agent's verity score.

```
register_agent(...)          → owner is msg.sender
authorize_evaluator(aid, addr) → only owner can call
revoke_evaluator(aid, addr)    → only owner can call
commit_task(aid, task)         → only authorized callers
request_evaluation(task_id, ...) → only the task committer
```

### 2. Task Commitment — Evaluations Bound to On-Chain Records

Before requesting an evaluation, the counterparty **commits the task on-chain** via `commit_task()`. The evaluation references the committed `task_id`, binding the verdict to a prior on-chain record rather than accepting arbitrary free-text. Each committed task can only be evaluated once.

### 3. Bounded Evidence — Validators Fetch and Cross-Reference URLs

When an `evidence_url` is provided, validators **fetch the URL content** inside the non-deterministic block using `gl.nondet.get_webpage()` and cross-reference it against the inline evidence in the LLM prompt. If the URL is unreachable or its content contradicts the inline text, the score is penalized. The `evidence_fetched` flag is recorded on-chain.

### 4. Endorsement Lifecycle — Stake, Withdraw, Slash, Refund

Endorsed GEN has a complete lifecycle:

| Action | Who | Condition |
|--------|-----|-----------|
| `endorse_agent` | Anyone | Stakes GEN behind an agent |
| `withdraw_endorsement` | Endorser | After 24h cooldown period |
| `slash_endorsement` | Agent owner | Only if agent has ≥1 `fail` verdict |
| `refund_endorsement` | Contract owner | Dispute resolution |

---

## How It Works

1. **Register.** An agent is added to the protocol. Its owner is the wallet that registers it.
2. **Authorize.** The owner calls `authorize_evaluator` to grant counterparties the right to evaluate.
3. **Commit task.** An authorized counterparty commits a task on-chain via `commit_task`, receiving a `task_id`.
4. **Submit evaluation.** The committer calls `request_evaluation` with the `task_id`, claimed outcome, evidence, and an optional evidence URL. Validators fetch the URL, cross-reference, and score 0–100.
5. **Verity score updates.** The verdict (`pass` ≥75, `warn` 45–74, `fail` <45) is written on-chain.
6. **Endorse / withdraw / slash.** Stakeholders manage bond through the full endorsement lifecycle.

---

## Contract Methods

| Method | Kind | Purpose |
|--------|------|---------|
| `register_agent(...)` | write | Add an agent |
| `authorize_evaluator(agent_id, addr)` | write | Grant evaluation rights |
| `revoke_evaluator(agent_id, addr)` | write | Revoke evaluation rights |
| `commit_task(agent_id, task) → task_id` | write | Commit task on-chain |
| `request_evaluation(task_id, outcome, evidence, url) → eval_id` | write | Run validator verification |
| `endorse_agent(agent_id) → endorsement_id` | payable | Stake GEN |
| `withdraw_endorsement(endorsement_id)` | write | Withdraw after cooldown |
| `slash_endorsement(endorsement_id)` | write | Slash on fail verdict |
| `refund_endorsement(endorsement_id)` | write | Owner refunds disputes |
| `get_agent / list_agents / get_stats / get_config` | view | Read state |
| `get_task / list_tasks_for_agent` | view | Read committed tasks |
| `get_endorsement / list_endorsements_for_agent` | view | Read endorsements |
| `get_authorized_evaluators(agent_id)` | view | List authorized callers |

---

## Tech Stack

- **Contract:** Python 3.12 on GenVM SDK, `gl.nondet.get_webpage()` for evidence fetching, `gl.nondet.exec_prompt()` for LLM scoring.
- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind CSS, `genlayer-js` for reads and wallet-signed writes.

## Development

```bash
npm install && npm run build
```

## Deploying

Push to GitHub, import in [Vercel](https://vercel.com/new). Vercel detects Next.js automatically.

## License

MIT
