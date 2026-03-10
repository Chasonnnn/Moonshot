from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from app.schemas import (
    DimensionScoreOutput,
    GenerationResult,
    Interpretation,
    ModelInvocationTrace,
    Rubric,
    RubricDimension,
    ScoreResult,
    TaskFamily,
    TaskVariant,
)
from app.schemas.contracts import CaseSpec


_DEFAULT_VARIANT_COUNT = 12
_MIN_VARIANT_COUNT = 5
_MAX_VARIANT_COUNT = 20


_FIXTURE_PROFILES: dict[str, dict[str, Any]] = {
    "tpl_data_analyst": {
        "task_prompt": (
            "Investigate a conversion-rate decline, isolate likely root causes, validate with multiple checks, "
            "and present decisions with confidence caveats."
        ),
        "skills": ["sql", "python", "dashboard", "analysis"],
        "difficulty_plan": [
            "foundation",
            "foundation",
            "intermediate",
            "intermediate",
            "intermediate",
            "advanced",
            "advanced",
            "advanced",
            "expert",
            "expert",
            "expert",
            "capstone",
        ],
        "rubric_dimensions": [
            {
                "key": "analytical_depth",
                "anchor": "Identifies root causes with triangulated evidence from multiple slices.",
                "evaluation_points": [
                    "Compares at least two segments before concluding",
                    "Separates signal from noise with confidence caveats",
                    "Explains causal hypotheses and alternatives",
                ],
                "evidence_signals": [
                    "cross-segment comparison",
                    "temporal validation",
                    "counterfactual check",
                ],
                "common_failure_modes": [
                    "single-slice conclusion",
                    "missing uncertainty statement",
                ],
                "score_bands": {
                    "1": "Unsubstantiated conclusion with no checks",
                    "3": "Reasonable hypothesis with partial validation",
                    "5": "Multi-source validated diagnosis with caveats",
                },
            },
            {
                "key": "sql_proficiency",
                "anchor": "Uses accurate and iterative SQL checks to validate findings.",
                "evaluation_points": [
                    "Chooses appropriate joins/filters",
                    "Validates row-count or aggregation integrity",
                    "Builds queries that are easy to audit",
                ],
                "evidence_signals": ["query correctness", "sanity checks", "traceability"],
                "common_failure_modes": ["aggregation mismatch", "missing null handling"],
                "score_bands": {
                    "1": "Incorrect SQL that invalidates conclusions",
                    "3": "Mostly correct SQL with limited validation",
                    "5": "Robust SQL workflow with explicit checks",
                },
            },
            {
                "key": "communication",
                "anchor": "Communicates decisions clearly for technical and business stakeholders.",
                "evaluation_points": [
                    "Structures findings into issue/evidence/action",
                    "Uses audience-appropriate language",
                    "States risks and next actions",
                ],
                "evidence_signals": ["clear narrative", "actionable recommendation"],
                "common_failure_modes": ["overly technical framing", "no prioritization"],
                "score_bands": {
                    "1": "Confusing output with unclear recommendation",
                    "3": "Understandable output with limited prioritization",
                    "5": "Clear executive-ready recommendation with risks",
                },
            },
            {
                "key": "verification",
                "anchor": "Performs verification steps before final recommendations.",
                "evaluation_points": [
                    "Runs consistency checks",
                    "Compares alternative explanations",
                    "Records unresolved unknowns",
                ],
                "evidence_signals": ["verification events", "cross-check queries"],
                "common_failure_modes": ["no verification pass", "ignores contradictions"],
                "score_bands": {
                    "1": "No explicit verification",
                    "3": "Some verification with gaps",
                    "5": "Comprehensive verification and limitations",
                },
            },
        ],
        "failure_modes": [
            "Jumps to conclusions without evidence.",
            "No uncertainty caveats.",
        ],
        "mock_score": {
            "confidence": 0.87,
            "dimension_scores": {
                "analytical_depth": 0.9,
                "sql_proficiency": 0.85,
                "communication": 0.88,
                "verification": 0.82,
            },
            "trigger_codes": ["strong_evidence_chain", "appropriate_caveats"],
        },
    },
    "tpl_jda_quality": {
        "task_prompt": (
            "Resolve the source-vs-dashboard discrepancy, identify likely data-quality or ETL root causes, "
            "and produce escalation-ready findings."
        ),
        "skills": ["sql", "dashboard", "documentation", "qa"],
        "difficulty_plan": [
            "foundation",
            "foundation",
            "intermediate",
            "intermediate",
            "intermediate",
            "advanced",
            "advanced",
            "advanced",
            "expert",
            "expert",
            "expert",
            "capstone",
        ],
        "rubric_dimensions": [
            {
                "key": "data_quality_process",
                "anchor": "Systematically investigates missing and duplicate records.",
                "evaluation_points": [
                    "Distinguishes missing vs duplicate impact",
                    "Links evidence to pipeline stage",
                    "Uses repeatable investigation checklist",
                ],
                "evidence_signals": ["dedupe check", "reconciliation query", "lineage notes"],
                "common_failure_modes": ["confuses duplicate with missing", "no lineage reasoning"],
                "score_bands": {
                    "1": "Ad hoc triage without root-cause isolation",
                    "3": "Partial systematic process",
                    "5": "Clear and reproducible RCA workflow",
                },
            },
            {
                "key": "sql_accuracy",
                "anchor": "Writes accurate comparison and validation SQL.",
                "evaluation_points": [
                    "Uses consistent keys",
                    "Validates intermediate results",
                    "Prevents double counting",
                ],
                "evidence_signals": ["query correctness", "runtime sanity"],
                "common_failure_modes": ["join explosion", "inconsistent filters"],
                "score_bands": {
                    "1": "Queries produce misleading results",
                    "3": "Mostly correct with minor integrity gaps",
                    "5": "Accurate and defensible SQL pipeline",
                },
            },
            {
                "key": "documentation",
                "anchor": "Documents findings with precise references.",
                "evaluation_points": [
                    "Captures assumptions",
                    "Provides reproducible evidence references",
                    "Summarizes impact clearly",
                ],
                "evidence_signals": ["referenced artifacts", "decision log"],
                "common_failure_modes": ["missing references", "ambiguous impact summary"],
                "score_bands": {
                    "1": "Unstructured notes",
                    "3": "Adequate notes with gaps",
                    "5": "Clear and audit-ready documentation",
                },
            },
            {
                "key": "escalation_judgment",
                "anchor": "Escalates appropriately based on impact and certainty.",
                "evaluation_points": [
                    "Chooses correct severity level",
                    "Separates knowns from unknowns",
                    "Recommends next owner/actions",
                ],
                "evidence_signals": ["severity rationale", "ownership clarity"],
                "common_failure_modes": ["premature escalation", "under-escalation"],
                "score_bands": {
                    "1": "Escalation choice is unsupported",
                    "3": "Reasonable escalation with weak rationale",
                    "5": "Strong escalation decision with clear ownership",
                },
            },
        ],
        "failure_modes": [
            "No duplicate/missing split.",
            "Missing escalation rationale.",
        ],
        "mock_score": {
            "confidence": 0.82,
            "dimension_scores": {
                "data_quality_process": 0.85,
                "sql_accuracy": 0.8,
                "documentation": 0.84,
                "escalation_judgment": 0.78,
            },
            "trigger_codes": ["systematic_investigation"],
        },
    },
    "tpl_jda_ambiguity": {
        "task_prompt": (
            "Respond to an ambiguous stakeholder request by clarifying assumptions, asking targeted questions, "
            "and proposing a scoped deliverable with escalation logic."
        ),
        "skills": ["communication", "assumptions", "escalation", "analysis"],
        "difficulty_plan": [
            "foundation",
            "foundation",
            "intermediate",
            "intermediate",
            "intermediate",
            "advanced",
            "advanced",
            "advanced",
            "expert",
            "expert",
            "expert",
            "capstone",
        ],
        "rubric_dimensions": [
            {
                "key": "ambiguity_recognition",
                "anchor": "Identifies key ambiguities in the request.",
                "evaluation_points": [
                    "Surfaces missing scope details",
                    "Identifies risks of wrong assumptions",
                    "Proposes clarifying checkpoints",
                ],
                "evidence_signals": ["clarifying questions", "scope decomposition"],
                "common_failure_modes": ["assumes scope silently", "ignores unknowns"],
                "score_bands": {
                    "1": "Misses core ambiguities",
                    "3": "Catches obvious ambiguities",
                    "5": "Comprehensive ambiguity map",
                },
            },
            {
                "key": "assumption_documentation",
                "anchor": "States assumptions explicitly and clearly.",
                "evaluation_points": [
                    "Lists assumptions with confidence level",
                    "Maps assumptions to decisions",
                    "Flags invalidation conditions",
                ],
                "evidence_signals": ["assumption ledger", "explicit caveats"],
                "common_failure_modes": ["implicit assumptions", "no caveat tracking"],
                "score_bands": {
                    "1": "Implicit assumptions only",
                    "3": "Some assumptions stated",
                    "5": "Clear assumption management",
                },
            },
            {
                "key": "communication_clarity",
                "anchor": "Communicates professionally and with structure.",
                "evaluation_points": [
                    "Uses concise and audience-appropriate language",
                    "Structures response around decision and action",
                    "Includes timeline/ownership",
                ],
                "evidence_signals": ["structured response", "action framing"],
                "common_failure_modes": ["rambling response", "missing ask"],
                "score_bands": {
                    "1": "Unclear communication",
                    "3": "Reasonably clear communication",
                    "5": "Executive-ready concise communication",
                },
            },
            {
                "key": "escalation_appropriateness",
                "anchor": "Balances proactive delivery with clarification.",
                "evaluation_points": [
                    "Escalates only when needed",
                    "Commits to a minimum viable deliverable",
                    "Uses escalation triggers",
                ],
                "evidence_signals": ["escalation criteria", "delivery fallback plan"],
                "common_failure_modes": ["blocks without progress", "over-commits without clarity"],
                "score_bands": {
                    "1": "Escalation behavior is counterproductive",
                    "3": "Adequate escalation behavior",
                    "5": "Nuanced escalation and delivery balance",
                },
            },
        ],
        "failure_modes": [
            "Assumes scope without clarifying.",
            "Unclear stakeholder communication.",
        ],
        "mock_score": {
            "confidence": 0.91,
            "dimension_scores": {
                "ambiguity_recognition": 0.95,
                "assumption_documentation": 0.9,
                "communication_clarity": 0.92,
                "escalation_appropriateness": 0.88,
            },
            "trigger_codes": ["strong_communication", "proactive_clarification"],
        },
    },
    "tpl_customer_support_judgment": {
        "task_prompt": (
            "Prioritize a mixed customer-support queue, apply refund policy with judgment, "
            "and produce an escalation-ready response that stays calm and reviewable."
        ),
        "skills": ["prioritization", "policy", "escalation", "writing", "communication"],
        "difficulty_plan": [
            "foundation",
            "foundation",
            "triage",
            "triage",
            "triage",
            "policy",
            "policy",
            "policy",
            "escalation",
            "escalation",
            "escalation",
            "capstone",
        ],
        "rubric_dimensions": [
            {
                "key": "queue_prioritization",
                "anchor": "Orders work using customer harm, SLA risk, and business impact.",
                "evaluation_points": [
                    "Uses SLA risk and customer harm in prioritization",
                    "Explains why priority order changed",
                    "Avoids defaulting to queue order alone",
                ],
                "evidence_signals": ["priority queue", "reason-code notes"],
                "common_failure_modes": ["fifo ordering", "vip-only prioritization"],
                "score_bands": {
                    "1": "Priority order is not defensible",
                    "3": "Priority order is reasonable with some gaps",
                    "5": "Priority order is clear, harm-based, and reviewable",
                },
            },
            {
                "key": "policy_judgment",
                "anchor": "Applies policy correctly while documenting when exceptions are justified.",
                "evaluation_points": [
                    "Reads baseline policy correctly",
                    "Documents exception rationale",
                    "States risk or precedent implications",
                ],
                "evidence_signals": ["policy citation notes", "exception rationale"],
                "common_failure_modes": ["misreads policy", "undocumented exception"],
                "score_bands": {
                    "1": "Policy application is incorrect or inconsistent",
                    "3": "Policy application is mostly correct with weak exception logic",
                    "5": "Policy application is correct and exception handling is well-defended",
                },
            },
            {
                "key": "escalation_quality",
                "anchor": "Escalates with a clear owner, reason, and next action.",
                "evaluation_points": [
                    "Uses explicit escalation trigger",
                    "Names next owner and expected action",
                    "Hands off sufficient context",
                ],
                "evidence_signals": ["escalation summary", "reason codes", "handoff note"],
                "common_failure_modes": ["vague handoff", "no owner", "escalates too early"],
                "score_bands": {
                    "1": "Escalation is premature or incomplete",
                    "3": "Escalation is acceptable but lacks detail",
                    "5": "Escalation is crisp, justified, and actionable",
                },
            },
            {
                "key": "customer_empathy",
                "anchor": "Keeps the customer response calm, specific, and respectful.",
                "evaluation_points": [
                    "Acknowledges customer impact",
                    "Uses ownership language",
                    "Provides a next update window",
                ],
                "evidence_signals": ["customer response draft"],
                "common_failure_modes": ["robotic tone", "defensive tone"],
                "score_bands": {
                    "1": "Tone is rigid or escalatory",
                    "3": "Tone is acceptable with limited empathy",
                    "5": "Tone is calm, respectful, and confidence-building",
                },
            },
            {
                "key": "written_clarity",
                "anchor": "Communicates the decision and rationale concisely.",
                "evaluation_points": [
                    "States the decision clearly",
                    "Keeps the note structured and brief",
                    "Separates rationale from next steps",
                ],
                "evidence_signals": ["reply structure", "handoff structure"],
                "common_failure_modes": ["buried decision", "rambling response"],
                "score_bands": {
                    "1": "Writing is hard to follow or incomplete",
                    "3": "Writing is understandable but uneven",
                    "5": "Writing is concise, structured, and immediately actionable",
                },
            },
        ],
        "failure_modes": [
            "Escalates without a trigger or next owner.",
            "Quotes policy without translating it into a customer-safe explanation.",
            "Fails to revise the decision after new evidence changes the root cause.",
        ],
        "mock_score": {
            "confidence": 0.9,
            "dimension_scores": {
                "queue_prioritization": 0.92,
                "policy_judgment": 0.9,
                "escalation_quality": 0.88,
                "customer_empathy": 0.91,
                "written_clarity": 0.87,
            },
            "trigger_codes": [
                "harm_based_triage",
                "policy_exception_documented",
                "decision_revised_with_new_evidence",
            ],
        },
    },
    "tpl_doordash_enablement": {
        "task_prompt": (
            "Design and defend a strategy to double unmanaged marketplace restaurant sales in Atlanta, "
            "including SQL fluency checks, experiment design, and ROI-based trade-offs."
        ),
        "skills": ["problem_framing", "sql", "python", "experiments", "slides", "communication"],
        "difficulty_plan": [
            "week_1_foundation",
            "week_1_foundation",
            "week_2_analysis",
            "week_2_analysis",
            "week_2_analysis",
            "week_3_strategy",
            "week_3_strategy",
            "week_3_strategy",
            "week_4_exec",
            "week_4_exec",
            "week_4_exec",
            "capstone",
        ],
        "rubric_dimensions": [
            {
                "key": "problem_framing",
                "anchor": "Defines the business objective, proxy metric, and success criteria without ambiguity.",
                "evaluation_points": [
                    "Defines what sales means in available data",
                    "States assumptions and confidence limits explicitly",
                    "Locks measurable pilot success criteria",
                ],
                "evidence_signals": ["metric taxonomy", "assumption log", "pilot guardrails"],
                "common_failure_modes": [
                    "uses undefined success metric",
                    "omits assumptions behind proxy metrics",
                ],
                "score_bands": {
                    "1": "Objective is vague and not measurable",
                    "3": "Objective is mostly clear with partial assumptions",
                    "5": "Objective and success criteria are explicit and testable",
                },
            },
            {
                "key": "analysis_correctness",
                "anchor": "Builds a valid root-cause narrative from robust data checks.",
                "evaluation_points": [
                    "Benchmarks managed vs unmanaged with control checks",
                    "Separates correlation from causation claims",
                    "Uses medians or outlier checks where needed",
                ],
                "evidence_signals": ["benchmark table", "validation query set", "outlier analysis"],
                "common_failure_modes": ["single-slice conclusion", "causal overclaim"],
                "score_bands": {
                    "1": "Analysis is inconsistent or unsupported",
                    "3": "Analysis is directionally right with gaps",
                    "5": "Analysis is rigorous and defensible",
                },
            },
            {
                "key": "recommendation_quality",
                "anchor": "Recommends interventions that map directly to diagnosed gaps.",
                "evaluation_points": [
                    "Actions map to specific funnel breakdowns",
                    "Prioritization is backed by readiness segmentation",
                    "Recommendation includes implementation sequence",
                ],
                "evidence_signals": ["action-to-gap mapping", "tiered rollout plan"],
                "common_failure_modes": ["generic recommendations", "no prioritization logic"],
                "score_bands": {
                    "1": "Recommendations are disconnected from evidence",
                    "3": "Recommendations are plausible but loosely mapped",
                    "5": "Recommendations are specific, prioritized, and evidence-linked",
                },
            },
            {
                "key": "tradeoff_roi_rigor",
                "anchor": "Quantifies ROI and trade-offs with clear go/no-go decision rules.",
                "evaluation_points": [
                    "Defines treatment/control pilot design",
                    "Models support cost scenarios",
                    "Uses explicit scale criteria before rollout",
                ],
                "evidence_signals": ["pilot design", "roi model", "decision threshold"],
                "common_failure_modes": ["roi without costs", "no control group"],
                "score_bands": {
                    "1": "Trade-off and ROI reasoning is missing",
                    "3": "Trade-off reasoning exists with limited rigor",
                    "5": "Trade-off and ROI model is complete and decision-ready",
                },
            },
            {
                "key": "communication_story",
                "anchor": "Delivers an executive-ready storyline in a concise 5-slide structure.",
                "evaluation_points": [
                    "Leads with decision headline and so-what",
                    "Maintains logical narrative flow in slide order",
                    "Defends recommendations under challenge questions",
                ],
                "evidence_signals": ["clear headline", "prioritized narrative", "q_and_a resilience"],
                "common_failure_modes": ["chart dump", "unclear ask"],
                "score_bands": {
                    "1": "Storyline is fragmented and unclear",
                    "3": "Storyline is understandable but not sharp",
                    "5": "Storyline is concise, compelling, and resilient to probing",
                },
            },
            {
                "key": "sql_proficiency",
                "anchor": "Solves SQL tasks from basic filtering to cumulative window logic.",
                "evaluation_points": [
                    "Uses date filtering and grouping correctly",
                    "Builds accurate joins and distinct counts",
                    "Implements running totals with window functions",
                ],
                "evidence_signals": ["correct sql outputs", "query readability", "window function usage"],
                "common_failure_modes": ["join double-counting", "incorrect window partition/order"],
                "score_bands": {
                    "1": "SQL results are incorrect for key questions",
                    "3": "SQL is mostly correct with minor issues",
                    "5": "SQL is accurate, complete, and auditable",
                },
            },
        ],
        "failure_modes": [
            "Conflates proxy metrics with guaranteed revenue outcomes.",
            "Skips pilot guardrails and scale criteria.",
            "Presents recommendations without a resource trade-off model.",
        ],
        "mock_score": {
            "confidence": 0.89,
            "dimension_scores": {
                "problem_framing": 0.91,
                "analysis_correctness": 0.88,
                "recommendation_quality": 0.87,
                "tradeoff_roi_rigor": 0.9,
                "communication_story": 0.86,
                "sql_proficiency": 0.86,
            },
            "trigger_codes": [
                "pilot_design_rigorous",
                "roi_tradeoff_quantified",
                "fixture_program_4week",
            ],
        },
    },
}


