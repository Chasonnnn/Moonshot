from __future__ import annotations

import json
import os
import tempfile

import pytest

from app.services.sql_query_matcher import SQLQueryMatcher


@pytest.fixture()
def sample_precomputed(tmp_path):
    """Create a temporary precomputed queries JSON file."""
    data = {
        "queries": [
            {
                "pattern": "SELECT COUNT(*) FROM orders WHERE region = 'Atlanta'",
                "columns": ["count"],
                "rows": [{"count": 1234}],
                "description": "Count of Atlanta orders",
            },
            {
                "pattern": "SELECT restaurant_id, weekly_page_views FROM restaurants WHERE is_managed = false ORDER BY weekly_page_views DESC LIMIT 10",
                "columns": ["restaurant_id", "weekly_page_views"],
                "rows": [
                    {"restaurant_id": "r_001", "weekly_page_views": 980},
                    {"restaurant_id": "r_002", "weekly_page_views": 870},
                ],
                "description": "Top unmanaged restaurants by page views",
            },
            {
                "pattern": "SELECT AVG(conversion_rate) FROM funnel WHERE cohort = 'unmanaged'",
                "columns": ["avg_conversion_rate"],
                "rows": [{"avg_conversion_rate": 0.032}],
                "description": "Average conversion rate for unmanaged cohort",
            },
        ]
    }
    path = tmp_path / "precomputed_queries.json"
    path.write_text(json.dumps(data))
    return str(path)


class TestNormalize:
    def test_normalize_basic(self):
        """Lowercase, whitespace collapse, semicolon strip."""
        matcher = SQLQueryMatcher()
        assert matcher.normalize("  SELECT  *  FROM  foo ; ") == "select * from foo"

    def test_normalize_preserves_content(self):
        matcher = SQLQueryMatcher()
        assert matcher.normalize("SELECT id FROM bar") == "select id from bar"

    def test_normalize_strips_multiple_semicolons(self):
        matcher = SQLQueryMatcher()
        assert matcher.normalize("SELECT 1 ;;;") == "select 1"

    def test_normalize_tabs_and_newlines(self):
        matcher = SQLQueryMatcher()
        result = matcher.normalize("SELECT\n  id\n\tFROM\n  bar")
        assert result == "select id from bar"

    def test_normalize_strips_sql_comments(self):
        matcher = SQLQueryMatcher()
        result = matcher.normalize("/* hint */ SELECT id FROM bar -- trailing\n")
        assert result == "select id from bar"

    def test_normalize_rewrites_fixture_aliases(self):
        matcher = SQLQueryMatcher()
        result = matcher.normalize("SELECT management_type FROM atl_restaurants")
        assert result == "select is_managed from restaurants"


class TestExactMatch:
    def test_exact_match(self, sample_precomputed):
        """Normalized query matches exactly against a precomputed pattern."""
        matcher = SQLQueryMatcher(precomputed_path=sample_precomputed)
        result = matcher.match("SELECT COUNT(*) FROM orders WHERE region = 'Atlanta'")
        assert result is not None
        assert result["columns"] == ["count"]
        assert result["rows"] == [{"count": 1234}]

    def test_exact_match_with_extra_whitespace(self, sample_precomputed):
        matcher = SQLQueryMatcher(precomputed_path=sample_precomputed)
        result = matcher.match("  SELECT  COUNT(*)  FROM  orders  WHERE  region = 'Atlanta' ; ")
        assert result is not None
        assert result["columns"] == ["count"]

    def test_case_insensitive(self, sample_precomputed):
        """'SELECT' and 'select' both match."""
        matcher = SQLQueryMatcher(precomputed_path=sample_precomputed)
        result = matcher.match("select count(*) from orders where region = 'Atlanta'")
        assert result is not None
        assert result["columns"] == ["count"]

        result2 = matcher.match("SELECT COUNT(*) FROM orders WHERE region = 'Atlanta'")
        assert result2 is not None
        assert result2["columns"] == ["count"]


