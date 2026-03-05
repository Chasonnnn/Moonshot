from app.services.jobs import process_jobs_until_empty


def _job_result(client, job_id, headers):
    process_jobs_until_empty()
    response = client.get(f"/v1/jobs/{job_id}/result", headers=headers)
    assert response.status_code == 200
    return response.json()["result"]


def _create_live_session(client, admin_headers, candidate_id="candidate_1"):
    case = client.post(
        "/v1/cases",
        headers=admin_headers,
        json={
            "title": "Simulator Case",
            "scenario": "Investigate anomaly and communicate findings.",
            "artifacts": [],
            "metrics": [],
            "allowed_tools": ["sql_workspace", "dashboard_workspace"],
        },
    )
    assert case.status_code == 201
    case_id = case.json()["id"]
    gen = client.post(
        f"/v1/cases/{case_id}/generate",
        headers={**admin_headers, "Idempotency-Key": "sim-gen-1"},
    )
    assert gen.status_code == 202
    task_family_id = _job_result(client, gen.json()["job_id"], admin_headers)[
        "task_family"
    ]["id"]
    review = client.post(
        f"/v1/task-families/{task_family_id}/review",
        headers=admin_headers,
        json={"decision": "approve", "review_note": "ready"},
    )
    assert review.status_code == 200
    publish = client.post(
        f"/v1/task-families/{task_family_id}/publish", headers=admin_headers, json={}
    )
    assert publish.status_code == 200

    session = client.post(
        "/v1/sessions",
        headers=admin_headers,
        json={
            "task_family_id": task_family_id,
            "candidate_id": candidate_id,
            "policy": {"raw_content_opt_in": False},
        },
    )
    assert session.status_code == 201
    return session.json()["id"]


def test_sql_run_and_history(
    client, admin_headers, candidate_headers, reviewer_headers
):
    session_id = _create_live_session(client, admin_headers)

    run = client.post(
        f"/v1/sessions/{session_id}/sql/run",
        headers=candidate_headers,
        json={"query": "SELECT * FROM funnel_metrics LIMIT 5;"},
    )
    assert run.status_code == 200
    payload = run.json()
    assert payload["ok"] is True
    assert payload["row_count"] >= 0
    assert payload["columns"]

    history_candidate = client.get(
        f"/v1/sessions/{session_id}/sql/history", headers=candidate_headers
    )
    assert history_candidate.status_code == 200
    assert len(history_candidate.json()["items"]) == 1

    history_reviewer = client.get(
        f"/v1/sessions/{session_id}/sql/history", headers=reviewer_headers
    )
    assert history_reviewer.status_code == 200
    assert len(history_reviewer.json()["items"]) == 1


def test_sql_run_blocks_dangerous_queries(client, admin_headers, candidate_headers):
    session_id = _create_live_session(client, admin_headers)
    run = client.post(
        f"/v1/sessions/{session_id}/sql/run",
        headers=candidate_headers,
        json={"query": "DROP TABLE users;"},
    )
    assert run.status_code == 400
    assert "disallowed" in run.json()["detail"]


def test_dashboard_state_and_action(
    client, admin_headers, candidate_headers, reviewer_headers
):
    session_id = _create_live_session(client, admin_headers)

    state = client.get(
        f"/v1/sessions/{session_id}/dashboard/state", headers=candidate_headers
    )
    assert state.status_code == 200
    assert state.json()["filters"] == {}

    action = client.post(
        f"/v1/sessions/{session_id}/dashboard/action",
        headers=candidate_headers,
        json={"action_type": "apply_filter", "payload": {"region": "NA"}},
    )
    assert action.status_code == 200
    assert action.json()["filters"]["region"] == "NA"

    reviewer_state = client.get(
        f"/v1/sessions/{session_id}/dashboard/state", headers=reviewer_headers
    )
    assert reviewer_state.status_code == 200
    assert reviewer_state.json()["filters"]["region"] == "NA"


# ── Python simulator tests ────────────────────────────────────────────


