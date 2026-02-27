from __future__ import annotations

from collections.abc import Iterator
from copy import deepcopy
from datetime import datetime, timezone
from threading import Lock
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import delete, select
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql.sqltypes import DateTime as SADateTime

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.entities import (
    AdminPolicyModel,
    AuditLogModel,
    BusinessContextPackModel,
    CaseSpecModel,
    DashboardStateModel,
    EventLogModel,
    ExportRunModel,
    IdempotencyCacheModel,
    RedTeamRunModel,
    ReportModel,
    ReviewQueueModel,
    RubricModel,
    ScoreResultModel,
    SessionModel,
    SessionSQLHistoryModel,
    TaskFamilyModel,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_storage_key(key: Any) -> str:
    return str(key)


def _to_public_key(key: Any, *, uuid_keys: bool) -> Any:
    if not uuid_keys:
        return key
    return UUID(str(key))


def _to_db_value(column, value: Any) -> Any:
    if value is None:
        return None
    if isinstance(column.type, SADateTime):
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            return datetime.fromisoformat(value)
    if isinstance(value, UUID):
        return str(value)
    return value


def _to_payload_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


class SQLRowMap:
    def __init__(
        self,
        *,
        session_factory: sessionmaker,
        model_cls: type[Base],
        key_attr: str = "id",
        uuid_keys: bool = True,
    ) -> None:
        self._session_factory = session_factory
        self._model_cls = model_cls
        self._key_attr = key_attr
        self._uuid_keys = uuid_keys
        self._mapper = inspect(model_cls)

    def _serialize_row(self, row: Base) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        for attr in self._mapper.column_attrs:
            column = attr.columns[0]
            payload[column.name] = _to_payload_value(getattr(row, attr.key))
        return payload

    def _values_for_write(self, key: Any, payload: dict[str, Any]) -> dict[str, Any]:
        values: dict[str, Any] = {}
        for attr in self._mapper.column_attrs:
            column = attr.columns[0]
            column_name = column.name
            attr_name = attr.key

            if attr_name == self._key_attr:
                raw_value = _to_storage_key(key)
            elif column_name in payload:
                raw_value = payload[column_name]
            elif attr_name in payload:
                raw_value = payload[attr_name]
            else:
                continue

            values[attr_name] = _to_db_value(column, raw_value)
        return values

    def _select_one(self, db, key: Any):
        model_key_attr = getattr(self._model_cls, self._key_attr)
        return db.execute(
            select(self._model_cls).where(model_key_attr == _to_storage_key(key))
        ).scalar_one_or_none()

    def get(self, key: Any, default: Any | None = None) -> dict[str, Any] | Any:
        with self._session_factory() as db:
            row = self._select_one(db, key)
            if row is None:
                return default
            return self._serialize_row(row)

    def __getitem__(self, key: Any) -> dict[str, Any]:
        row = self.get(key)
        if row is None:
            raise KeyError(key)
        return row

    def __setitem__(self, key: Any, payload: dict[str, Any]) -> None:
        with self._session_factory() as db:
            row = self._select_one(db, key)
            values = self._values_for_write(key, payload)
            if row is None:
                db.add(self._model_cls(**values))
            else:
                for attr_name, value in values.items():
                    setattr(row, attr_name, value)
            db.commit()

    def values(self) -> list[dict[str, Any]]:
        with self._session_factory() as db:
            rows = db.execute(select(self._model_cls)).scalars().all()
            return [self._serialize_row(row) for row in rows]

    def items(self) -> list[tuple[Any, dict[str, Any]]]:
        with self._session_factory() as db:
            rows = db.execute(select(self._model_cls)).scalars().all()
            items: list[tuple[Any, dict[str, Any]]] = []
            for row in rows:
                key = _to_public_key(getattr(row, self._key_attr), uuid_keys=self._uuid_keys)
                items.append((key, self._serialize_row(row)))
            return items

    def __iter__(self) -> Iterator[Any]:
        key_attr = getattr(self._model_cls, self._key_attr)
        with self._session_factory() as db:
            keys = db.execute(select(key_attr)).scalars().all()
            for key in keys:
                yield _to_public_key(key, uuid_keys=self._uuid_keys)

    def clear(self) -> None:
        with self._session_factory() as db:
            db.execute(delete(self._model_cls))
            db.commit()


class SQLPayloadMap:
    def __init__(
        self,
        *,
        session_factory: sessionmaker,
        model_cls: type[Base],
        key_attr: str,
        payload_attr: str,
        uuid_keys: bool,
    ) -> None:
        self._session_factory = session_factory
        self._model_cls = model_cls
        self._key_attr = key_attr
        self._payload_attr = payload_attr
        self._uuid_keys = uuid_keys

    def _select_one(self, db, key: Any):
        model_key_attr = getattr(self._model_cls, self._key_attr)
        return db.execute(
            select(self._model_cls).where(model_key_attr == _to_storage_key(key))
        ).scalar_one_or_none()

    def get(self, key: Any, default: Any | None = None) -> dict[str, Any] | Any:
        with self._session_factory() as db:
            row = self._select_one(db, key)
            if row is None:
                return default
            return deepcopy(getattr(row, self._payload_attr))

    def __getitem__(self, key: Any) -> dict[str, Any]:
        value = self.get(key)
        if value is None:
            raise KeyError(key)
        return value

    def __setitem__(self, key: Any, payload: dict[str, Any]) -> None:
        now = _now()
        with self._session_factory() as db:
            row = self._select_one(db, key)
            if row is None:
                fields = {
                    self._key_attr: _to_storage_key(key),
                    self._payload_attr: deepcopy(payload),
                }
                if hasattr(self._model_cls, "created_at"):
                    fields["created_at"] = now
                if hasattr(self._model_cls, "updated_at"):
                    fields["updated_at"] = now
                db.add(self._model_cls(**fields))
            else:
                setattr(row, self._payload_attr, deepcopy(payload))
                if hasattr(row, "updated_at"):
                    row.updated_at = now
            db.commit()

    def values(self) -> list[dict[str, Any]]:
        with self._session_factory() as db:
            rows = db.execute(select(self._model_cls)).scalars().all()
            return [deepcopy(getattr(row, self._payload_attr)) for row in rows]

    def items(self) -> list[tuple[Any, dict[str, Any]]]:
        with self._session_factory() as db:
            rows = db.execute(select(self._model_cls)).scalars().all()
            return [
                (
                    _to_public_key(getattr(row, self._key_attr), uuid_keys=self._uuid_keys),
                    deepcopy(getattr(row, self._payload_attr)),
                )
                for row in rows
            ]

    def __iter__(self) -> Iterator[Any]:
        key_attr = getattr(self._model_cls, self._key_attr)
        with self._session_factory() as db:
            keys = db.execute(select(key_attr)).scalars().all()
            for key in keys:
                yield _to_public_key(key, uuid_keys=self._uuid_keys)

    def clear(self) -> None:
        with self._session_factory() as db:
            db.execute(delete(self._model_cls))
            db.commit()


class SQLEventListProxy:
    def __init__(self, parent: "SQLEventMap", session_id: Any) -> None:
        self._parent = parent
        self._session_id = session_id

    def append(self, item: dict[str, Any]) -> None:
        self._parent.append(self._session_id, item)

    def __iter__(self) -> Iterator[dict[str, Any]]:
        return iter(self._parent.get(self._session_id, []))


class SQLEventMap:
    def __init__(self, *, session_factory: sessionmaker) -> None:
        self._session_factory = session_factory

    def _fetch(self, session_id: Any) -> list[dict[str, Any]]:
        key = _to_storage_key(session_id)
        with self._session_factory() as db:
            rows = (
                db.execute(
                    select(EventLogModel)
                    .where(EventLogModel.session_id == key)
                    .order_by(EventLogModel.created_at.asc(), EventLogModel.id.asc())
                )
                .scalars()
                .all()
            )
            return [
                {
                    "event_type": row.event_type,
                    "payload": row.payload,
                    "created_at": row.created_at.isoformat(),
                }
                for row in rows
            ]

    def get(self, session_id: Any, default: Any | None = None) -> list[dict[str, Any]] | Any:
        items = self._fetch(session_id)
        if not items:
            return default if default is not None else []
        return items

    def __getitem__(self, session_id: Any) -> SQLEventListProxy:
        return SQLEventListProxy(self, session_id)

    def __setitem__(self, session_id: Any, events: list[dict[str, Any]]) -> None:
        key = _to_storage_key(session_id)
        with self._session_factory() as db:
            db.execute(delete(EventLogModel).where(EventLogModel.session_id == key))
            for event in events:
                created_at = event.get("created_at")
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at)
                if created_at is None:
                    created_at = _now()
                db.add(
                    EventLogModel(
                        id=str(uuid4()),
                        session_id=key,
                        event_type=event["event_type"],
                        payload=event.get("payload", {}),
                        created_at=created_at,
                    )
                )
            db.commit()

    def append(self, session_id: Any, event: dict[str, Any]) -> None:
        key = _to_storage_key(session_id)
        created_at = event.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        if created_at is None:
            created_at = _now()

        with self._session_factory() as db:
            db.add(
                EventLogModel(
                    id=str(uuid4()),
                    session_id=key,
                    event_type=event["event_type"],
                    payload=event.get("payload", {}),
                    created_at=created_at,
                )
            )
            db.commit()

    def clear(self) -> None:
        with self._session_factory() as db:
            db.execute(delete(EventLogModel))
            db.commit()


