from __future__ import annotations

import json
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

# Tokens that are too common in SQL to be useful for fuzzy matching
_STOP_TOKENS = frozenset({
    "select", "from", "where", "and", "or", "not", "in", "is", "as",
    "on", "join", "left", "right", "inner", "outer", "cross", "full",
    "group", "by", "order", "having", "limit", "offset", "union",
    "all", "distinct", "null", "true", "false", "between", "like",
    "case", "when", "then", "else", "end", "asc", "desc", "with",
    "into", "values", "set", "exists", "any", "some",
})

_FUZZY_MATCH_THRESHOLD = 0.6

_CANONICAL_REWRITES = {
    "atl_restaurants": "restaurants",
    "management_type": "is_managed",
    "promo_spend_usd": "monthly_ad_spend",
    "weekly_page_views": "page_views",
    "deliveries_l30": "monthly_orders",
}


class SQLQueryMatcher:
    """Matches incoming SQL queries against precomputed query patterns."""

    def __init__(self, precomputed_path: str | None = None) -> None:
        """Load precomputed queries from JSON file.

        Accepts either a bare JSON array or ``{"queries": [...]}``.
        """
        self._entries: list[dict] = []
        self._normalized_index: dict[str, int] = {}

        if precomputed_path is None:
            return

        path = Path(precomputed_path)
        if not path.exists():
            logger.warning("Precomputed queries file not found: %s", precomputed_path)
            return

        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            queries = data if isinstance(data, list) else data.get("queries", [])
            for idx, entry in enumerate(queries):
                pattern = entry.get("pattern", "")
                self._entries.append(entry)
                normalized = self.normalize(pattern)
                self._normalized_index[normalized] = idx
        except (json.JSONDecodeError, KeyError, TypeError, AttributeError) as exc:
            logger.error("Failed to load precomputed queries from %s: %s", precomputed_path, exc)

    @property
    def has_entries(self) -> bool:
        return bool(self._entries)

    def normalize(self, sql: str) -> str:
        """Normalize SQL: strip comments, canonicalize aliases, collapse whitespace."""
        result = sql.strip()
        # Strip block and line comments so fixture prompts with hints still match.
        result = re.sub(r"/\*.*?\*/", " ", result, flags=re.DOTALL)
        result = re.sub(r"--[^\n]*", " ", result)
        result = result.lower().strip()
        for source, target in _CANONICAL_REWRITES.items():
            result = re.sub(rf"\b{re.escape(source)}\b", target, result)
        # Strip trailing semicolons
        result = result.rstrip(";").strip()
        # Collapse whitespace (spaces, tabs, newlines)
        result = re.sub(r"\s+", " ", result)
        return result

    def _extract_key_tokens(self, normalized_sql: str) -> set[str]:
        """Extract meaningful tokens from normalized SQL, excluding stop words."""
        tokens = re.findall(r"[a-z_][a-z0-9_]*(?:\([^)]*\))?", normalized_sql)
        return {t for t in tokens if t not in _STOP_TOKENS and len(t) > 1}

    def match(self, sql: str) -> dict | None:
        """Try to match query against precomputed patterns.

        Returns dict with columns/rows or None.
        Tries exact normalized match first, then fuzzy/partial match.
        """
        if not self._entries:
            return None

        normalized = self.normalize(sql)

        # 1) Exact normalized match
        idx = self._normalized_index.get(normalized)
        if idx is not None:
            entry = self._entries[idx]
            return {"columns": entry["columns"], "rows": entry["rows"]}

        # 2) Fuzzy/partial match: check if key tokens from a pattern appear in the query
        query_tokens = self._extract_key_tokens(normalized)
        if not query_tokens:
            return None

        best_score = 0.0
        best_idx: int | None = None

        for pattern_normalized, idx in self._normalized_index.items():
            pattern_tokens = self._extract_key_tokens(pattern_normalized)
            if not pattern_tokens:
                continue
            # Score = fraction of pattern tokens found in the query
            overlap = pattern_tokens & query_tokens
            score = len(overlap) / len(pattern_tokens)
            if score > best_score:
                best_score = score
                best_idx = idx

        if best_score >= _FUZZY_MATCH_THRESHOLD and best_idx is not None:
            entry = self._entries[best_idx]
            return {"columns": entry["columns"], "rows": entry["rows"]}

        return None

    def format_response(self, sql: str) -> dict:
        """Returns a full response dict suitable for the SQL endpoint."""
        result = self.match(sql)
        if result is not None:
            return {
                "ok": True,
                "row_count": len(result["rows"]),
                "columns": result["columns"],
                "rows": result["rows"],
                "runtime_ms": 12,
            }

        return {
            "ok": True,
            "row_count": 0,
            "columns": ["message"],
            "rows": [],
            "runtime_ms": 1,
        }
