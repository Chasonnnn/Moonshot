from __future__ import annotations

from typing import Any, Iterable
from uuid import UUID

from app.repositories.contracts import (
    BusinessContextRepository,
    CaseRepository,
    GovernanceRepository,
    ReviewQueueRepository,
    ScoringRepository,
    SessionRepository,
)
from app.repositories.sql_store import SQLStore
from app.schemas import BusinessContextPack, CaseSpec, Report, ReviewQueueItem, ScoreResult, Session, TaskFamily
from app.schemas.contracts import EventItem, Rubric


class SQLAlchemyCaseRepository(CaseRepository):
    def __init__(self, store: SQLStore) -> None:
        self._store = store

    def save_case(self, case: CaseSpec) -> CaseSpec:
        self._store.cases[case.id] = case.model_dump(mode="json")
        return case

    def get_case(self, case_id: UUID) -> CaseSpec | None:
        payload = self._store.cases.get(case_id)
        if payload is None:
            return None
        return CaseSpec.model_validate(payload)

    def list_cases(self, tenant_id: str) -> list[CaseSpec]:
        return [
            CaseSpec.model_validate(payload)
            for payload in self._store.cases.values()
            if payload["tenant_id"] == tenant_id
        ]

    def save_task_family(self, task_family: TaskFamily) -> TaskFamily:
        self._store.task_families[task_family.id] = task_family.model_dump(mode="json")
        return task_family

    def get_task_family(self, task_family_id: UUID) -> TaskFamily | None:
        payload = self._store.task_families.get(task_family_id)
        if payload is None:
            return None
        return TaskFamily.model_validate(payload)

    def list_task_families(self, tenant_id: str) -> list[TaskFamily]:
        items: list[TaskFamily] = []
        for payload in self._store.task_families.values():
            case_payload = self._store.cases.get(UUID(payload["case_id"]))
            if case_payload is None:
                continue
            if case_payload["tenant_id"] != tenant_id:
                continue
            items.append(TaskFamily.model_validate(payload))
        return items

    def save_rubric(self, rubric: Rubric) -> Rubric:
        self._store.rubrics[rubric.id] = rubric.model_dump(mode="json")
        return rubric

    def get_rubric(self, rubric_id: UUID) -> Rubric | None:
        payload = self._store.rubrics.get(rubric_id)
        if payload is None:
            return None
        return Rubric.model_validate(payload)

    def tenant_for_task_family(self, task_family_id: UUID) -> str | None:
        case = self.case_for_task_family(task_family_id)
        if case is None:
            return None
        return case.tenant_id

    def case_for_task_family(self, task_family_id: UUID) -> CaseSpec | None:
        task_family_payload = self._store.task_families.get(task_family_id)
        if task_family_payload is None:
            return None
        case_payload = self._store.cases.get(UUID(task_family_payload["case_id"]))
        if case_payload is None:
            return None
        return CaseSpec.model_validate(case_payload)


class SQLAlchemySessionRepository(SessionRepository):
    def __init__(self, store: SQLStore) -> None:
        self._store = store

    def save_session(self, session: Session) -> Session:
        self._store.sessions[session.id] = session.model_dump(mode="json")
        return session

    def get_session(self, session_id: UUID) -> Session | None:
        payload = self._store.sessions.get(session_id)
        if payload is None:
            return None
        return Session.model_validate(payload)

    def list_sessions(self, tenant_id: str) -> list[Session]:
        return [
            Session.model_validate(payload)
            for payload in self._store.sessions.values()
            if payload["tenant_id"] == tenant_id
        ]

    def append_events(self, session_id: UUID, events: Iterable[EventItem | dict[str, Any]]) -> int:
        count = 0
        for event in events:
            payload = event.model_dump(mode="json") if isinstance(event, EventItem) else event
            self._store.session_events[session_id].append(payload)
            count += 1
        return count

    def list_events(self, session_id: UUID) -> list[dict[str, Any]]:
        return self._store.session_events.get(session_id, [])


class SQLAlchemyScoringRepository(ScoringRepository):
    def __init__(self, store: SQLStore) -> None:
        self._store = store

    def save_score(self, score: ScoreResult) -> ScoreResult:
        self._store.scores[score.session_id] = score.model_dump(mode="json")
        return score

    def get_score(self, session_id: UUID) -> ScoreResult | None:
        payload = self._store.scores.get(session_id)
        if payload is None:
            return None
        return ScoreResult.model_validate(payload)

    def save_report(self, report: Report) -> Report:
        self._store.reports[report.session_id] = report.model_dump(mode="json")
        return report

    def get_report(self, session_id: UUID) -> Report | None:
        payload = self._store.reports.get(session_id)
        if payload is None:
            return None
        return Report.model_validate(payload)

    def save_review_item(self, item: ReviewQueueItem) -> ReviewQueueItem:
        self._store.review_queue[item.session_id] = item.model_dump(mode="json")
        return item

    def get_review_item(self, session_id: UUID) -> ReviewQueueItem | None:
        payload = self._store.review_queue.get(session_id)
        if payload is None:
            return None
        return ReviewQueueItem.model_validate(payload)

    def save_export_run(self, run_id: UUID, session_id: UUID) -> dict[str, str]:
        payload = {"session_id": str(session_id)}
        self._store.exports[run_id] = payload
        return payload

    def get_export_run(self, run_id: UUID) -> dict[str, str] | None:
        payload = self._store.exports.get(run_id)
        if payload is None:
            return None
        return {"session_id": str(payload["session_id"])}


class SQLAlchemyBusinessContextRepository(BusinessContextRepository):
    def __init__(self, store: SQLStore) -> None:
        self._store = store

    def save_pack(self, pack: BusinessContextPack) -> BusinessContextPack:
        self._store.business_context_packs[pack.id] = pack.model_dump(mode="json")
        return pack

    def get_pack(self, pack_id: UUID) -> BusinessContextPack | None:
        payload = self._store.business_context_packs.get(pack_id)
        if payload is None:
            return None
        return BusinessContextPack.model_validate(payload)

    def list_packs(self, tenant_id: str) -> list[BusinessContextPack]:
        return [
            BusinessContextPack.model_validate(payload)
            for payload in self._store.business_context_packs.values()
            if payload["tenant_id"] == tenant_id
        ]


class SQLAlchemyReviewQueueRepository(ReviewQueueRepository):
    def __init__(self, store: SQLStore) -> None:
        self._store = store

    def save_item(self, item: ReviewQueueItem) -> ReviewQueueItem:
        self._store.review_queue[item.session_id] = item.model_dump(mode="json")
        return item

    def get_item(self, session_id: UUID) -> ReviewQueueItem | None:
        payload = self._store.review_queue.get(session_id)
        if payload is None:
            return None
        return ReviewQueueItem.model_validate(payload)

    def list_items(self, tenant_id: str, include_resolved: bool = False) -> list[ReviewQueueItem]:
        items: list[ReviewQueueItem] = []
        for payload in self._store.review_queue.values():
            if payload["tenant_id"] != tenant_id:
                continue
            if not include_resolved and payload["status"] != "open":
                continue
            items.append(ReviewQueueItem.model_validate(payload))
        return items


class SQLAlchemyGovernanceRepository(GovernanceRepository):
    def __init__(self, store: SQLStore) -> None:
        self._store = store

    def append_audit_log(self, payload: dict[str, Any]) -> None:
        self._store.audit_logs.append(payload)
