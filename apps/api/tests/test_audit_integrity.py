from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.entities import AuditLogModel


def test_audit_entries_include_hash_chain(client, admin_headers):
    created = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Audit Hash Case",
            "scenario": "Check audit hash chain",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": [],
        },
    )
    assert created.status_code == 201

    logs = client.get("/v1/audit-logs", headers=admin_headers)
    assert logs.status_code == 200
    items = logs.json()["items"]
    assert len(items) >= 1
    assert items[0]["entry_hash"]
    assert items[0]["prev_hash"]

    verify = client.get("/v1/audit-logs/verify", headers=admin_headers)
    assert verify.status_code == 200
    payload = verify.json()
    assert payload["valid"] is True
    assert payload["checked_entries"] >= 1


def test_audit_verify_detects_tampering(client, admin_headers):
    created = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Tamper Case",
            "scenario": "Tamper detection",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": [],
        },
    )
    assert created.status_code == 201

    with SessionLocal() as db:
        row = db.execute(select(AuditLogModel).order_by(AuditLogModel.created_at.asc())).scalars().first()
        assert row is not None
        row.metadata_json = {"tampered": True}
        db.commit()

    verify = client.get("/v1/audit-logs/verify", headers=admin_headers)
    assert verify.status_code == 200
    payload = verify.json()
    assert payload["valid"] is False
    assert payload["error_code"] == "audit_chain_invalid"
