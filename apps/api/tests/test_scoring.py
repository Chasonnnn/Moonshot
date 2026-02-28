from __future__ import annotations

import json
from statistics import mean
from uuid import uuid4

from app.providers.contracts import ProviderOutput
from app.schemas.contracts import Rubric, RubricDimension, ScoringConfig
from app.services.scoring import score_session


class MockEvaluatorProvider:
    def __init__(
        self,
        *,
        dimension_outputs: list[str] | None = None,
        holistic_outputs: list[str] | None = None,
        provider: str = "gemini",
        model: str = "gemini-test",
    ) -> None:
        self.dimension_outputs = list(dimension_outputs or [])
        self.holistic_outputs = list(holistic_outputs or [])
        self.provider = provider
        self.model = model
        self.dimension_call_count = 0
        self.holistic_call_count = 0

    def score_dimension(self, prompt: str) -> ProviderOutput:
        self.dimension_call_count += 1
        content = self.dimension_outputs.pop(0) if self.dimension_outputs else "{}"
        return ProviderOutput(content=content, provider=self.provider, model=self.model, prompt_hash="d-hash", latency_ms=10)

    def score_holistic(self, prompt: str) -> ProviderOutput:
        self.holistic_call_count += 1
        content = self.holistic_outputs.pop(0) if self.holistic_outputs else "{}"
        return ProviderOutput(content=content, provider=self.provider, model=self.model, prompt_hash="h-hash", latency_ms=12)


def _rubric() -> Rubric:
    return Rubric(
        dimensions=[
            RubricDimension(key="problem_framing", anchor="Frames problem scope clearly"),
            RubricDimension(key="sql_quality", anchor="Writes correct and efficient SQL"),
            RubricDimension(key="evidence_reasoning", anchor="Uses evidence to support conclusions"),
            RubricDimension(key="communication", anchor="Communicates recommendation clearly"),
        ],
        failure_modes=["policy_noncompliant", "unsupported_assumption"],
        version="0.2.0",
    )


def _events_for_heuristic() -> list[dict]:
    return [
        {"event_type": "sql_query_run", "payload": {"time_to_first_action_ms": 1200}},
        {"event_type": "copilot_invoked", "payload": {}},
    ]


def _events_for_llm() -> list[dict]:
    return [
        {"event_type": "sql_query_run", "payload": {"time_to_first_action_ms": 800}},
        {"event_type": "sql_query_error", "payload": {}},
        {"event_type": "copilot_invoked", "payload": {}},
        {"event_type": "verification_step_completed", "payload": {}},
    ]


def _dim_output(key: str, *, score: float, confidence: float, failure_modes: list[str] | None = None) -> str:
    return json.dumps(
        {
            "key": key,
            "score": score,
            "rationale": f"rationale-{key}",
            "failure_modes_matched": failure_modes or [],
            "confidence": confidence,
        }
    )


def _holistic_output(*, score: float, confidence: float, flags: list[str] | None = None) -> str:
    return json.dumps(
        {
            "overall_score": score,
            "overall_confidence": confidence,
            "consistency_flags": flags or [],
            "narrative_summary": "Holistic narrative summary",
            "suggestions": ["Focus on validation rigor."],
        }
    )


def test_heuristic_fallback_when_no_provider():
    score_result, interpretation = score_session(uuid4(), _events_for_heuristic(), rubric=None, provider=None, final_response=None)

    assert score_result.confidence == 0.65
    assert score_result.needs_human_review is True
    assert score_result.dimension_scores == {
        "problem_framing": 0.62,
        "sql_quality": 0.65,
        "evidence_reasoning": 0.63,
        "communication": 0.65,
    }
    assert set(score_result.trigger_codes) == {"low_confidence", "high_ai_low_verification"}
    assert interpretation.summary == "Candidate output requires additional human review for confidence/policy reasons."


def test_heuristic_fallback_when_no_rubric_dimensions():
    rubric = Rubric(dimensions=[], failure_modes=[], version="0.2.0")
    provider = MockEvaluatorProvider()

    score_result, _ = score_session(
        uuid4(),
        _events_for_heuristic(),
        rubric=rubric,
        provider=provider,
        final_response="candidate response",
    )

    assert score_result.confidence == 0.65
    assert provider.dimension_call_count == 0


def test_heuristic_fallback_when_no_final_response():
    provider = MockEvaluatorProvider()

    score_result, _ = score_session(
        uuid4(),
        _events_for_llm(),
        rubric=_rubric(),
        provider=provider,
        final_response=None,
    )

    assert score_result.scorer_version == "0.2.0"
    assert provider.dimension_call_count == 0


