from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas import MetaVersion

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/v1/meta/version", response_model=MetaVersion)
def meta_version() -> MetaVersion:
    settings = get_settings()
    return MetaVersion(api_version=settings.api_version, schema_version=settings.schema_version)
