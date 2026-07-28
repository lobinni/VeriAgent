"""Direct-mode tests for the VeriAgent intelligent contract.

Run from the repo root:  pytest tests/direct/ -v

Direct mode runs the leader function in-memory (no server). The LLM is mocked
with mock_llm. The validator's consensus logic is exercised separately via
direct_vm.run_validator, which replays the validator captured from the last
gl.vm.run_nondet_unsafe call.
"""

import json

CONTRACT = "contracts/veriagent.py"
GEN = 10 ** 18  # 1 GEN in wei

# The prompt always contains this phrase, so it matches every adjudication.
PROMPT_PATTERN = r"impartial auditor"


def _mock_score(direct_vm, score, reasoning="mocked adjudication"):
    direct_vm.clear_mocks()
    direct_vm.mock_llm(PROMPT_PATTERN, json.dumps({"score": score, "reasoning": reasoning}))


def _deploy(direct_deploy, direct_vm, sender, fee_recipient="", fee_bps=100):
    direct_vm.sender = sender
    return direct_deploy(CONTRACT, fee_recipient, fee_bps)


def _register(contract, direct_vm, sender, agent_id="agent-1", name="Test Agent"):
    direct_vm.sender = sender
    contract.register_agent(
        agent_id, name, "custom", "an autonomous agent", "https://agents.example.com/a1"
    )


# --------------------------------- config ---------------------------------


def test_config_defaults_to_deployer_fee_recipient(direct_deploy, direct_vm, direct_owner):
    c = _deploy(direct_deploy, direct_vm, direct_owner, fee_recipient="", fee_bps=250)
    cfg = c.get_config()
    assert cfg["fee_bps"] == 250
    assert cfg["fee_recipient"].startswith("0x")
    assert cfg["owner"].startswith("0x")
    assert cfg["pass_threshold"] == 70
    assert cfg["warn_threshold"] == 40
    assert cfg["score_tolerance"] == 15


def test_fee_bps_is_clamped(direct_deploy, direct_vm, direct_owner):
    c = _deploy(direct_deploy, direct_vm, direct_owner, fee_bps=999999)
    assert c.get_config()["fee_bps"] == 10000


# ------------------------------ registration -------------------------------


def test_register_and_get_agent(direct_deploy, direct_vm, direct_owner, direct_alice):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    _register(c, direct_vm, direct_alice, "agent-1", "Scout")

    a = c.get_agent("agent-1")
    assert a["agent_id"] == "agent-1"
    assert a["name"] == "Scout"
    assert a["owner"].startswith("0x")
    assert a["total_evaluations"] == 0
    assert a["verity_score"] == 0
    assert a["endorsements"] == 0
    assert a["bond_wei"] == "0"

    listed = c.list_agents()
    assert len(listed) == 1
    assert listed[0]["agent_id"] == "agent-1"


def test_register_duplicate_reverts(direct_deploy, direct_vm, direct_owner, direct_alice):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    _register(c, direct_vm, direct_alice, "agent-1")
    with direct_vm.expect_revert("already registered"):
        _register(c, direct_vm, direct_alice, "agent-1")


def test_register_empty_id_reverts(direct_deploy, direct_vm, direct_owner, direct_alice):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("agent_id is required"):
        c.register_agent("   ", "x", "y", "z", "https://x.example.com")


def test_get_missing_agent_reverts(direct_deploy, direct_vm, direct_owner):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    with direct_vm.expect_revert("agent not found"):
        c.get_agent("nope")


# ------------------------------ adjudication -------------------------------


def test_evaluation_pass(direct_deploy, direct_vm, direct_owner, direct_alice, direct_bob):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    _register(c, direct_vm, direct_alice, "agent-1")

    _mock_score(direct_vm, 92, "evidence clearly supports the claim")
    direct_vm.sender = direct_bob
    eval_id = c.request_evaluation(
        "agent-1", "Summarize the report", "Delivered an accurate summary",
        "log: produced a faithful 5-point summary matching the source", "https://evidence.example.com/1",
    )
    assert eval_id == "agent-1#1"

    ev = c.get_evaluation(eval_id)
    assert ev["score"] == 92
    assert ev["verdict"] == "pass"
    assert ev["requester"].startswith("0x")

    a = c.get_agent("agent-1")
    assert a["total_evaluations"] == 1
    assert a["pass"] == 1
    assert a["warn"] == 0
    assert a["fail"] == 0
    assert a["verity_score"] == 92


def test_evaluation_warn(direct_deploy, direct_vm, direct_owner, direct_alice):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    _register(c, direct_vm, direct_alice, "agent-1")
    _mock_score(direct_vm, 55)
    direct_vm.sender = direct_alice
    c.request_evaluation("agent-1", "task", "claim", "partial evidence", "https://e.example.org/x")
    a = c.get_agent("agent-1")
    assert a["warn"] == 1
    assert a["verity_score"] == 55


def test_evaluation_fail(direct_deploy, direct_vm, direct_owner, direct_alice):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    _register(c, direct_vm, direct_alice, "agent-1")
    _mock_score(direct_vm, 12)
    direct_vm.sender = direct_alice
    c.request_evaluation("agent-1", "task", "claim", "evidence contradicts claim", "https://e.example.io/x")
    a = c.get_agent("agent-1")
    assert a["fail"] == 1
    assert a["verity_score"] == 12


