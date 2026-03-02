from app.services.coach import POLICY_PATH


def test_coach_policy_path_resolves_and_exists():
    assert POLICY_PATH.name == "coach_policy.yaml"
    assert POLICY_PATH.exists()
