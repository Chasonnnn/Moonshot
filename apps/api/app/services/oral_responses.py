from __future__ import annotations

import base64
import io
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID, uuid4

from openai import OpenAI

from app.core.config import get_settings
from app.schemas import OralResponse, Session
from app.services.repositories import case_repository
from app.services.store import store


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class OralDefenseRequirement:
    required: bool
    required_clip_types: tuple[str, ...]
    weight: float


DEFAULT_ORAL_CLIP_TYPES = ("presentation", "follow_up_1", "follow_up_2")
ORAL_REQUIREMENTS_BY_TEMPLATE: dict[str, OralDefenseRequirement] = {
    "tpl_data_analyst": OralDefenseRequirement(required=True, required_clip_types=DEFAULT_ORAL_CLIP_TYPES, weight=0.15),
    "tpl_jda_quality": OralDefenseRequirement(required=True, required_clip_types=DEFAULT_ORAL_CLIP_TYPES, weight=0.2),
    "tpl_jda_ambiguity": OralDefenseRequirement(required=True, required_clip_types=DEFAULT_ORAL_CLIP_TYPES, weight=0.2),
    "tpl_revops_forecast_variance": OralDefenseRequirement(required=True, required_clip_types=DEFAULT_ORAL_CLIP_TYPES, weight=0.15),
}
FIXTURE_ORAL_TRANSCRIPTS_BY_TEMPLATE: dict[str, dict[str, str]] = {
    "tpl_data_analyst": {
        "presentation": (
            "The drop is concentrated in paid social sign-up to activation, while the rest of the funnel is stable. "
            "I would pause the recent targeting expansion, escalate to acquisition as a P2, and validate campaign-level quality before treating this as product regression."
        ),
        "follow_up_1": (
            "The strongest evidence is the channel split: paid social fell sharply while organic and email remained broadly steady, so the issue is not platform-wide."
        ),
        "follow_up_2": (
            "Before scaling the recommendation, I would validate campaign-level audience drift, attribution integrity, and whether the signal persists for another week."
        ),
    },
    "tpl_jda_quality": {
        "presentation": (
            "The discrepancy is primarily duplicate records introduced in the ETL merge stage. "
            "I would escalate this as a P2 because the issue is reproducible, visible in downstream dashboards, and already tied to a clear owner."
        ),
        "follow_up_1": (
            "I separated the ETL defect from the open policy question by confirming duplicate inflation independently and keeping null-customer handling as unresolved."
        ),
        "follow_up_2": (
            "The next owner is the data platform lead, and I would raise severity only if revenue-facing aggregates or external reporting were also compromised."
        ),
    },
    "tpl_jda_ambiguity": {
        "presentation": (
            "My default scope is a bounded Q4 KPI summary with explicit assumptions, because it moves the work forward without pretending the request is fully specified."
        ),
        "follow_up_1": (
            "The riskiest assumption is the KPI set itself, so I made that assumption visible and easy for the stakeholder to correct quickly."
        ),
        "follow_up_2": (
            "I would escalate immediately if the request turns into channel-level attribution or board-facing reporting, because that materially changes the delivery risk."
        ),
    },
    "tpl_revops_forecast_variance": {
        "presentation": (
            "The miss is mostly an execution problem in mid-market stage-two conversion, with a smaller deal-size slip. "
            "I would tighten stage inspection, keep the forecast model constant for now, and only revisit quota after checking recovery."
        ),
        "follow_up_1": (
            "I believe it is more execution variance than forecast-model failure because coverage stayed healthy while stage-two conversion deteriorated materially."
        ),
        "follow_up_2": (
            "My confidence would increase if conversion recovers against the monitoring threshold and the next-quarter bridge no longer shows the same stage-two weakness."
        ),
    },
}


def resolve_template_id_for_session(session: Session) -> str | None:
    if isinstance(session.policy, dict):
        policy_template_id = session.policy.get("demo_template_id")
        if isinstance(policy_template_id, str) and policy_template_id.strip():
            return policy_template_id.strip()

    task_family = case_repository.get_task_family(session.task_family_id)
    if task_family is None:
        return None
    diagnostics = task_family.generation_diagnostics if isinstance(task_family.generation_diagnostics, dict) else {}
    template_id = diagnostics.get("template_id")
    return template_id.strip() if isinstance(template_id, str) and template_id.strip() else None