def _resolve_template_id(template_id: str | None) -> str:
    candidate = (template_id or "").strip()
    if not candidate:
        raise RuntimeError("fixture_template_not_found:missing_template_id")
    if candidate not in _FIXTURE_PROFILES:
        raise RuntimeError(f"fixture_template_not_found:{candidate}")
    return candidate


def _resolve_variant_count(variant_count: int | None) -> int:
    if variant_count is None:
        return _DEFAULT_VARIANT_COUNT
    if variant_count < _MIN_VARIANT_COUNT or variant_count > _MAX_VARIANT_COUNT:
        raise ValueError(
            f"fixture_variant_count_out_of_range:{variant_count}"
        )
    return variant_count


def _metric(events: list[dict[str, Any]]) -> dict[str, Any]:
    query_runs = sum(1 for e in events if e.get("event_type") == "sql_query_run")
    query_errors = sum(1 for e in events if e.get("event_type") == "sql_query_error")
    python_runs = sum(1 for e in events if e.get("event_type") == "python_code_run")
    r_runs = sum(1 for e in events if e.get("event_type") in {"analysis_r_run", "r_code_run"})
    dashboard_actions = sum(1 for e in events if e.get("event_type") == "dashboard_action")
    ai_calls = sum(1 for e in events if e.get("event_type") == "copilot_invoked")
    verification_steps = sum(1 for e in events if e.get("event_type") == "verification_step_completed")
    policy_flags = sum(1 for e in events if e.get("payload", {}).get("policy_violation") is True)

    first_action = None
    for event in events:
        first_action = event.get("payload", {}).get("time_to_first_action_ms")
        if first_action is not None:
            break

    query_error_rate = (query_errors / query_runs) if query_runs else 0.0
    return {
        "time_to_first_action_ms": first_action,
        "query_attempt_count": query_runs,
        "query_error_rate": round(query_error_rate, 3),
        "python_run_count": python_runs,
        "r_run_count": r_runs,
        "dashboard_action_count": dashboard_actions,
        "ai_prompt_count": ai_calls,
        "verification_steps": verification_steps,
        "policy_violation_count": policy_flags,
    }


