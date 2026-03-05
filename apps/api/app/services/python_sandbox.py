from __future__ import annotations

import ast
import json
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


ALLOWED_IMPORT_ROOTS = {
    "collections",
    "datetime",
    "functools",
    "itertools",
    "json",
    "math",
    "matplotlib",
    "numpy",
    "pandas",
    "re",
    "seaborn",
    "sklearn",
    "statistics",
    "typing",
}

BLOCKED_CALLS = {
    "__import__",
    "compile",
    "eval",
    "exec",
    "input",
    "open",
}

DEMO_RUNTIME_ROOT = Path(__file__).resolve().parents[2] / "fixtures" / "demo_runtime"


class PythonSandboxValidationError(ValueError):
    pass


def _validate_context_value(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise PythonSandboxValidationError(f"runtime_context_invalid:{field_name}")
    if any(ch in normalized for ch in ("..", "/", "\\")):
        raise PythonSandboxValidationError(f"runtime_context_invalid:{field_name}")
    return normalized


def resolve_dataset_path(
    *,
    template_id: str | None,
    round_id: str | None,
    dataset_id: str | None,
) -> Path | None:
    if template_id is None and round_id is None and dataset_id is None:
        return None
    if not template_id or not round_id or not dataset_id:
        raise PythonSandboxValidationError("runtime_context_incomplete")

    template = _validate_context_value(template_id, "template_id")
    round_name = _validate_context_value(round_id, "round_id")
    dataset = _validate_context_value(dataset_id, "dataset_id")

    candidate = DEMO_RUNTIME_ROOT / template / round_name / f"{dataset}.csv"
    if not candidate.exists() or not candidate.is_file():
        raise PythonSandboxValidationError(
            f"runtime_dataset_not_found:{template}:{round_name}:{dataset}"
        )
    return candidate


def _root_name(node: ast.expr) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return _root_name(node.value)
    return None


def validate_python_code(code: str) -> None:
    try:
        tree = ast.parse(code, mode="exec")
    except SyntaxError as exc:
        raise PythonSandboxValidationError("syntax_error") from exc

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".", 1)[0]
                if root not in ALLOWED_IMPORT_ROOTS:
                    raise PythonSandboxValidationError(
                        f"disallowed_import:{root}"
                    )
        elif isinstance(node, ast.ImportFrom):
            module = (node.module or "").split(".", 1)[0]
            if module not in ALLOWED_IMPORT_ROOTS:
                raise PythonSandboxValidationError(
                    f"disallowed_import:{module or 'unknown'}"
                )
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in BLOCKED_CALLS:
                raise PythonSandboxValidationError(
                    f"disallowed_python_operation:{node.func.id}"
                )
            root = _root_name(node.func)
            if root in {"os", "subprocess", "socket", "pathlib", "shutil"}:
                raise PythonSandboxValidationError(
                    f"disallowed_python_operation:{root}"
                )


