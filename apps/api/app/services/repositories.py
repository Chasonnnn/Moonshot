from __future__ import annotations

from app.repositories.sqlalchemy_repositories import (
    SQLAlchemyCaseRepository,
    SQLAlchemyScoringRepository,
    SQLAlchemySessionRepository,
)
from app.services.store import store

case_repository = SQLAlchemyCaseRepository(store)
session_repository = SQLAlchemySessionRepository(store)
scoring_repository = SQLAlchemyScoringRepository(store)
