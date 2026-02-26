# ADR 0001: Backend Stack

## Status
Accepted

## Context
The MVP needs rapid backend delivery, typed contracts, async-friendly APIs, and strong data tooling.

## Decision
Use FastAPI + Pydantic for API layer, SQLAlchemy ORM and Alembic for data model baseline, and PostgreSQL as primary relational store.

## Consequences
- Fast iteration and clear OpenAPI generation.
- Simple transition from local SQLite test mode to PostgreSQL.
- Clear migration/versioning workflow for schema evolution.
