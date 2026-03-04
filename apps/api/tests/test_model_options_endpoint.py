from app.schemas import ModelOptionStatus, ModelOptionsResponse


def test_model_options_endpoint_returns_current_snapshot(client, monkeypatch):
    def _fake_snapshot() -> ModelOptionsResponse:
        return ModelOptionsResponse(
            required_models=["gpt-5.3-codex", "chatgpt/gpt-5.2"],
            defaults_by_agent={
                "codesign": "gpt-5.3-codex",
                "coach": "chatgpt/gpt-5.2",
                "evaluator": "anthropic/claude-opus-4-6",
            },
            options=[
                ModelOptionStatus(model="gpt-5.3-codex", available=True),
                ModelOptionStatus(model="chatgpt/gpt-5.2", available=True),
            ],
        )

    monkeypatch.setattr("app.api.v1.endpoints.meta.get_model_options_snapshot", _fake_snapshot)

    response = client.get("/v1/meta/model-options")
    assert response.status_code == 200
    payload = response.json()
    assert payload["required_models"] == ["gpt-5.3-codex", "chatgpt/gpt-5.2"]
    assert payload["defaults_by_agent"]["codesign"] == "gpt-5.3-codex"
    assert payload["options"][0]["model"] == "gpt-5.3-codex"
    assert payload["options"][0]["available"] is True
