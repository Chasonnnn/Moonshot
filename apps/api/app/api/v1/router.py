from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin_policies,
    audit,
    auth,
    business_context,
    cases,
    coach,
    context_traces,
    deliverables,
    exports,
    fairness,
    jobs,
    meta,
    redteam,
    review_queue,
    reports,
    scoring,
    slo,
    simulator_runtime,
    sessions,
    task_families,
    workers,
)

api_router = APIRouter()
api_router.include_router(meta.router)
api_router.include_router(auth.router)
api_router.include_router(jobs.router)
api_router.include_router(admin_policies.router)
api_router.include_router(business_context.router)
api_router.include_router(cases.router)
api_router.include_router(task_families.router)
api_router.include_router(sessions.router)
api_router.include_router(simulator_runtime.router)
api_router.include_router(deliverables.router)
api_router.include_router(coach.router)
api_router.include_router(scoring.router)
api_router.include_router(reports.router)
api_router.include_router(exports.router)
api_router.include_router(redteam.router)
api_router.include_router(review_queue.router)
api_router.include_router(slo.router)
api_router.include_router(audit.router)
api_router.include_router(context_traces.router)
api_router.include_router(fairness.router)
api_router.include_router(workers.router)
