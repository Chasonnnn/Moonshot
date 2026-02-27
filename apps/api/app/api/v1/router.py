from fastapi import APIRouter

from app.api.v1.endpoints import (
    audit,
    business_context,
    cases,
    coach,
    exports,
    meta,
    redteam,
    review_queue,
    reports,
    scoring,
    sessions,
    task_families,
)

api_router = APIRouter()
api_router.include_router(meta.router)
api_router.include_router(business_context.router)
api_router.include_router(cases.router)
api_router.include_router(task_families.router)
api_router.include_router(sessions.router)
api_router.include_router(coach.router)
api_router.include_router(scoring.router)
api_router.include_router(reports.router)
api_router.include_router(exports.router)
api_router.include_router(redteam.router)
api_router.include_router(review_queue.router)
api_router.include_router(audit.router)
