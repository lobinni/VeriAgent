# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# VeriAgent: an on-chain verification protocol for autonomous AI agents.
#
# SECURITY MODEL
# ──────────────
# 1. AUTHORIZED EVALUATORS: Only the agent owner or addresses the owner has
#    explicitly authorized as counterparties may submit evaluations. Random
#    callers cannot spam evaluations to manipulate an agent's score.
#
# 2. BOUNDED EVIDENCE: When an evidence_url is provided, validators MUST fetch
#    it inside the non-deterministic block and cross-reference the fetched
#    content against the inline evidence. If the URL is unreachable or its
#    content contradicts the inline text, the score is penalized.
#
# 3. TASK COMMITMENT: Before requesting evaluation the counterparty commits a
#    task on-chain (commit_task). The evaluation references that committed
#    task_id, binding the verdict to a prior on-chain record rather than
#    accepting arbitrary free-text.
#
# 4. ENDORSEMENT LIFECYCLE: Endorsed GEN has a complete lifecycle: stake,
#    withdraw (by endorser after cooldown), slash (by owner on "fail" verdict),
#    and refund (by contract owner in disputes). Bond is not locked forever.

from genlayer import *

import json
from dataclasses import dataclass
from datetime import datetime, timezone

PASS_THRESHOLD = 75
WARN_THRESHOLD = 45
SCORE_TOLERANCE = 12

ERROR_EXPECTED = "[EXPECTED]"
ERROR_EXTERNAL = "[EXTERNAL]"
ERROR_TRANSIENT = "[TRANSIENT]"
ERROR_LLM = "[LLM_ERROR]"

BPS_DENOMINATOR = 10000

# Cooldown before an endorser can withdraw (seconds). Prevents stake-and-run.
ENDORSEMENT_COOLDOWN = 86400  # 24 hours


def _verdict_from_score(score: int) -> str:
    if score >= PASS_THRESHOLD:
        return "pass"
    if score >= WARN_THRESHOLD:
        return "warn"
    return "fail"


def _clamp_score(value: int) -> int:
    if value < 0:
        return 0
    if value > 100:
        return 100
    return value


def _parse_json(text: str) -> dict:
    import re
    first = text.find("{")
    last = text.rfind("}")
    if first == -1 or last == -1 or last < first:
        raise gl.vm.UserError(f"{ERROR_LLM} no JSON object in LLM response")
    snippet = text[first:last + 1]
    snippet = re.sub(r",(?!\s*[\{\[\"\w])", "", snippet)
    try:
        parsed = json.loads(snippet)
    except Exception:
        raise gl.vm.UserError(f"{ERROR_LLM} invalid JSON in LLM response")
    if not isinstance(parsed, dict):
        raise gl.vm.UserError(f"{ERROR_LLM} LLM response is not a JSON object")
    return parsed


def _parse_score(analysis: dict) -> int:
    if not isinstance(analysis, dict):
        raise gl.vm.UserError(f"{ERROR_LLM} non-dict LLM response: {type(analysis)}")
    raw = analysis.get("score")
    if raw is None:
        for alt in ("rating", "points", "value", "match_score"):
            if alt in analysis:
                raw = analysis[alt]
                break
    if raw is None:
        raise gl.vm.UserError(
            f"{ERROR_LLM} missing 'score'; keys: {list(analysis.keys())}"
        )
    s = str(raw).strip()
    if s.endswith("%"):
        s = s[:-1].strip()
    if "." in s:
        s = s.split(".")[0]
    digits = "".join(ch for ch in s if ch.isdigit())
    if not digits:
        raise gl.vm.UserError(f"{ERROR_LLM} non-numeric score: {raw}")
    return _clamp_score(int(digits))


