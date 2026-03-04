from __future__ import annotations

import os
import sys


def _missing(name: str) -> bool:
    value = os.getenv(name)
    return value is None or not value.strip()


def main() -> int:
    failures: list[str] = []

    if _missing("MOONSHOT_DATABASE_URL"):
        failures.append("MOONSHOT_DATABASE_URL must be set")

    if _missing("MOONSHOT_BOOTSTRAP_TOKEN"):
        failures.append("MOONSHOT_BOOTSTRAP_TOKEN must be set")

    if _missing("MOONSHOT_JWT_SIGNING_KEYS"):
        failures.append("MOONSHOT_JWT_SIGNING_KEYS must be set")

    provider = os.getenv("MOONSHOT_MODEL_PROVIDER", "litellm").strip().lower() or "litellm"
    if provider == "litellm":
        if _missing("MOONSHOT_LITELLM_BASE_URL"):
            failures.append("MOONSHOT_LITELLM_BASE_URL must be set when MOONSHOT_MODEL_PROVIDER=litellm")
        if _missing("MOONSHOT_LITELLM_API_KEY"):
            failures.append("MOONSHOT_LITELLM_API_KEY must be set when MOONSHOT_MODEL_PROVIDER=litellm")

    if failures:
        for failure in failures:
            print(f"runtime-env: FAIL ({failure})", file=sys.stderr)
        return 1

    print("runtime-env: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