class SQLHistoryListProxy:
    def __init__(self, parent: "SQLHistoryMap", session_id: Any) -> None:
        self._parent = parent
        self._session_id = session_id

    def append(self, item: dict[str, Any]) -> None:
        self._parent.append(self._session_id, item)

    def __iter__(self) -> Iterator[dict[str, Any]]:
        return iter(self._parent.get(self._session_id, []))


class SQLHistoryMap:
    def __init__(self, *, session_factory: sessionmaker) -> None:
        self._session_factory = session_factory

    def _fetch(self, session_id: Any) -> list[dict[str, Any]]:
        key = _to_storage_key(session_id)
        with self._session_factory() as db:
            rows = (
                db.execute(
                    select(SessionSQLHistoryModel)
                    .where(SessionSQLHistoryModel.session_id == key)
                    .order_by(SessionSQLHistoryModel.created_at.asc(), SessionSQLHistoryModel.id.asc())
                )
                .scalars()
                .all()
            )
            return [deepcopy(row.item) for row in rows]

    def get(self, session_id: Any, default: Any | None = None) -> list[dict[str, Any]] | Any:
        items = self._fetch(session_id)
        if not items:
            return default if default is not None else []
        return items

    def __getitem__(self, session_id: Any) -> SQLHistoryListProxy:
        return SQLHistoryListProxy(self, session_id)

    def __setitem__(self, session_id: Any, items: list[dict[str, Any]]) -> None:
        key = _to_storage_key(session_id)
        with self._session_factory() as db:
            db.execute(delete(SessionSQLHistoryModel).where(SessionSQLHistoryModel.session_id == key))
            for item in items:
                db.add(SessionSQLHistoryModel(session_id=key, item=deepcopy(item), created_at=_now()))
            db.commit()

    def setdefault(self, session_id: Any, default: list[dict[str, Any]]) -> SQLHistoryListProxy:
        if self.get(session_id, None) is None:
            self[session_id] = default
        return SQLHistoryListProxy(self, session_id)

    def append(self, session_id: Any, item: dict[str, Any]) -> None:
        key = _to_storage_key(session_id)
        with self._session_factory() as db:
            db.add(SessionSQLHistoryModel(session_id=key, item=deepcopy(item), created_at=_now()))
            db.commit()

    def clear(self) -> None:
        with self._session_factory() as db:
            db.execute(delete(SessionSQLHistoryModel))
            db.commit()