def _build_prompt(task: str, claimed_outcome: str, evidence: str,
                  fetched_content: str, evidence_url: str) -> str:
    url_section = ""
    if evidence_url:
        if fetched_content:
            url_section = (
                f"\nFETCHED EVIDENCE FROM URL ({evidence_url}):\n"
                f"{fetched_content[:3000]}\n\n"
                "IMPORTANT: Cross-reference the inline evidence against the "
                "fetched content. If the fetched content contradicts or does not "
                "support the inline evidence, lower the score significantly.\n"
            )
        else:
            url_section = (
                f"\nEVIDENCE URL ({evidence_url}) COULD NOT BE FETCHED.\n"
                "The evaluator was unable to retrieve the referenced evidence. "
                "This is a negative signal — treat unverifiable references as "
                "unsupported claims and penalize the score accordingly.\n"
            )

    return (
        "You are a verification auditor evaluating whether an autonomous AI "
        "agent substantiated its claimed outcome. Assess only the evidence "
        "provided; do not infer facts not present.\n\n"
        f"TASK THE AGENT COMMITTED TO:\n{task}\n\n"
        f"OUTCOME THE AGENT DECLARES:\n{claimed_outcome}\n\n"
        f"INLINE EVIDENCE (work log, artifacts, and trace):\n{evidence}\n"
        f"{url_section}\n"
        "Rate from 0 to 100 how convincingly the evidence substantiates the "
        "declared outcome and fulfills the committed task:\n"
        "- 75-100: outcome substantiated with strong, consistent evidence.\n"
        "- 45-74: partially substantiated; gaps, inconsistencies, or weak support.\n"
        "- 0-44: not substantiated, contradicted, or misrepresented.\n\n"
        "Respond ONLY with strict JSON of the form "
        '{"score": <integer 0-100>, "reasoning": "<one or two sentences>"}'
    )


def _handle_leader_error(leaders_res: gl.vm.Result, leader_fn) -> bool:
    leader_msg = getattr(leaders_res, "message", "") or ""
    try:
        leader_fn()
        return False
    except gl.vm.UserError as e:
        validator_msg = getattr(e, "message", "") or str(e)
        if validator_msg.startswith(ERROR_EXPECTED) or validator_msg.startswith(ERROR_EXTERNAL):
            return validator_msg == leader_msg
        if validator_msg.startswith(ERROR_TRANSIENT) and leader_msg.startswith(ERROR_TRANSIENT):
            return True
        return False
    except Exception:
        return False


# ─── Data structures ────────────────────────────────────────────────────────

@allow_storage
@dataclass
class Agent:
    agent_id: str
    owner: Address
    name: str
    framework: str
    description: str
    manifest_url: str
    registered_at: str
    total_evaluations: u256
    pass_count: u256
    warn_count: u256
    fail_count: u256
    score_sum: u256
    endorsements: u256
    bond: u256
    slashed: u256


@allow_storage
@dataclass
class CommittedTask:
    task_id: str
    agent_id: str
    committer: Address
    task: str
    committed_at: str
    evaluated: u256          # 0 = pending, 1 = evaluated


@allow_storage
@dataclass
class Endorsement:
    endorsement_id: str
    agent_id: str
    endorser: Address
    amount: u256
    created_at: str
    withdrawn: u256          # 0 = active, 1 = withdrawn/slashed/refunded
    status: str              # "active", "withdrawn", "slashed", "refunded"


@allow_storage
@dataclass
class Evaluation:
    eval_id: str
    agent_id: str
    task_id: str
    requester: Address
    task: str
    claimed_outcome: str
    evidence: str
    evidence_url: str
    evidence_fetched: u256   # 1 = url was fetched by validators, 0 = not
    score: u256
    verdict: str
    reasoning: str
    created_at: str