_SANDBOX_RUNNER = r"""
import base64
import builtins
import contextlib
import io
import json
import sys

payload = json.loads(sys.stdin.read())
code = payload["code"]
dataset_path = payload.get("dataset_path")
memory_limit_bytes = int(payload.get("memory_limit_bytes", 536870912))
cpu_limit_seconds = int(payload.get("cpu_limit_seconds", 8))
allowed_roots = set(payload.get("allowed_import_roots", []))

try:
    import resource

    resource.setrlimit(resource.RLIMIT_CPU, (cpu_limit_seconds, cpu_limit_seconds))
    resource.setrlimit(resource.RLIMIT_AS, (memory_limit_bytes, memory_limit_bytes))
    resource.setrlimit(resource.RLIMIT_FSIZE, (10485760, 10485760))
except Exception:
    pass

safe_builtin_names = [
    "abs",
    "all",
    "any",
    "bool",
    "dict",
    "enumerate",
    "float",
    "int",
    "isinstance",
    "len",
    "list",
    "max",
    "min",
    "pow",
    "print",
    "range",
    "round",
    "set",
    "sorted",
    "str",
    "sum",
    "tuple",
    "zip",
    "__build_class__",
    "Exception",
    "ValueError",
    "TypeError",
    "RuntimeError",
]

safe_builtins = {name: getattr(builtins, name) for name in safe_builtin_names}
orig_import = builtins.__import__

def limited_import(name, globals=None, locals=None, fromlist=(), level=0):
    root = name.split(".", 1)[0]
    if root not in allowed_roots:
        raise ImportError(f"disallowed_import:{root}")
    return orig_import(name, globals, locals, fromlist, level)

safe_builtins["__import__"] = limited_import

safe_globals = {"__builtins__": safe_builtins, "__name__": "__main__"}
if dataset_path:
    safe_globals["DATASET_PATH"] = dataset_path

stdout_buffer = io.StringIO()
stderr_buffer = io.StringIO()
artifacts = []
plot_url = None

try:
    import matplotlib

    matplotlib.use("Agg")
except Exception:
    pass

ok = True
error = None

try:
    with contextlib.redirect_stdout(stdout_buffer), contextlib.redirect_stderr(stderr_buffer):
        exec(compile(code, "<sandbox>", "exec"), safe_globals, safe_globals)
except Exception as exc:
    ok = False
    error = f"{type(exc).__name__}: {exc}"

try:
    import matplotlib.pyplot as plt

    for idx, fig_no in enumerate(plt.get_fignums(), start=1):
        fig = plt.figure(fig_no)
        image_bytes = io.BytesIO()
        fig.savefig(image_bytes, format="png", dpi=120, bbox_inches="tight")
        raw = image_bytes.getvalue()
        uri = "data:image/png;base64," + base64.b64encode(raw).decode("ascii")
        artifact = {
            "name": f"plot_{idx}.png",
            "mime_type": "image/png",
            "uri": uri,
            "bytes": len(raw),
            "kind": "plot",
        }
        artifacts.append(artifact)
        if plot_url is None:
            plot_url = uri
        plt.close(fig)
except Exception:
    pass

result = {
    "ok": ok,
    "stdout": stdout_buffer.getvalue() or None,
    "stderr": stderr_buffer.getvalue() or None,
    "runtime_error": error,
    "plot_url": plot_url,
    "artifacts": artifacts,
}
print(json.dumps(result))
"""


def run_python_sandbox(
    *,
    code: str,
    template_id: str | None = None,
    round_id: str | None = None,
    dataset_id: str | None = None,
    timeout_seconds: int = 20,
    memory_limit_bytes: int = 512 * 1024 * 1024,
) -> dict[str, Any]:
    validate_python_code(code)
    dataset_path = resolve_dataset_path(
        template_id=template_id,
        round_id=round_id,
        dataset_id=dataset_id,
    )

    payload = {
        "code": code,
        "dataset_path": str(dataset_path) if dataset_path else None,
        "memory_limit_bytes": memory_limit_bytes,
        "cpu_limit_seconds": timeout_seconds,
        "allowed_import_roots": sorted(ALLOWED_IMPORT_ROOTS),
    }

    started = time.perf_counter()
    try:
        completed = subprocess.run(
            [sys.executable, "-c", _SANDBOX_RUNNER],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=timeout_seconds + 2,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise PythonSandboxValidationError("python_sandbox_timeout") from exc

    runtime_ms = max(1, int((time.perf_counter() - started) * 1000))
    if completed.returncode != 0:
        stderr = (completed.stderr or "").strip()
        raise PythonSandboxValidationError(
            f"python_sandbox_failed:{stderr or 'non_zero_exit'}"
        )

    try:
        parsed = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise PythonSandboxValidationError("python_sandbox_invalid_result") from exc

    if not isinstance(parsed, dict):
        raise PythonSandboxValidationError("python_sandbox_invalid_payload")

    return {
        "ok": bool(parsed.get("ok", False)),
        "stdout": parsed.get("stdout"),
        "stderr": parsed.get("stderr"),
        "error": parsed.get("runtime_error"),
        "plot_url": parsed.get("plot_url"),
        "artifacts": parsed.get("artifacts") if isinstance(parsed.get("artifacts"), list) else [],
        "runtime_ms": runtime_ms,
    }