def get_oral_defense_requirement(session: Session) -> OralDefenseRequirement:
    policy = session.policy if isinstance(session.policy, dict) else {}
    required_flag = policy.get("oral_defense_required")
    clip_types_raw = policy.get("oral_required_clip_types")
    if isinstance(required_flag, bool):
        required = required_flag
        clip_types = tuple(
            str(item).strip()
            for item in (clip_types_raw or [])
            if str(item).strip()
        ) or DEFAULT_ORAL_CLIP_TYPES
        weight_raw = policy.get("oral_weight")
        try:
            weight = float(weight_raw) if weight_raw is not None else 0.15
        except (TypeError, ValueError):
            weight = 0.15
        return OralDefenseRequirement(required=required, required_clip_types=clip_types, weight=weight if required else 0.0)

    template_id = resolve_template_id_for_session(session)
    if template_id is None:
        return OralDefenseRequirement(required=False, required_clip_types=(), weight=0.0)
    return ORAL_REQUIREMENTS_BY_TEMPLATE.get(
        template_id,
        OralDefenseRequirement(required=False, required_clip_types=(), weight=0.0),
    )


def session_allows_fixture_oral_seed(session: Session) -> bool:
    policy = session.policy if isinstance(session.policy, dict) else {}
    demo_mode = str(policy.get("demo_mode", "")).strip().lower()
    if demo_mode != "fixture":
        task_family = case_repository.get_task_family(session.task_family_id)
        diagnostics = task_family.generation_diagnostics if task_family and isinstance(task_family.generation_diagnostics, dict) else {}
        demo_mode = str(diagnostics.get("mode", "")).strip().lower()
        if demo_mode != "fixture":
            return False
    return get_oral_defense_requirement(session).required


def build_oral_transcription_prompt(*, session: Session, clip_type: str, question_id: str | None) -> str:
    template_id = resolve_template_id_for_session(session) or "generic_analytics"
    prompt_parts = [
        "This transcript is from a candidate oral defense for a work simulation.",
        f"Template: {template_id}.",
        f"Clip type: {clip_type}.",
    ]
    if question_id:
        prompt_parts.append(f"Question id: {question_id}.")
    prompt_parts.append("Preserve business terms, KPI names, SQL/tool references, and filler-free sentence boundaries.")
    return " ".join(prompt_parts)


def _normalize_requirement_key(clip_type: str, question_id: str | None) -> str:
    normalized_clip = clip_type.strip().lower()
    if normalized_clip == "presentation":
        return "presentation"
    if normalized_clip in {"follow_up_1", "follow_up_2"}:
        return normalized_clip
    if normalized_clip == "follow_up":
        normalized_question = (question_id or "").strip().lower()
        if normalized_question in {"follow_up_1", "q-1", "q1", "1"}:
            return "follow_up_1"
        if normalized_question in {"follow_up_2", "q-2", "q2", "2"}:
            return "follow_up_2"
        return "follow_up"
    return normalized_clip


def transcribe_oral_response(
    file_bytes: bytes,
    filename: str,
    content_type: str,
    *,
    prompt: str | None,
    language: str | None = "en",
) -> dict[str, str | None]:
    settings = get_settings()
    api_key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("openai_audio_api_key_missing")

    client = OpenAI(api_key=api_key)
    audio_file = io.BytesIO(file_bytes)
    audio_file.name = filename
    response = client.audio.transcriptions.create(
        model=settings.openai_transcription_model,
        file=audio_file,
        response_format="json",
        prompt=prompt or None,
        language=language or None,
    )

    transcript_text = getattr(response, "text", None)
    if not transcript_text and isinstance(response, dict):
        transcript_text = response.get("text")
    if not isinstance(transcript_text, str) or not transcript_text.strip():
        raise RuntimeError("openai_audio_empty_transcript")

    request_id = getattr(response, "_request_id", None)
    return {
        "transcript_text": transcript_text.strip(),
        "transcription_model": settings.openai_transcription_model,
        "request_id": str(request_id) if request_id else None,
    }