def test_verity_score_is_running_average(direct_deploy, direct_vm, direct_owner, direct_alice):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    _register(c, direct_vm, direct_alice, "agent-1")
    direct_vm.sender = direct_alice

    _mock_score(direct_vm, 80)
    c.request_evaluation("agent-1", "t1", "c1", "e1", "")
    _mock_score(direct_vm, 100)
    c.request_evaluation("agent-1", "t2", "c2", "e2", "")

    a = c.get_agent("agent-1")
    assert a["total_evaluations"] == 2
    assert a["pass"] == 2
    assert a["verity_score"] == 90  # (80 + 100) // 2


def test_evaluation_on_unregistered_reverts(direct_deploy, direct_vm, direct_owner, direct_alice):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    _mock_score(direct_vm, 90)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("agent not registered"):
        c.request_evaluation("ghost", "t", "c", "e", "")


def test_evaluation_missing_fields_reverts(direct_deploy, direct_vm, direct_owner, direct_alice):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    _register(c, direct_vm, direct_alice, "agent-1")
    _mock_score(direct_vm, 90)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("are required"):
        c.request_evaluation("agent-1", "t", "c", "   ", "")


def test_malformed_llm_output_reverts(direct_deploy, direct_vm, direct_owner, direct_alice):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    _register(c, direct_vm, direct_alice, "agent-1")
    direct_vm.clear_mocks()
    direct_vm.mock_llm(PROMPT_PATTERN, "the agent did fine, no json here")
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("no JSON object"):
        c.request_evaluation("agent-1", "t", "c", "e", "")


def test_list_and_recent_evaluations(direct_deploy, direct_vm, direct_owner, direct_alice):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    _register(c, direct_vm, direct_alice, "agent-1")
    _register(c, direct_vm, direct_alice, "agent-2")
    direct_vm.sender = direct_alice

    _mock_score(direct_vm, 88)
    c.request_evaluation("agent-1", "t", "c", "e", "")
    _mock_score(direct_vm, 30)
    c.request_evaluation("agent-2", "t", "c", "e", "")

    for_a1 = c.list_evaluations_for_agent("agent-1")
    assert len(for_a1) == 1
    assert for_a1[0]["agent_id"] == "agent-1"

    recent = c.get_recent_evaluations(10)
    assert len(recent) == 2
    assert recent[0]["agent_id"] == "agent-2"  # most recent first

    stats = c.get_stats()
    assert stats["total_agents"] == 2
    assert stats["total_evaluations"] == 2


# ------------------------------ endorsements -------------------------------


def test_endorse_agent_locks_bond_and_accrues_fee(direct_deploy, direct_vm, direct_owner, direct_alice, direct_bob):
    c = _deploy(direct_deploy, direct_vm, direct_owner, fee_bps=100)  # 1%
    _register(c, direct_vm, direct_alice, "agent-1")

    direct_vm.sender = direct_bob
    direct_vm.value = 5 * GEN
    c.endorse_agent("agent-1")
    direct_vm.value = 0

    a = c.get_agent("agent-1")
    assert a["endorsements"] == 1
    # 1% fee on 5 GEN -> fee 0.05 GEN, net bond 4.95 GEN
    assert a["bond_wei"] == str(495 * 10 ** 16)
    assert c.get_stats()["fees_accrued_wei"] == str(5 * 10 ** 16)


def test_endorse_zero_value_reverts(direct_deploy, direct_vm, direct_owner, direct_alice, direct_bob):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    _register(c, direct_vm, direct_alice, "agent-1")
    direct_vm.sender = direct_bob
    direct_vm.value = 0
    with direct_vm.expect_revert("positive GEN value"):
        c.endorse_agent("agent-1")


def test_endorse_unregistered_reverts(direct_deploy, direct_vm, direct_owner, direct_bob):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    direct_vm.sender = direct_bob
    direct_vm.value = GEN
    with direct_vm.expect_revert("agent not registered"):
        c.endorse_agent("ghost")
    direct_vm.value = 0


# --------------------------- validator consensus ---------------------------


def test_validator_agrees_within_tolerance(direct_deploy, direct_vm, direct_owner, direct_alice):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    _register(c, direct_vm, direct_alice, "agent-1")
    _mock_score(direct_vm, 90)
    direct_vm.sender = direct_alice
    c.request_evaluation("agent-1", "t", "c", "e", "")

    # Validator re-runs leader (mock still 90). Leader override 100 -> |100-90|=10 <= 15.
    assert direct_vm.run_validator(leader_result={"score": 100, "reasoning": ""}) is True


def test_validator_disagrees_outside_tolerance(direct_deploy, direct_vm, direct_owner, direct_alice):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    _register(c, direct_vm, direct_alice, "agent-1")
    _mock_score(direct_vm, 90)
    direct_vm.sender = direct_alice
    c.request_evaluation("agent-1", "t", "c", "e", "")

    # Leader override 40 -> |40-90|=50 > 15.
    assert direct_vm.run_validator(leader_result={"score": 40, "reasoning": ""}) is False


def test_validator_disagrees_on_leader_error(direct_deploy, direct_vm, direct_owner, direct_alice):
    c = _deploy(direct_deploy, direct_vm, direct_owner)
    _register(c, direct_vm, direct_alice, "agent-1")
    _mock_score(direct_vm, 90)
    direct_vm.sender = direct_alice
    c.request_evaluation("agent-1", "t", "c", "e", "")

    # Leader errored but validator re-run succeeds (mock present) -> disagree.
    assert direct_vm.run_validator(leader_error=Exception("[LLM_ERROR] boom")) is False