def test_llm_pass1_scores_each_dimension():
    provider = MockEvaluatorProvider(
        dimension_outputs=[
            _dim_output("problem_framing", score=0.72, confidence=0.81),
            _dim_output("sql_quality", score=0.68, confidence=0.78),
            _dim_output("evidence_reasoning", score=0.74, confidence=0.82),
            _dim_output("communication", score=0.76, confidence=0.85),
        ],
        holistic_outputs=[_holistic_output(score=0.73, confidence=0.84)],
    )

    score_result, _ = score_session(
        uuid4(),
        _events_for_llm(),
        rubric=_rubric(),
        task_prompt="Analyze KPI changes.",
        final_response="I would segment users and validate cohort drift.",
        provider=provider,
    )

    assert score_result.dimension_scores == {
        "problem_framing": 0.72,
        "sql_quality": 0.68,
        "evidence_reasoning": 0.74,
        "communication": 0.76,
    }
    assert set(score_result.dimension_evidence.keys()) == {
        "problem_framing",
        "sql_quality",
        "evidence_reasoning",
        "communication",
    }
    assert len(score_result.llm_traces) == 5


def test_llm_pass2_holistic_assessment():
    provider = MockEvaluatorProvider(
        dimension_outputs=[
            _dim_output("problem_framing", score=0.70, confidence=0.75),
            _dim_output("sql_quality", score=0.71, confidence=0.76),
            _dim_output("evidence_reasoning", score=0.72, confidence=0.77),
            _dim_output("communication", score=0.73, confidence=0.78),
        ],
        holistic_outputs=[_holistic_output(score=0.71, confidence=0.79)],
    )

    _, interpretation = score_session(
        uuid4(),
        _events_for_llm(),
        rubric=_rubric(),
        task_prompt="Analyze KPI changes.",
        final_response="I would run a comparative cohort analysis.",
        provider=provider,
    )

    assert interpretation.summary == "Holistic narrative summary"
    assert "Focus on validation rigor." in interpretation.suggestions


def test_llm_malformed_pass1_triggers_fallback():
    provider = MockEvaluatorProvider(
        dimension_outputs=[
            "not-json",
            "still-not-json",
            _dim_output("sql_quality", score=0.62, confidence=0.71),
            _dim_output("evidence_reasoning", score=0.64, confidence=0.72),
            _dim_output("communication", score=0.66, confidence=0.73),
        ],
        holistic_outputs=[_holistic_output(score=0.64, confidence=0.74)],
    )

    fallback_only, _ = score_session(uuid4(), _events_for_llm())
    score_result, _ = score_session(
        uuid4(),
        _events_for_llm(),
        rubric=_rubric(),
        task_prompt="Analyze KPI changes.",
        final_response="I would inspect outlier cohorts.",
        provider=provider,
    )

    assert score_result.dimension_scores["problem_framing"] == fallback_only.dimension_scores["problem_framing"]
    assert score_result.dimension_scores["sql_quality"] == 0.62
    assert score_result.dimension_scores["evidence_reasoning"] == 0.64
    assert score_result.dimension_scores["communication"] == 0.66
    assert "llm_parse_failure:problem_framing" in score_result.trigger_codes


def test_llm_malformed_pass2_uses_mean():
    confidences = [0.9, 0.8, 0.7, 0.6]
    scores = [0.8, 0.7, 0.6, 0.5]
    provider = MockEvaluatorProvider(
        dimension_outputs=[
            _dim_output("problem_framing", score=scores[0], confidence=confidences[0]),
            _dim_output("sql_quality", score=scores[1], confidence=confidences[1]),
            _dim_output("evidence_reasoning", score=scores[2], confidence=confidences[2]),
            _dim_output("communication", score=scores[3], confidence=confidences[3]),
        ],
        holistic_outputs=["{", "still bad"],
    )

    score_result, _ = score_session(
        uuid4(),
        _events_for_llm(),
        rubric=_rubric(),
        task_prompt="Analyze KPI changes.",
        final_response="I would verify joins and assumptions.",
        provider=provider,
        scoring_config=ScoringConfig(max_query_error_rate=1.0),
    )

    assert score_result.confidence == round(mean(confidences), 3)
    assert score_result.dimension_scores["communication"] == scores[3]
    assert "holistic_parse_failure" in score_result.trigger_codes