def test_python_run_valid_code(client, admin_headers, candidate_headers):
    session_id = _create_live_session(client, admin_headers)
    run = client.post(
        f"/v1/sessions/{session_id}/python/run",
        headers=candidate_headers,
        json={
            "code": "import pandas as pd\ndf = pd.DataFrame({'a': [1,2,3]})\nprint(df)"
        },
    )
    assert run.status_code == 200
    payload = run.json()
    assert payload["ok"] is True
    assert payload["stdout"] is not None
    assert payload["runtime_ms"] >= 0
    assert isinstance(payload["artifacts"], list)


def test_python_run_blocks_destructive_code(client, admin_headers, candidate_headers):
    session_id = _create_live_session(client, admin_headers)
    for dangerous_code in [
        "import os",
        "import subprocess",
        "import socket",
        "open('file.txt')",
        "exec('code')",
        "eval('1+1')",
        "__import__('os')",
    ]:
        run = client.post(
            f"/v1/sessions/{session_id}/python/run",
            headers=candidate_headers,
            json={"code": dangerous_code},
        )
        assert run.status_code == 400, f"Expected 400 for: {dangerous_code}"
        assert "disallowed" in run.json()["detail"].lower()


def test_python_run_empty_code(client, admin_headers, candidate_headers):
    session_id = _create_live_session(client, admin_headers)
    run = client.post(
        f"/v1/sessions/{session_id}/python/run",
        headers=candidate_headers,
        json={"code": ""},
    )
    assert run.status_code == 400


def test_python_run_with_plot(client, admin_headers, candidate_headers):
    session_id = _create_live_session(client, admin_headers)
    run = client.post(
        f"/v1/sessions/{session_id}/python/run",
        headers=candidate_headers,
        json={"code": "import matplotlib.pyplot as plt\nplt.plot([1,2,3])\nplt.show()"},
    )
    assert run.status_code == 200
    payload = run.json()
    assert payload["ok"] is True
    assert payload["plot_url"] is not None
    assert len(payload["artifacts"]) >= 1
    first_artifact = payload["artifacts"][0]
    assert first_artifact["kind"] == "plot"
    assert first_artifact["uri"].startswith("data:image/png;base64,")
    assert first_artifact["mime_type"] == "image/png"


def test_python_history(client, admin_headers, candidate_headers, reviewer_headers):
    session_id = _create_live_session(client, admin_headers)
    client.post(
        f"/v1/sessions/{session_id}/python/run",
        headers=candidate_headers,
        json={"code": "print('hello')"},
    )
    history = client.get(
        f"/v1/sessions/{session_id}/python/history", headers=candidate_headers
    )
    assert history.status_code == 200
    assert len(history.json()["items"]) == 1
    assert "artifacts" in history.json()["items"][0]

    reviewer_history = client.get(
        f"/v1/sessions/{session_id}/python/history", headers=reviewer_headers
    )
    assert reviewer_history.status_code == 200
    assert len(reviewer_history.json()["items"]) == 1


def test_python_run_with_runtime_context_dataset(client, admin_headers, candidate_headers):
    session_id = _create_live_session(client, admin_headers)
    run = client.post(
        f"/v1/sessions/{session_id}/python/run",
        headers=candidate_headers,
        json={
            "template_id": "tpl_data_analyst",
            "round_id": "round_2",
            "dataset_id": "conversion_channels_v1",
            "code": (
                "import pandas as pd\n"
                "df = pd.read_csv(DATASET_PATH)\n"
                "print('rows', len(df))\n"
                "print('cols', ','.join(df.columns))"
            ),
        },
    )
    assert run.status_code == 200
    payload = run.json()
    assert payload["ok"] is True
    assert "rows" in (payload["stdout"] or "")


def test_python_run_with_doordash_runtime_context_dataset(client, admin_headers, candidate_headers):
    session_id = _create_live_session(client, admin_headers)
    run = client.post(
        f"/v1/sessions/{session_id}/python/run",
        headers=candidate_headers,
        json={
            "template_id": "tpl_doordash_enablement",
            "round_id": "round_2",
            "dataset_id": "atl_unmanaged_funnel_v1",
            "code": (
                "import pandas as pd\n"
                "df = pd.read_csv(DATASET_PATH)\n"
                "print('rows', len(df))\n"
                "print('avg_views', round(df['weekly_page_views'].mean(), 2))\n"
                "print('avg_conv', round(df['conversion_rate'].mean(), 4))"
            ),
        },
    )
    assert run.status_code == 200
    payload = run.json()
    assert payload["ok"] is True
    stdout = payload["stdout"] or ""
    assert "rows" in stdout
    assert "avg_views" in stdout
    assert "avg_conv" in stdout