class SQLDashboardStateMap:
    def __init__(self, *, session_factory: sessionmaker) -> None:
        self._session_factory = session_factory

    def get(self, session_id: Any, default: Any | None = None) -> dict[str, Any] | Any:
        key = _to_storage_key(session_id)
        with self._session_factory() as db:
            row = db.get(DashboardStateModel, key)
            if row is None:
                return default
            return deepcopy(row.state)

    def __getitem__(self, session_id: Any) -> dict[str, Any]:
        state = self.get(session_id)
        if state is None:
            raise KeyError(session_id)
        return state

    def __setitem__(self, session_id: Any, state: dict[str, Any]) -> None:
        key = _to_storage_key(session_id)
        updated_at = state.get("updated_at")
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at)
        if updated_at is None:
            updated_at = _now()

        with self._session_factory() as db:
            row = db.get(DashboardStateModel, key)
            if row is None:
                db.add(DashboardStateModel(session_id=key, state=deepcopy(state), updated_at=updated_at))
            else:
                row.state = deepcopy(state)
                row.updated_at = updated_at
            db.commit()

    def setdefault(self, session_id: Any, default: dict[str, Any]) -> dict[str, Any]:
        existing = self.get(session_id)
        if existing is not None:
            return existing
        self[session_id] = default
        return deepcopy(default)

    def clear(self) -> None:
        with self._session_factory() as db:
            db.execute(delete(DashboardStateModel))
            db.commit()


