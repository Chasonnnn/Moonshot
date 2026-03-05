from app.schemas.contracts import CaseSpec
from app.services.generation import generate_from_case


class _FakeProvider:
    def __init__(self) -> None:
        self.variant_calls = 0
        self.rubric_calls = 0

    def generate_variant(self, prompt: str):
        self.variant_calls += 1
        return type(
            "Output",
            (),
            {
                "content": "Investigate source and dashboard discrepancies with reproducible evidence.",
                "model": "gpt-5.3-codex",
                "provider": "litellm",
                "prompt_hash": "seedhash",
                "latency_ms": 12,
            },
        )()

    def generate_rubric(self, prompt: str):
        self.rubric_calls += 1
        return type(
            "Output",
            (),
            {
                "content": "Rubric guidance",
                "model": "gpt-5.3-codex",
                "provider": "litellm",
                "prompt_hash": "rubrichash",
                "latency_ms": 10,
            },
        )()


class _LongSeedProvider(_FakeProvider):
    def generate_variant(self, prompt: str):
        self.variant_calls += 1
        return type(
            "Output",
            (),
            {
                "content": (
                    "Investigate discrepancies across source systems and reporting layers with careful "
                    "triage, reproducibility, ownership mapping, escalation planning, confidence framing, "
                    "risk communication, and executive-ready narrative sequencing."
                ),
                "model": "gpt-5.3-codex",
                "provider": "litellm",
                "prompt_hash": "seedhash",
                "latency_ms": 12,
            },
        )()


def test_live_generation_uses_single_variant_seed_call(monkeypatch):
    provider = _FakeProvider()
    monkeypatch.setattr("app.services.generation.get_codesign_provider", lambda **_: provider)

    case = CaseSpec(
        tenant_id="tenant_a",
        title="Live Demo Case",
        scenario="Diagnose a discrepancy between source data and dashboard totals.",
        artifacts=[{"type": "csv", "name": "orders.csv"}],
        metrics=[],
        allowed_tools=["sql_workspace", "python_workspace", "dashboard_workspace"],
    )

    result = generate_from_case(case, variant_count=12)

    assert provider.variant_calls == 1
    assert provider.rubric_calls == 0
    assert len(result.task_family.variants) == 12
    assert result.task_family.variants[0].prompt.startswith("Variant 1:")
    assert result.task_family.variants[0].skill is not None


def test_live_generation_keeps_diversity_with_long_seed_output(monkeypatch):
    provider = _LongSeedProvider()
    monkeypatch.setattr("app.services.generation.get_codesign_provider", lambda **_: provider)

    case = CaseSpec(
        tenant_id="tenant_a",
        title="Live Demo Case",
        scenario="Diagnose a discrepancy between source data and dashboard totals.",
        artifacts=[{"type": "csv", "name": "orders.csv"}],
        metrics=[],
        allowed_tools=["sql_workspace", "python_workspace", "dashboard_workspace"],
    )

    result = generate_from_case(case, variant_count=12)

    assert provider.variant_calls == 1
    assert len(result.task_family.variants) == 12