def _fixture_trace(template_id: str, seed_text: str) -> ModelInvocationTrace:
    prompt_hash = hashlib.sha256(seed_text.encode("utf-8")).hexdigest()[:16]
    return ModelInvocationTrace(
        provider="fixture",
        model=f"fixture:{template_id}",
        prompt_hash=prompt_hash,
        latency_ms=1,
    )


def _build_variants(*, base_prompt: str, profile: dict[str, Any], variant_count: int) -> list[TaskVariant]:
    skills = list(profile["skills"])
    difficulty_plan = list(profile["difficulty_plan"])
    variants: list[TaskVariant] = []
    for idx in range(variant_count):
        skill = skills[idx % len(skills)]
        difficulty = difficulty_plan[idx % len(difficulty_plan)]
        round_hint = f"round_{(idx % 3) + 1}"
        variants.append(
            TaskVariant(
                prompt=(
                    f"Variant {idx + 1}: {base_prompt} Focus on {skill} evidence. "
                    f"Difficulty={difficulty}. Include reproducible checks and escalation rationale."
                ),
                skill=skill,
                difficulty_level=difficulty,
                round_hint=round_hint,
                estimated_minutes=10 + (idx % 4) * 5,
                deliverables=[
                    "analysis_summary",
                    "evidence_table",
                    "recommended_actions",
                ],
                artifact_refs=[
                    "orders.csv",
                    "etl_log.txt",
                    "dashboard_snapshot.png",
                ],
            )
        )
    return variants