# ── Annotation tests ─────────────────────────────────────────────────


def test_annotate_adds_note_to_dashboard_state(
    client, admin_headers, candidate_headers
):
    session_id = _create_live_session(client, admin_headers)

    # Initial state has empty annotations
    state = client.get(
        f"/v1/sessions/{session_id}/dashboard/state", headers=candidate_headers
    )
    assert state.status_code == 200
    assert state.json()["annotations"] == []

    # Add first annotation
    resp = client.post(
        f"/v1/sessions/{session_id}/dashboard/action",
        headers=candidate_headers,
        json={
            "action_type": "annotate",
            "payload": {"note": "Activation dropped post release."},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["annotations"] == ["Activation dropped post release."]

    # Add second annotation — both should be present
    resp2 = client.post(
        f"/v1/sessions/{session_id}/dashboard/action",
        headers=candidate_headers,
        json={"action_type": "annotate", "payload": {"note": "Retention stable."}},
    )
    assert resp2.status_code == 200
    assert resp2.json()["annotations"] == [
        "Activation dropped post release.",
        "Retention stable.",
    ]

    # GET state should also reflect both annotations
    state2 = client.get(
        f"/v1/sessions/{session_id}/dashboard/state", headers=candidate_headers
    )
    assert state2.status_code == 200
    assert state2.json()["annotations"] == [
        "Activation dropped post release.",
        "Retention stable.",
    ]


def test_annotate_rejects_empty_note(client, admin_headers, candidate_headers):
    session_id = _create_live_session(client, admin_headers)

    # Missing note key
    resp = client.post(
        f"/v1/sessions/{session_id}/dashboard/action",
        headers=candidate_headers,
        json={"action_type": "annotate", "payload": {}},
    )
    assert resp.status_code == 400

    # Empty string note
    resp2 = client.post(
        f"/v1/sessions/{session_id}/dashboard/action",
        headers=candidate_headers,
        json={"action_type": "annotate", "payload": {"note": ""}},
    )
    assert resp2.status_code == 400

    # Non-string note
    resp3 = client.post(
        f"/v1/sessions/{session_id}/dashboard/action",
        headers=candidate_headers,
        json={"action_type": "annotate", "payload": {"note": 123}},
    )
    assert resp3.status_code == 400


def test_annotate_reviewer_cannot_add(
    client, admin_headers, candidate_headers, reviewer_headers
):
    session_id = _create_live_session(client, admin_headers)

    resp = client.post(
        f"/v1/sessions/{session_id}/dashboard/action",
        headers=reviewer_headers,
        json={"action_type": "annotate", "payload": {"note": "Reviewer note"}},
    )
    assert resp.status_code == 403


def test_annotate_visible_to_reviewer(
    client, admin_headers, candidate_headers, reviewer_headers
):
    session_id = _create_live_session(client, admin_headers)

    client.post(
        f"/v1/sessions/{session_id}/dashboard/action",
        headers=candidate_headers,
        json={"action_type": "annotate", "payload": {"note": "Candidate insight"}},
    )

    reviewer_state = client.get(
        f"/v1/sessions/{session_id}/dashboard/state", headers=reviewer_headers
    )
    assert reviewer_state.status_code == 200
    assert reviewer_state.json()["annotations"] == ["Candidate insight"]


def test_unsupported_dashboard_action_type(client, admin_headers, candidate_headers):
    session_id = _create_live_session(client, admin_headers)

    resp = client.post(
        f"/v1/sessions/{session_id}/dashboard/action",
        headers=candidate_headers,
        json={"action_type": "delete_everything", "payload": {}},
    )
    assert resp.status_code == 400
    assert "unsupported" in resp.json()["detail"]