class SQLAuditLogList:
    def __init__(self, *, session_factory: sessionmaker) -> None:
        self._session_factory = session_factory

    def append(self, payload: dict[str, Any]) -> None:
        created_at = payload.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        if created_at is None:
            created_at = _now()

        with self._session_factory() as db:
            db.add(
                AuditLogModel(
                    id=str(payload.get("id") or uuid4()),
                    tenant_id=payload["tenant_id"],
                    actor_role=payload["actor_role"],
                    action=payload["action"],
                    resource_type=payload["resource_type"],
                    resource_id=payload["resource_id"],
                    metadata_json=deepcopy(payload.get("metadata", {})),
                    created_at=created_at,
                )
            )
            db.commit()

    def __iter__(self) -> Iterator[dict[str, Any]]:
        with self._session_factory() as db:
            rows = (
                db.execute(select(AuditLogModel).order_by(AuditLogModel.created_at.asc(), AuditLogModel.id.asc()))
                .scalars()
                .all()
            )
            for row in rows:
                yield {
                    "id": row.id,
                    "tenant_id": row.tenant_id,
                    "actor_role": row.actor_role,
                    "action": row.action,
                    "resource_type": row.resource_type,
                    "resource_id": row.resource_id,
                    "metadata": deepcopy(row.metadata_json),
                    "created_at": row.created_at.isoformat(),
                }

    def clear(self) -> None:
        with self._session_factory() as db:
            db.execute(delete(AuditLogModel))
            db.commit()


class SQLIdempotencyCache:
    def __init__(self, *, session_factory: sessionmaker) -> None:
        self._session_factory = session_factory

    def get(self, scope: str, key: str) -> dict[str, Any] | None:
        with self._session_factory() as db:
            row = db.get(IdempotencyCacheModel, {"scope": scope, "key": key})
            if row is None:
                return None
            return deepcopy(row.payload)

    def put(self, scope: str, key: str, payload: dict[str, Any]) -> None:
        with self._session_factory() as db:
            row = db.get(IdempotencyCacheModel, {"scope": scope, "key": key})
            if row is None:
                db.add(
                    IdempotencyCacheModel(
                        scope=scope,
                        key=key,
                        payload=deepcopy(payload),
                        created_at=_now(),
                    )
                )
            else:
                row.payload = deepcopy(payload)
                row.created_at = _now()
            db.commit()

    def clear(self) -> None:
        with self._session_factory() as db:
            db.execute(delete(IdempotencyCacheModel))
            db.commit()


class SQLStore:
    def __init__(self, *, session_factory: sessionmaker = SessionLocal) -> None:
        self._lock = Lock()
        self._session_factory = session_factory

        self.business_context_packs = SQLRowMap(
            session_factory=session_factory,
            model_cls=BusinessContextPackModel,
            key_attr="id",
            uuid_keys=True,
        )
        self.cases = SQLRowMap(session_factory=session_factory, model_cls=CaseSpecModel, key_attr="id", uuid_keys=True)
        self.task_families = SQLRowMap(
            session_factory=session_factory,
            model_cls=TaskFamilyModel,
            key_attr="id",
            uuid_keys=True,
        )
        self.rubrics = SQLRowMap(session_factory=session_factory, model_cls=RubricModel, key_attr="id", uuid_keys=True)
        self.sessions = SQLRowMap(session_factory=session_factory, model_cls=SessionModel, key_attr="id", uuid_keys=True)
        self.session_events = SQLEventMap(session_factory=session_factory)
        self.scores = SQLRowMap(
            session_factory=session_factory,
            model_cls=ScoreResultModel,
            key_attr="session_id",
            uuid_keys=True,
        )
        self.reports = SQLPayloadMap(
            session_factory=session_factory,
            model_cls=ReportModel,
            key_attr="session_id",
            payload_attr="payload",
            uuid_keys=True,
        )
        self.exports = SQLRowMap(
            session_factory=session_factory,
            model_cls=ExportRunModel,
            key_attr="run_id",
            uuid_keys=True,
        )
        self.redteam_runs = SQLRowMap(
            session_factory=session_factory,
            model_cls=RedTeamRunModel,
            key_attr="id",
            uuid_keys=True,
        )
        self.review_queue = SQLRowMap(
            session_factory=session_factory,
            model_cls=ReviewQueueModel,
            key_attr="session_id",
            uuid_keys=True,
        )
        self.audit_logs = SQLAuditLogList(session_factory=session_factory)
        self.idempotency_cache = SQLIdempotencyCache(session_factory=session_factory)
        self.admin_policies = SQLRowMap(
            session_factory=session_factory,
            model_cls=AdminPolicyModel,
            key_attr="tenant_id",
            uuid_keys=False,
        )
        self.session_sql_history = SQLHistoryMap(session_factory=session_factory)
        self.dashboard_state = SQLDashboardStateMap(session_factory=session_factory)

    def ensure_schema(self) -> None:
        Base.metadata.create_all(bind=engine)

    def with_lock(self, fn):
        with self._lock:
            return fn()

    def put_idempotent(self, scope: str, key: str, payload: dict[str, Any]) -> None:
        self.idempotency_cache.put(scope, key, payload)

    def get_idempotent(self, scope: str, key: str) -> dict[str, Any] | None:
        return self.idempotency_cache.get(scope, key)
