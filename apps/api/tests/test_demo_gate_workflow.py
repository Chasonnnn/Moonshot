from pathlib import Path


def test_makefile_has_demo_gate_target():
    makefile = Path("/Users/chason/Moonshot/Makefile").read_text(encoding="utf-8")
    assert "demo-gate" in makefile
    assert "staging_smoke.py" in makefile
    assert "load_pilot.py" in makefile
    assert "check_openapi_sync.py" in makefile
    assert "check_frontend_contract_sync.py" in makefile
    assert "check_api_examples.py" in makefile
    assert "check_export_schema.py" in makefile
