.PHONY: test run dump-openapi

test:
	uv run --extra dev pytest

run:
	uv run uvicorn app.main:app --app-dir apps/api --reload

dump-openapi:
	uv run python apps/api/scripts/dump_openapi.py