def test_consistency_flag_triggers_review():
    provider = MockEvaluatorProvider(
        dimension_outputs=[
            _dim_output("problem_framing", score=0.88, confidence=0.90),
            _dim_output("sql_quality", score=0.87, confidence=0.90),
            _dim_output("evidence_reasoning", score=0.86, confidence=0.90),
            _dim_output("communication", score=0.89, confidence=0.90),
        ],
        holistic_outputs=[_holistic_output(score=0.88, confidence=0.95, flags=["sql_quality"])],
    )

    score_result, _ = score_session(
        uuid4(),
        _events_for_llm(),
        rubric=_rubric(),
        task_prompt="Analyze KPI changes.",
        final_response="I would reconcile metric definitions before escalation.",
        provider=provider,
    )

    assert score_result.needs_human_review is True
    assert "dimension_holistic_inconsistency" in score_result.trigger_codes


def test_failure_mode_match_triggers():
    provider = MockEvaluatorProvider(
        dimension_outputs=[
            _dim_output("problem_framing", score=0.66, confidence=0.70, failure_modes=["policy_noncompliant"]),
            _dim_output("sql_quality", score=0.67, confidence=0.71),
            _dim_output("evidence_reasoning", score=0.68, confidence=0.72),
            _dim_output("communication", score=0.69, confidence=0.73),
        ],
        holistic_outputs=[_holistic_output(score=0.68, confidence=0.75)],
    )

    score_result, _ = score_session(
        uuid4(),
        _events_for_llm(),
        rubric=_rubric(),
        task_prompt="Analyze KPI changes.",
        final_response="I would check compliance constraints before drafting response.",
        provider=provider,
    )

    assert "failure_mode_match:policy_noncompliant" in score_result.trigger_codes


def test_model_hash_provenance():
    provider = MockEvaluatorProvider(
        provider="gemini",
        model="gemini-2.5-pro",
        dimension_outputs=[
            _dim_output("problem_framing", score=0.72, confidence=0.82),
            _dim_output("sql_quality", score=0.73, confidence=0.82),
            _dim_output("evidence_reasoning", score=0.74, confidence=0.82),
            _dim_output("communication", score=0.75, confidence=0.82),
        ],
        holistic_outputs=[_holistic_output(score=0.74, confidence=0.82)],
    )

    score_result, _ = score_session(
        uuid4(),
        _events_for_llm(),
        rubric=_rubric(),
        task_prompt="Analyze KPI changes.",
        final_response="I would test assumptions and triangulate with cohorts.",
        provider=provider,
    )

    assert score_result.model_hash != "local-baseline"
    assert len(score_result.model_hash) == 16


def test_objective_metrics_preserved():
    provider = MockEvaluatorProvider(
        dimension_outputs=[
            _dim_output("problem_framing", score=0.71, confidence=0.81),
            _dim_output("sql_quality", score=0.72, confidence=0.81),
            _dim_output("evidence_reasoning", score=0.73, confidence=0.81),
            _dim_output("communication", score=0.74, confidence=0.81),
        ],
        holistic_outputs=[_holistic_output(score=0.72, confidence=0.82)],
    )

    events = _events_for_llm()
    heuristic_result, _ = score_session(uuid4(), events)
    llm_result, _ = score_session(
        uuid4(),
        events,
        rubric=_rubric(),
        task_prompt="Analyze KPI changes.",
        final_response="I would verify cohort integrity.",
        provider=provider,
    )

    assert heuristic_result.objective_metrics == llm_result.objective_metrics


def test_mixed_dimension_fallback_keeps_valid_llm_scores():
    provider = MockEvaluatorProvider(
        dimension_outputs=[
            _dim_output("problem_framing", score=0.77, confidence=0.85),
            "bad-json",
            "bad-json-repair",
            _dim_output("evidence_reasoning", score=0.79, confidence=0.84),
            "bad-json",
            "bad-json-repair",
        ],
        holistic_outputs=[_holistic_output(score=0.78, confidence=0.83)],
    )

    fallback_only, _ = score_session(uuid4(), _events_for_llm())
    score_result, _ = score_session(
        uuid4(),
        _events_for_llm(),
        rubric=_rubric(),
        task_prompt="Analyze KPI changes.",
        final_response="I would compare recent releases with cohort quality.",
        provider=provider,
    )

    assert score_result.dimension_scores["problem_framing"] == 0.77
    assert score_result.dimension_scores["evidence_reasoning"] == 0.79
    assert score_result.dimension_scores["sql_quality"] == fallback_only.dimension_scores["sql_quality"]
    assert score_result.dimension_scores["communication"] == fallback_only.dimension_scores["communication"]
    assert "llm_parse_failure:sql_quality" in score_result.trigger_codes
    assert "llm_parse_failure:communication" in score_result.trigger_codes


