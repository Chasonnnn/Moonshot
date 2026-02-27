from __future__ import annotations

from app.repositories.sqlalchemy_repositories import (
    SQLAlchemyBusinessContextRepository,
    SQLAlchemyCaseRepository,
    SQLAlchemyGovernanceRepository,
    SQLAlchemyReviewQueueRepository,
    SQLAlchemyScoringRepository,
    SQLAlchemySessionRepository,
)
from app.services.store import store

business_context_repository = SQLAlchemyBusinessContextRepository(store)
case_repository = SQLAlchemyCaseRepository(store)
session_repository = SQLAlchemySessionRepository(store)
scoring_repository = SQLAlchemyScoringRepository(store)
review_queue_repository = SQLAlchemyReviewQueueRepository(store)
governance_repository = SQLAlchemyGovernanceRepository(store)
