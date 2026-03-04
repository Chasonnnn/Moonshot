from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.providers.model_catalog import get_model_options_snapshot
from app.schemas import MetaVersion, ModelOptionsResponse

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/v1/meta/version", response_model=MetaVersion)
def meta_version() -> MetaVersion:
    settings = get_settings()
    return MetaVersion(api_version=settings.api_version, schema_version=settings.schema_version)


@router.get("/v1/meta/model-options", response_model=ModelOptionsResponse)
def model_options() -> ModelOptionsResponse:
    try:
        return get_model_options_snapshot()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