class VeriAgent(gl.Contract):
    owner: Address
    fee_recipient: Address
    fee_bps: u256
    fees_accrued: u256
    total_evaluations: u256
    total_tasks: u256

    agents: TreeMap[str, Agent]
    agent_ids: DynArray[str]
    # Flat map: key = "agent_id|evaluator_address", value = "1"
    # Avoids TreeMap[str, DynArray] KeyError on first access.
    auth_map: TreeMap[str, str]
    auth_keys: DynArray[str]

    tasks: TreeMap[str, CommittedTask]
    task_ids: DynArray[str]

    endorsement_records: TreeMap[str, Endorsement]
    endorsement_ids: DynArray[str]

    evaluations: TreeMap[str, Evaluation]
    eval_ids: DynArray[str]

    def __init__(self, fee_recipient: str, fee_bps: int):
        self.owner = gl.message.sender_address
        if fee_recipient:
            self.fee_recipient = Address(fee_recipient)
        else:
            self.fee_recipient = gl.message.sender_address
        bps = fee_bps
        if bps < 0:
            bps = 0
        if bps > BPS_DENOMINATOR:
            bps = BPS_DENOMINATOR
        self.fee_bps = u256(bps)
        self.fees_accrued = u256(0)
        self.total_evaluations = u256(0)
        self.total_tasks = u256(0)

    # ─── Helpers ────────────────────────────────────────────────────────────

    def _auth_key(self, agent_id: str, addr: str) -> str:
        return agent_id + "|" + addr

    def _is_authorized_evaluator(self, agent_id: str, caller: Address) -> bool:
        """Check if caller is the agent owner or an authorized counterparty."""
        agent = self.agents[agent_id]
        if str(caller) == str(agent.owner):
            return True
        key = self._auth_key(agent_id, str(caller))
        if key in self.auth_map:
            return self.auth_map[key] == "1"
        return False

    # ─── Write methods ──────────────────────────────────────────────────────

    @gl.public.write
    def register_agent(
        self,
        agent_id: str,
        name: str,
        framework: str,
        description: str,
        manifest_url: str,
    ) -> None:
        aid = agent_id.strip()
        if not aid:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} agent_id is required")
        if aid in self.agents:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} agent already registered: {aid}")

        self.agents[aid] = Agent(
            agent_id=aid,
            owner=gl.message.sender_address,
            name=name,
            framework=framework,
            description=description,
            manifest_url=manifest_url,
            registered_at=datetime.now(timezone.utc).isoformat(),
            total_evaluations=u256(0),
            pass_count=u256(0),
            warn_count=u256(0),
            fail_count=u256(0),
            score_sum=u256(0),
            endorsements=u256(0),
            bond=u256(0),
            slashed=u256(0),
        )
        self.agent_ids.append(aid)

    @gl.public.write
    def authorize_evaluator(self, agent_id: str, evaluator: str) -> None:
        """Agent owner grants an address the right to submit evaluations."""
        aid = agent_id.strip()
        if aid not in self.agents:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} agent not registered: {aid}")
        agent = self.agents[aid]
        if str(gl.message.sender_address) != str(agent.owner):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the agent owner can authorize evaluators")
        evaluator_addr = evaluator.strip()
        if not evaluator_addr:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} evaluator address is required")
        key = self._auth_key(aid, evaluator_addr)
        if key in self.auth_map:
            return  # already authorized
        self.auth_map[key] = "1"
        self.auth_keys.append(key)

    @gl.public.write
    def revoke_evaluator(self, agent_id: str, evaluator: str) -> None:
        """Agent owner revokes an evaluator's authorization."""
        aid = agent_id.strip()
        if aid not in self.agents:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} agent not registered: {aid}")
        agent = self.agents[aid]
        if str(gl.message.sender_address) != str(agent.owner):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the agent owner can revoke evaluators")
        evaluator_addr = evaluator.strip()
        key = self._auth_key(aid, evaluator_addr)
        if key in self.auth_map:
            self.auth_map[key] = "0"  # mark revoked

    @gl.public.write
    def commit_task(self, agent_id: str, task: str) -> str:
        """Commit a task on-chain before requesting evaluation. Returns task_id."""
        aid = agent_id.strip()
        if aid not in self.agents:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} agent not registered: {aid}")
        if not task.strip():
            raise gl.vm.UserError(f"{ERROR_EXPECTED} task description is required")

        # Caller must be authorized
        if not self._is_authorized_evaluator(aid, gl.message.sender_address):
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} caller is not authorized to evaluate this agent. "
                "Ask the agent owner to call authorize_evaluator first."
            )

        n = int(self.total_tasks) + 1
        task_id = f"{aid}:task:{n}"

        self.tasks[task_id] = CommittedTask(
            task_id=task_id,
            agent_id=aid,
            committer=gl.message.sender_address,
            task=task,
            committed_at=datetime.now(timezone.utc).isoformat(),
            evaluated=u256(0),
        )
        self.task_ids.append(task_id)
        self.total_tasks = u256(n)
        return task_id

    @gl.public.write
    def request_evaluation(
        self,
        task_id: str,
        claimed_outcome: str,
        evidence: str,
        evidence_url: str,
    ) -> str:
        """Evaluate a previously committed task. Only the task committer may call."""
        tid = task_id.strip()
        if tid not in self.tasks:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} task not found: {tid}")

        committed = self.tasks[tid]
        if int(committed.evaluated) != 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} task already evaluated: {tid}")

        # Only the original task committer can request evaluation
        if str(gl.message.sender_address) != str(committed.committer):
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} only the task committer can request evaluation"
            )

        aid = committed.agent_id
        task_text = committed.task

        if not claimed_outcome.strip() or not evidence.strip():
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} claimed_outcome and evidence are required"
            )

        # Non-deterministic verification with evidence URL fetching
        result = self._verify(task_text, claimed_outcome, evidence, evidence_url)
        score = _clamp_score(int(result["score"]))
        reasoning = str(result.get("reasoning", ""))[:800]
        evidence_was_fetched = 1 if result.get("evidence_fetched", False) else 0
        verdict = _verdict_from_score(score)

        agent = self.agents[aid]
        n = int(agent.total_evaluations) + 1
        eval_id = f"{aid}#{n}"

        self.evaluations[eval_id] = Evaluation(
            eval_id=eval_id,
            agent_id=aid,
            task_id=tid,
            requester=gl.message.sender_address,
            task=task_text,
            claimed_outcome=claimed_outcome,
            evidence=evidence,
            evidence_url=evidence_url,
            evidence_fetched=u256(evidence_was_fetched),
            score=u256(score),
            verdict=verdict,
            reasoning=reasoning,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self.eval_ids.append(eval_id)

        # Mark task as evaluated
        committed.evaluated = u256(1)

        agent.total_evaluations = u256(n)
        agent.score_sum = u256(int(agent.score_sum) + score)
        if verdict == "pass":
            agent.pass_count = u256(int(agent.pass_count) + 1)
        elif verdict == "warn":
            agent.warn_count = u256(int(agent.warn_count) + 1)
        else:
            agent.fail_count = u256(int(agent.fail_count) + 1)

        self.total_evaluations = u256(int(self.total_evaluations) + 1)
        return eval_id

    # ─── Endorsement lifecycle ──────────────────────────────────────────────

    @gl.public.write.payable
    def endorse_agent(self, agent_id: str) -> str:
        """Stake GEN behind an agent. Returns endorsement_id."""
        aid = agent_id.strip()
        if aid not in self.agents:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} agent not registered: {aid}")
        value = int(gl.message.value)
        if value <= 0:
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} endorsement requires a positive GEN value"
            )

        fee = (value * int(self.fee_bps)) // BPS_DENOMINATOR
        net = value - fee

        agent = self.agents[aid]
        agent.endorsements = u256(int(agent.endorsements) + 1)
        agent.bond = u256(int(agent.bond) + net)
        self.fees_accrued = u256(int(self.fees_accrued) + fee)

        eid = f"{aid}:endorse:{int(agent.endorsements)}"
        self.endorsement_records[eid] = Endorsement(
            endorsement_id=eid,
            agent_id=aid,
            endorser=gl.message.sender_address,
            amount=u256(net),
            created_at=datetime.now(timezone.utc).isoformat(),
            withdrawn=u256(0),
            status="active",
        )
        self.endorsement_ids.append(eid)
        return eid

    @gl.public.write
    def withdraw_endorsement(self, endorsement_id: str) -> None:
        """Endorser withdraws their stake after cooldown period."""
        eid = endorsement_id.strip()
        if eid not in self.endorsement_records:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} endorsement not found: {eid}")

        record = self.endorsement_records[eid]
        if str(gl.message.sender_address) != str(record.endorser):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the endorser can withdraw")
        if record.status != "active":
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} endorsement already {record.status}"
            )

        # Enforce cooldown
        created = datetime.fromisoformat(record.created_at)
        now = datetime.now(timezone.utc)
        elapsed = (now - created).total_seconds()
        if elapsed < ENDORSEMENT_COOLDOWN:
            remaining = int(ENDORSEMENT_COOLDOWN - elapsed)
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} cooldown not met, {remaining}s remaining"
            )

        amount = int(record.amount)
        agent = self.agents[record.agent_id]
        agent.bond = u256(max(0, int(agent.bond) - amount))

        record.withdrawn = u256(1)
        record.status = "withdrawn"

        # Transfer back to endorser
        gl.message.transfer(record.endorser, u256(amount))

    @gl.public.write
    def slash_endorsement(self, endorsement_id: str) -> None:
        """Agent owner slashes a bond after a 'fail' verdict. Funds go to fee_recipient."""
        eid = endorsement_id.strip()
        if eid not in self.endorsement_records:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} endorsement not found: {eid}")

        record = self.endorsement_records[eid]
        agent = self.agents[record.agent_id]

        if str(gl.message.sender_address) != str(agent.owner):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the agent owner can slash")
        if record.status != "active":
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} endorsement already {record.status}"
            )

        # Must have at least one "fail" verdict to justify slashing
        if int(agent.fail_count) == 0:
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} cannot slash without a fail verdict"
            )

        amount = int(record.amount)
        agent.bond = u256(max(0, int(agent.bond) - amount))
        agent.slashed = u256(int(agent.slashed) + amount)

        record.withdrawn = u256(1)
        record.status = "slashed"

        # Slashed funds go to fee recipient
        gl.message.transfer(self.fee_recipient, u256(amount))

    @gl.public.write
    def refund_endorsement(self, endorsement_id: str) -> None:
        """Contract owner refunds an endorsement in case of disputes."""
        eid = endorsement_id.strip()
        if eid not in self.endorsement_records:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} endorsement not found: {eid}")

        if str(gl.message.sender_address) != str(self.owner):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the contract owner can refund")

        record = self.endorsement_records[eid]
        if record.status != "active":
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} endorsement already {record.status}"
            )

        amount = int(record.amount)
        agent = self.agents[record.agent_id]
        agent.bond = u256(max(0, int(agent.bond) - amount))

        record.withdrawn = u256(1)
        record.status = "refunded"

        gl.message.transfer(record.endorser, u256(amount))

    # ─── Non-deterministic verification with evidence fetching ──────────────

    def _verify(self, task: str, claimed_outcome: str,
                evidence: str, evidence_url: str) -> dict:

        def leader_fn() -> dict:
            # FETCH evidence_url if provided (key reviewer requirement)
            fetched_content = ""
            evidence_fetched = False
            if evidence_url and evidence_url.strip():
                try:
                    fetched = gl.nondet.get_webpage(evidence_url.strip())
                    if fetched and str(fetched).strip():
                        fetched_content = str(fetched)[:3000]
                        evidence_fetched = True
                except Exception:
                    fetched_content = ""
                    evidence_fetched = False

            prompt = _build_prompt(
                task, claimed_outcome, evidence,
                fetched_content, evidence_url
            )

            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            analysis = raw if isinstance(raw, dict) else _parse_json(str(raw))
            score = _parse_score(analysis)
            reasoning = analysis.get("reasoning")
            if reasoning is None:
                reasoning = analysis.get("explanation", "")
            return {
                "score": score,
                "reasoning": str(reasoning),
                "evidence_fetched": evidence_fetched,
            }

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return _handle_leader_error(leaders_res, leader_fn)
            mine = leader_fn()
            their_score = _clamp_score(int(leaders_res.calldata["score"]))
            my_score = _clamp_score(int(mine["score"]))
            return abs(their_score - my_score) <= SCORE_TOLERANCE

        return gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

    # ─── View methods ───────────────────────────────────────────────────────

    def _agent_view(self, a: Agent) -> dict:
        total = int(a.total_evaluations)
        verity_score = (int(a.score_sum) // total) if total > 0 else 0
        return {
            "agent_id": a.agent_id,
            "owner": str(a.owner),
            "name": a.name,
            "framework": a.framework,
            "description": a.description,
            "manifest_url": a.manifest_url,
            "registered_at": a.registered_at,
            "total_evaluations": total,
            "pass": int(a.pass_count),
            "warn": int(a.warn_count),
            "fail": int(a.fail_count),
            "verity_score": verity_score,
            "endorsements": int(a.endorsements),
            "bond_wei": str(int(a.bond)),
            "slashed_wei": str(int(a.slashed)),
        }

    def _eval_view(self, e: Evaluation) -> dict:
        return {
            "eval_id": e.eval_id,
            "agent_id": e.agent_id,
            "task_id": e.task_id,
            "requester": str(e.requester),
            "task": e.task,
            "claimed_outcome": e.claimed_outcome,
            "evidence": e.evidence,
            "evidence_url": e.evidence_url,
            "evidence_fetched": int(e.evidence_fetched) == 1,
            "score": int(e.score),
            "verdict": e.verdict,
            "reasoning": e.reasoning,
            "created_at": e.created_at,
        }

    def _task_view(self, t: CommittedTask) -> dict:
        return {
            "task_id": t.task_id,
            "agent_id": t.agent_id,
            "committer": str(t.committer),
            "task": t.task,
            "committed_at": t.committed_at,
            "evaluated": int(t.evaluated) == 1,
        }

    def _endorsement_view(self, e: Endorsement) -> dict:
        return {
            "endorsement_id": e.endorsement_id,
            "agent_id": e.agent_id,
            "endorser": str(e.endorser),
            "amount_wei": str(int(e.amount)),
            "created_at": e.created_at,
            "status": e.status,
        }

    @gl.public.view
    def get_agent(self, agent_id: str) -> dict:
        aid = agent_id.strip()
        if aid not in self.agents:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} agent not found: {aid}")
        return self._agent_view(self.agents[aid])

    @gl.public.view
    def list_agents(self) -> list:
        out = []
        for aid in self.agent_ids:
            out.append(self._agent_view(self.agents[aid]))
        return out

    @gl.public.view
    def get_evaluation(self, eval_id: str) -> dict:
        if eval_id not in self.evaluations:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} evaluation not found: {eval_id}")
        return self._eval_view(self.evaluations[eval_id])

    @gl.public.view
    def list_evaluations_for_agent(self, agent_id: str) -> list:
        aid = agent_id.strip()
        out = []
        for eid in self.eval_ids:
            e = self.evaluations[eid]
            if e.agent_id == aid:
                out.append(self._eval_view(e))
        return out

    @gl.public.view
    def get_recent_evaluations(self, limit: int) -> list:
        n = len(self.eval_ids)
        lim = limit if limit > 0 else 10
        start = n - lim if n > lim else 0
        out = []
        i = n - 1
        while i >= start:
            out.append(self._eval_view(self.evaluations[self.eval_ids[i]]))
            i -= 1
        return out

    @gl.public.view
    def get_task(self, task_id: str) -> dict:
        tid = task_id.strip()
        if tid not in self.tasks:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} task not found: {tid}")
        return self._task_view(self.tasks[tid])

    @gl.public.view
    def list_tasks_for_agent(self, agent_id: str) -> list:
        aid = agent_id.strip()
        out = []
        for tid in self.task_ids:
            t = self.tasks[tid]
            if t.agent_id == aid:
                out.append(self._task_view(t))
        return out

    @gl.public.view
    def get_endorsement(self, endorsement_id: str) -> dict:
        eid = endorsement_id.strip()
        if eid not in self.endorsement_records:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} endorsement not found: {eid}")
        return self._endorsement_view(self.endorsement_records[eid])

    @gl.public.view
    def list_endorsements_for_agent(self, agent_id: str) -> list:
        aid = agent_id.strip()
        out = []
        for eid in self.endorsement_ids:
            e = self.endorsement_records[eid]
            if e.agent_id == aid:
                out.append(self._endorsement_view(e))
        return out

    @gl.public.view
    def get_authorized_evaluators(self, agent_id: str) -> list:
        aid = agent_id.strip()
        if aid not in self.agents:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} agent not found: {aid}")
        prefix = aid + "|"
        out = []
        for key in self.auth_keys:
            if key.startswith(prefix) and key in self.auth_map and self.auth_map[key] == "1":
                out.append(key[len(prefix):])
        return out

    @gl.public.view
    def get_stats(self) -> dict:
        return {
            "total_agents": len(self.agent_ids),
            "total_evaluations": int(self.total_evaluations),
            "total_tasks": int(self.total_tasks),
            "fees_accrued_wei": str(int(self.fees_accrued)),
        }

    @gl.public.view
    def get_config(self) -> dict:
        return {
            "owner": str(self.owner),
            "fee_recipient": str(self.fee_recipient),
            "fee_bps": int(self.fee_bps),
            "score_tolerance": SCORE_TOLERANCE,
            "pass_threshold": PASS_THRESHOLD,
            "warn_threshold": WARN_THRESHOLD,
            "endorsement_cooldown": ENDORSEMENT_COOLDOWN,
        }
