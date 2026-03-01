from pathlib import Path


def test_governance_bundle_script_exists_with_required_artifacts():
    script_path = Path("/Users/chason/Moonshot/apps/api/scripts/build_governance_bundle.py")
    assert script_path.exists()

    content = script_path.read_text(encoding="utf-8")
    assert "governance_bundle.md" in content
    assert "governance_bundle.json" in content
    assert "manifest.json" in content
    assert "sha256" in content


def test_governance_bundle_script_collects_required_evidence_endpoints():
    script_path = Path("/Users/chason/Moonshot/apps/api/scripts/build_governance_bundle.py")
    content = script_path.read_text(encoding="utf-8")

    assert "/v1/sessions/" in content
    assert "/v1/admin/policies/purge-expired" in content
    assert "/v1/audit-logs/verify" in content
    assert "/v1/reports/" in content
    assert "/v1/context/injection-traces/" in content
    assert "/v1/fairness/smoke-runs/" in content
    assert "/v1/redteam/runs/" in content