def generate_from_fixture(
    case: CaseSpec,
    *,
    template_id: str | None,
    variant_count: int | None = None,
) -> GenerationResult:
    resolved = _resolve_template_id(template_id)
    resolved_variant_count = _resolve_variant_count(variant_count)
    profile = _FIXTURE_PROFILES[resolved]
    base_prompt = str(profile["task_prompt"])

    rubric = Rubric(
        dimensions=[
            RubricDimension.model_validate(item)
            for item in profile["rubric_dimensions"]
        ],
        failure_modes=list(profile["failure_modes"]),
        version="fixture-v2",
    )

    variants = _build_variants(
        base_prompt=base_prompt,
        profile=profile,
        variant_count=resolved_variant_count,
    )

    task_family = TaskFamily(
        case_id=case.id,
        variants=variants,
        rubric_id=rubric.id,
        status="generated",
        version="fixture-v2",
        generation_diagnostics={
            "mode": "fixture",
            "template_id": resolved,
            "variant_count": resolved_variant_count,
            "diversity_passed": True,
            "rubric_leakage_detected": False,
            "grounding_coverage_score": 1.0,
        },
    )

    return GenerationResult(
        task_family=task_family,
        rubric=rubric,
        model_trace=_fixture_trace(resolved, base_prompt),
    )


