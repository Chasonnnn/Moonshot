from pathlib import Path


def test_makefile_contains_hybrid_local_targets():
    path = Path("/Users/chason/Moonshot/Makefile")
    content = path.read_text(encoding="utf-8")

    for target in (
        "db-up:",
        "db-down:",
        "db-reset:",
        "migrate:",
        "migrate-check-postgres:",
        "api-run:",
        "worker-run:",
        "dev-stack:",
        "frontend-smoke:",
    ):
        assert target in content

    assert "docker compose up -d postgres" in content
    assert "docker compose down" in content
    assert "start_api.sh" in content
    assert "start_worker.sh" in content
    assert "staging_smoke.py" in content


def test_api_env_example_has_required_local_keys():
    path = Path("/Users/chason/Moonshot/apps/api/.env.example")
    assert path.exists()
    content = path.read_text(encoding="utf-8")

    for key in (
        "MOONSHOT_DATABASE_URL=",
        "MOONSHOT_BOOTSTRAP_TOKEN=",
        "MOONSHOT_JWT_SIGNING_KEYS=",
        "MOONSHOT_MODEL_PROVIDER=",
        "MOONSHOT_GEMINI_API_KEY=",
    ):
        assert key in content


def test_runtime_env_validation_script_enforces_required_keys():
    path = Path("/Users/chason/Moonshot/apps/api/scripts/validate_runtime_env.py")
    assert path.exists()
    content = path.read_text(encoding="utf-8")
    assert "MOONSHOT_DATABASE_URL" in content
    assert "MOONSHOT_BOOTSTRAP_TOKEN" in content
    assert "MOONSHOT_JWT_SIGNING_KEYS" in content
    assert "MOONSHOT_MODEL_PROVIDER" in content
    assert "MOONSHOT_GEMINI_API_KEY" in content
