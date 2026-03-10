from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.deps import require_roles
from app.api.v1.endpoints.simulator_runtime import _get_session_for_access
from app.core.security import UserContext
from app.schemas import OralResponse, OralResponseListResponse
from app.services.audit import audit
from app.services import oral_responses as oral_response_service
from app.services.repositories import session_repository

router = APIRouter(prefix="/v1/sessions", tags=["oral-responses"])


@router.post("/{session_id}/oral-responses", response_model=OralResponse, status_code=status.HTTP_201_CREATED)
async def upload_oral_response(
    session_id: UUID,
    clip_type: str = Form(...),
    duration_ms: int = Form(...),
    question_id: str | None = Form(default=None),
    file: UploadFile = File(...),
    user: UserContext = Depends(require_roles("candidate")),
) -> OralResponse:
    session_payload = _get_session_for_access(session_id, user, allow_reviewer=False)
    session = session_repository.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not clip_type.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="clip_type is required")
    if duration_ms <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="duration_ms must be > 0")

    filename = file.filename or "oral-response.webm"
    mime_type = file.content_type or "application/octet-stream"
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Audio file cannot be empty")

    session_policy = session_payload.get("policy", {}) if isinstance(session_payload, dict) else {}
    audio_retained = bool(session_policy.get("raw_content_opt_in", False))
    normalized_question_id = question_id.strip() if isinstance(question_id, str) and question_id.strip() else None

    try:
        transcription = oral_response_service.transcribe_oral_response(
            file_bytes,
            filename,
            mime_type,
            prompt=oral_response_service.build_oral_transcription_prompt(
                session=session,
                clip_type=clip_type.strip(),
                question_id=normalized_question_id,
            ),
        )
    except Exception as error:
        detail = str(error) if isinstance(error, Exception) and str(error) else "oral_transcription_failed"
        session_repository.append_events(
            session_id,
            [
                {
                    "event_type": "oral_response_transcription_failed",
                    "payload": {
                        "clip_type": clip_type.strip(),
                        "question_id": normalized_question_id,
                        "error_detail": detail,
                    },
                }
            ],
        )
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail) from error

    oral_response = oral_response_service.create_oral_response(
        session_id=session_id,
        clip_type=clip_type.strip(),
        question_id=normalized_question_id,
        duration_ms=duration_ms,
        mime_type=mime_type,
        transcript_text=str(transcription["transcript_text"]),
        transcription_model=str(transcription["transcription_model"]),
        request_id=str(transcription["request_id"]) if transcription["request_id"] else None,
        audio_retained=audio_retained,
        audio_bytes=file_bytes if audio_retained else None,
    )

    session_repository.append_events(
        session_id,
        [
            {
                "event_type": "oral_response_uploaded",
                "payload": {
                    "oral_response_id": str(oral_response.id),
                    "clip_type": oral_response.clip_type,
                    "question_id": oral_response.question_id,
                    "duration_ms": oral_response.duration_ms,
                },
            },
            {
                "event_type": "oral_response_transcribed",
                "payload": {
                    "oral_response_id": str(oral_response.id),
                    "clip_type": oral_response.clip_type,
                    "question_id": oral_response.question_id,
                    "transcription_model": oral_response.transcription_model,
                    "request_id": oral_response.request_id,
                },
            },
        ],
    )
    audit(
        user,
        "create_oral_response",
        "session",
        str(session_id),
        {
            "oral_response_id": str(oral_response.id),
            "clip_type": oral_response.clip_type,
            "question_id": oral_response.question_id,
            "audio_retained": oral_response.audio_retained,
        },
    )
    return oral_response


@router.get("/{session_id}/oral-responses", response_model=OralResponseListResponse)
def get_oral_responses(
    session_id: UUID,
    user: UserContext = Depends(require_roles("candidate", "reviewer", "org_admin")),
) -> OralResponseListResponse:
    _get_session_for_access(session_id, user)
    return OralResponseListResponse(items=oral_response_service.list_oral_responses(session_id))