def score_from_fixture(
    *,
    session_id: UUID,
    template_id: str | None,
    events: list[dict[str, Any]],
    rubric_version: str,
    task_family_version: str,
) -> tuple[ScoreResult, Interpretation]:
    resolved = _resolve_template_id(template_id)
    profile = _FIXTURE_PROFILES[resolved]
    mock_score = profile["mock_score"]

    confidence = float(mock_score["confidence"])
    dimension_scores = dict(mock_score["dimension_scores"])
    trigger_codes = list(mock_score["trigger_codes"])
    if "fixture_score_profile" not in trigger_codes:
        trigger_codes.append("fixture_score_profile")

    dimension_evidence = {
        item["key"]: DimensionScoreOutput(
            key=item["key"],
            score=float(dimension_scores.get(item["key"], 0.0)),
            rationale=f"Fixture evidence indicates competency in {item['key'].replace('_', ' ')}.",
            failure_modes_matched=list(item.get("common_failure_modes", []))[:1],
            confidence=min(0.99, confidence + 0.03),
        )
        for item in profile["rubric_dimensions"]
    }

    objective_metrics = _metric(events)
    objective_metrics["rounds_completed"] = 3
    objective_metrics["tool_coverage"] = {
        "sql": objective_metrics["query_attempt_count"] > 0,
        "python": objective_metrics["python_run_count"] > 0,
        "r": objective_metrics["r_run_count"] > 0,
        "dashboard": objective_metrics["dashboard_action_count"] > 0,
    }

    score_result = ScoreResult(
        session_id=session_id,
        objective_metrics=objective_metrics,
        dimension_scores=dimension_scores,
        dimension_evidence=dimension_evidence,
        confidence=confidence,
        needs_human_review=confidence < 0.7,
        scorer_version="0.2.0",
        rubric_version=rubric_version,
        task_family_version=task_family_version,
        model_hash=hashlib.sha256(f"fixture:{resolved}".encode("utf-8")).hexdigest()[:16],
        llm_traces=[
            ModelInvocationTrace(
                provider="fixture",
                model=f"fixture:{resolved}",
                prompt_hash=hashlib.sha256(f"{resolved}:{session_id}".encode("utf-8")).hexdigest()[:16],
                latency_ms=1,
            )
        ],
        trigger_codes=trigger_codes,
        trigger_impacts=[],
    )

    interpretation = Interpretation(
        summary=f"Fixture-evaluated performance profile for template '{resolved}' with multi-round deterministic diagnostics.",
        suggestions=[
            "Review round-by-round evidence chain for consistency.",
            "Validate escalation rationale against rubric score bands.",
        ],
    )
    return score_result, interpretation


def fixture_timestamp_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