class TestFuzzyMatch:
    def test_fuzzy_match(self, sample_precomputed):
        """Partial keyword matching works when exact match fails."""
        matcher = SQLQueryMatcher(precomputed_path=sample_precomputed)
        # Query that contains key tokens from pattern but is not exact
        result = matcher.match(
            "SELECT restaurant_id, weekly_page_views FROM restaurants "
            "WHERE is_managed = false LIMIT 10"
        )
        assert result is not None
        assert "restaurant_id" in result["columns"]

    def test_fuzzy_match_with_additional_clauses(self, sample_precomputed):
        matcher = SQLQueryMatcher(precomputed_path=sample_precomputed)
        # Similar to a pattern but with slight differences
        result = matcher.match(
            "SELECT AVG(conversion_rate) FROM funnel WHERE cohort = 'unmanaged' LIMIT 100"
        )
        assert result is not None
        assert result["columns"] == ["avg_conversion_rate"]

    def test_fixture_aliases_and_comments_still_match(self, tmp_path):
        data = {
            "queries": [
                {
                    "pattern": "SELECT is_managed, COUNT(*) AS cnt FROM restaurants GROUP BY is_managed",
                    "columns": ["is_managed", "cnt"],
                    "rows": [{"is_managed": 0, "cnt": 60}, {"is_managed": 1, "cnt": 40}],
                }
            ]
        }
        path = tmp_path / "aliases.json"
        path.write_text(json.dumps(data))
        matcher = SQLQueryMatcher(precomputed_path=str(path))
        result = matcher.match(
            "/* fixture prompt */ SELECT management_type, COUNT(*) AS cnt FROM atl_restaurants GROUP BY management_type;"
        )
        assert result is not None
        assert result["columns"] == ["is_managed", "cnt"]


class TestNoMatch:
    def test_no_match_returns_none(self, sample_precomputed):
        """Unmatched queries return None from match()."""
        matcher = SQLQueryMatcher(precomputed_path=sample_precomputed)
        result = matcher.match("SELECT * FROM completely_unrelated_table")
        assert result is None

    def test_no_match_returns_hint(self, sample_precomputed):
        """format_response returns helpful message for unmatched queries."""
        matcher = SQLQueryMatcher(precomputed_path=sample_precomputed)
        response = matcher.format_response("SELECT * FROM completely_unrelated_table")
        assert response["ok"] is True
        assert response["row_count"] == 0
        assert response["rows"] == []
        assert len(response["columns"]) > 0
        # The hint column should contain helpful text
        assert any("hint" in col.lower() or "message" in col.lower() for col in response["columns"])


class TestEmptyMatcher:
    def test_empty_matcher(self):
        """Matcher with no precomputed data returns no match."""
        matcher = SQLQueryMatcher()
        result = matcher.match("SELECT * FROM anything")
        assert result is None

    def test_empty_matcher_format_response(self):
        """format_response still works with no precomputed data."""
        matcher = SQLQueryMatcher()
        response = matcher.format_response("SELECT * FROM anything")
        assert response["ok"] is True
        assert response["row_count"] == 0

    def test_missing_file_path(self):
        """Matcher handles nonexistent file gracefully."""
        matcher = SQLQueryMatcher(precomputed_path="/nonexistent/path/queries.json")
        result = matcher.match("SELECT 1")
        assert result is None


class TestFormatResponse:
    def test_format_response_with_match(self, sample_precomputed):
        """format_response wraps matched results properly."""
        matcher = SQLQueryMatcher(precomputed_path=sample_precomputed)
        response = matcher.format_response("SELECT COUNT(*) FROM orders WHERE region = 'Atlanta'")
        assert response["ok"] is True
        assert response["row_count"] == 1
        assert response["columns"] == ["count"]
        assert response["rows"] == [{"count": 1234}]
        assert "runtime_ms" in response

    def test_format_response_runtime_ms(self, sample_precomputed):
        matcher = SQLQueryMatcher(precomputed_path=sample_precomputed)
        response = matcher.format_response("SELECT COUNT(*) FROM orders WHERE region = 'Atlanta'")
        assert isinstance(response["runtime_ms"], int)
        assert response["runtime_ms"] >= 0