def test_dimension_key_mismatch_triggers_parse_failure():
    provider = MockEvaluatorProvider(
        dimension_outputs=[
            _dim_output("wrong_key", score=0.75, confidence=0.85),
            _dim_output("still_wrong", score=0.75, confidence=0.85),
            _dim_output("sql_quality", score=0.7, confidence=0.8),
            _dim_output("evidence_reasoning", score=0.71, confidence=0.8),
            _dim_output("communication", score=0.72, confidence=0.8),
        ],
        holistic_outputs=[_holistic_output(score=0.71, confidence=0.8)],
    )

    score_result, _ = score_session(
        uuid4(),
        _events_for_llm(),
        rubric=_rubric(),
        task_prompt="Analyze KPI changes.",
        final_response="I would validate query lineage and recency windows.",
        provider=provider,
    )

    assert "llm_parse_failure:problem_framing" in score_result.trigger_codes


def test_llm_budget_cap_triggers_and_falls_back():
    provider = MockEvaluatorProvider(
        dimension_outputs=[
            _dim_output("problem_framing", score=0.81, confidence=0.86),
            _dim_output("sql_quality", score=0.82, confidence=0.86),
            _dim_output("evidence_reasoning", score=0.83, confidence=0.86),
            _dim_output("communication", score=0.84, confidence=0.86),
        ],
        holistic_outputs=[_holistic_output(score=0.82, confidence=0.86)],
    )
    config = ScoringConfig(llm_call_budget=2)

    fallback_only, _ = score_session(uuid4(), _events_for_llm())
    score_result, _ = score_session(
        uuid4(),
        _events_for_llm(),
        rubric=_rubric(),
        task_prompt="Analyze KPI changes.",
        final_response="I would stage a quick segmentation rerun.",
        provider=provider,
        scoring_config=config,
    )

    assert provider.dimension_call_count == 2
    assert provider.holistic_call_count == 0
    assert score_result.dimension_scores["problem_framing"] == 0.81
    assert score_result.dimension_scores["sql_quality"] == 0.82
    assert score_result.dimension_scores["evidence_reasoning"] == fallback_only.dimension_scores["evidence_reasoning"]
    assert score_result.dimension_scores["communication"] == fallback_only.dimension_scores["communication"]
    assert "llm_budget_exceeded" in score_result.trigger_codes


def test_dimension_evidence_persisted():
    provider = MockEvaluatorProvider(
        dimension_outputs=[
            _dim_output("problem_framing", score=0.73, confidence=0.83),
            _dim_output("sql_quality", score=0.74, confidence=0.83),
            _dim_output("evidence_reasoning", score=0.75, confidence=0.83),
            _dim_output("communication", score=0.76, confidence=0.83),
        ],
        holistic_outputs=[_holistic_output(score=0.75, confidence=0.83)],
    )

    score_result, _ = score_session(
        uuid4(),
        _events_for_llm(),
        rubric=_rubric(),
        task_prompt="Analyze KPI changes.",
        final_response="I would run diagnostic checks before escalation.",
        provider=provider,
    )

    assert len(score_result.dimension_evidence) == 4
    assert score_result.dimension_evidence["problem_framing"].rationale == "rationale-problem_framing"

    round_tripped = score_result.model_validate(score_result.model_dump(mode="json"))
    assert round_tripped.dimension_evidence["sql_quality"].score == 0.74


def test_scoring_config_rules_apply():
    provider = MockEvaluatorProvider(
        dimension_outputs=[
            _dim_output("problem_framing", score=0.7, confidence=0.8),
            _dim_output("sql_quality", score=0.7, confidence=0.8),
            _dim_output("evidence_reasoning", score=0.7, confidence=0.8),
            _dim_output("communication", score=0.7, confidence=0.8),
        ],
        holistic_outputs=[_holistic_output(score=0.7, confidence=0.8)],
    )

    events = [
        {"event_type": "sql_query_run", "payload": {"time_to_first_action_ms": 900}},
        {"event_type": "sql_query_error", "payload": {}},
        {"event_type": "copilot_invoked", "payload": {}},
    ]

    relaxed, _ = score_session(
        uuid4(),
        events,
        rubric=_rubric(),
        task_prompt="Analyze KPI changes.",
        final_response="I would run sanity checks.",
        provider=provider,
        scoring_config=ScoringConfig(min_verification_steps=0, max_query_error_rate=1.0),
    )

    strict, _ = score_session(
        uuid4(),
        events,
        rubric=_rubric(),
        task_prompt="Analyze KPI changes.",
        final_response="I would run sanity checks.",
        provider=provider,
        scoring_config=ScoringConfig(min_verification_steps=2, max_query_error_rate=0.1),
    )

    assert strict.confidence < relaxed.confidence
    assert "verification_below_min" in strict.trigger_codes
    assert "query_error_rate_exceeded" in strict.trigger_codes