def create_oral_response(
    *,
    session_id: UUID,
    clip_type: str,
    question_id: str | None,
    duration_ms: int,
    mime_type: str,
    transcript_text: str,
    transcription_model: str,
    request_id: str | None,
    audio_retained: bool,
    audio_bytes: bytes | None,
) -> OralResponse:
    now = _utc_now()
    response = OralResponse(
        id=uuid4(),
        session_id=session_id,
        question_id=question_id,
        clip_type=clip_type,
        duration_ms=duration_ms,
        mime_type=mime_type,
        status="transcribed",
        transcript_text=transcript_text,
        transcription_model=transcription_model,
        request_id=request_id,
        audio_retained=audio_retained,
        created_at=now,
        updated_at=now,
    )
    row = response.model_dump(mode="json")
    row["audio_blob_b64"] = base64.b64encode(audio_bytes).decode("ascii") if audio_retained and audio_bytes else None
    store.session_oral_responses[response.id] = row
    return response


def list_oral_responses(session_id: UUID) -> list[OralResponse]:
    items: list[OralResponse] = []
    for payload in store.session_oral_responses.values():
        if payload.get("session_id") == str(session_id):
            filtered = {key: value for key, value in payload.items() if key != "audio_blob_b64"}
            items.append(OralResponse.model_validate(filtered))
    items.sort(key=lambda item: item.created_at)
    return items


def _build_transcript_bundle(responses: list[OralResponse]) -> str:
    sections: list[str] = []
    for response in responses:
        header = f"[{response.clip_type}]"
        if response.question_id:
            header = f"{header} question={response.question_id}"
        sections.append(f"{header}\n{response.transcript_text.strip()}")
    return "\n\n".join(section for section in sections if section.strip())


def build_oral_objective_metrics(
    responses: list[OralResponse],
    *,
    required_clip_types: list[str],
) -> dict[str, int]:
    completed = [response for response in responses if response.status == "transcribed"]
    return {
        "oral_clip_count": len(responses),
        "oral_completed_clip_count": len(completed),
        "oral_transcription_success_count": len(completed),
        "oral_required_clip_count": len(required_clip_types),
        "oral_total_duration_ms": sum(max(0, int(response.duration_ms)) for response in completed),
        "oral_transcription_failures": sum(1 for response in responses if response.status != "transcribed"),
    }


def oral_requirements_error(session: Session) -> str | None:
    requirement = get_oral_defense_requirement(session)
    if not requirement.required:
        return None

    fulfilled = {
        _normalize_requirement_key(item.clip_type, item.question_id): item
        for item in list_oral_responses(session.id)
        if item.status == "transcribed"
    }
    missing = [clip for clip in requirement.required_clip_types if clip not in fulfilled]
    if not missing:
        return None
    return f"oral_response_missing: missing required oral clips: {', '.join(missing)}"


def seed_fixture_oral_responses(session: Session) -> list[OralResponse]:
    if not session_allows_fixture_oral_seed(session):
        return []

    requirement = get_oral_defense_requirement(session)
    template_id = resolve_template_id_for_session(session)
    if template_id is None:
        return []

    transcript_map = FIXTURE_ORAL_TRANSCRIPTS_BY_TEMPLATE.get(template_id, {})
    existing = {
        _normalize_requirement_key(item.clip_type, item.question_id): item
        for item in list_oral_responses(session.id)
        if item.status == "transcribed"
    }
    created: list[OralResponse] = []

    for clip_type in requirement.required_clip_types:
        if clip_type in existing:
            continue
        transcript_text = transcript_map.get(clip_type)
        if not transcript_text:
            if clip_type == "presentation" and isinstance(session.final_response, str) and session.final_response.strip():
                transcript_text = session.final_response.strip()
            else:
                transcript_text = f"Fixture oral defense response for {template_id} ({clip_type})."
        created.append(
            create_oral_response(
                session_id=session.id,
                clip_type=clip_type,
                question_id=f"fixture_{clip_type}",
                duration_ms=180000 if clip_type == "presentation" else 60000,
                mime_type="audio/webm",
                transcript_text=transcript_text,
                transcription_model="fixture:oral-defense",
                request_id=f"fixture-{template_id}-{clip_type}",
                audio_retained=False,
                audio_bytes=None,
            )
        )
    return created


def build_oral_transcript_bundle(session_id: UUID) -> str:
    responses = list_oral_responses(session_id)
    if not responses:
        return ""
    return _build_transcript_bundle(responses)


def oral_metrics(session_id: UUID) -> dict[str, int]:
    responses = list_oral_responses(session_id)
    session_payload = store.sessions.get(session_id)
    required_clip_types = []
    if session_payload is not None:
        requirement = get_oral_defense_requirement(Session.model_validate(session_payload))
        required_clip_types = list(requirement.required_clip_types)
    return build_oral_objective_metrics(responses, required_clip_types=required_clip_types)
