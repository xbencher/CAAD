# Architecture

## Overview

Proxi is a venue-based, safety-first social discovery app for India.

- **Mobile**: React Native + Expo (TypeScript, strict), Expo Router.
- **Backend**: FastAPI on Python 3.12, fully async (SQLAlchemy 2.0 +
  asyncpg).
- **Database**: PostgreSQL 16 with PostGIS (geofencing) and citext.
- **Cache / jobs / presence**: Redis 7, background jobs via `arq`.
- **Object storage**: S3-compatible (MinIO locally; a managed S3-compatible
  provider in production).

## Repository layout

```
proxi/
  CLAUDE.md                  rules every change must follow
  docker-compose.yml         local Postgres+PostGIS, Redis, MinIO
  Makefile                   up/down/migrate/dev/test/lint entry points
  docs/                      architecture, business rules, API conventions, progress
  backend/                   FastAPI app (uv-managed)
  mobile/                    Expo app (TypeScript)
```

## Backend module layout

Each product area lives under `app/modules/<name>/` with:

- `router.py` — thin HTTP layer, request/response wiring only.
- `schemas.py` — Pydantic request/response models.
- `models.py` — SQLAlchemy ORM models.
- `repository.py` — the only place that touches the database.
- `service.py` — business logic; the only place business rules (BR-xx)
  are enforced.
- `deps.py` — FastAPI dependencies specific to the module.
- `policy.py` — optional, for modules with non-trivial authorization
  rules.

CP-0 ships no product modules — `app/modules/` exists as scaffolding with a
README describing this layout for future checkpoints.

## External providers

Anything that talks to a third party (SMS OTP, payments, push, face
verification, content moderation, object storage) is defined as a Python
`Protocol` in the owning module, with a `Fake` implementation used in tests
and local dev, and a real implementation selected by config in
`app/core/config.py`. No product module calls a third-party SDK directly
from `service.py`.

## Data rules baked into the schema

- Primary keys are UUIDs.
- Money is stored as integer paise.
- All timestamps are `timestamptz`, stored and compared in UTC. Only
  day-boundary logic (e.g. daily quota resets) converts to Asia/Kolkata
  (IST).
- Raw GPS coordinates are never persisted (see BR-21); only derived,
  privacy-safe facts (e.g. "checked in at venue X") are stored.

## Mobile build

The mobile app requires an **EAS development build**; **Expo Go is not
supported**. This is a CP-0 decision made up front because native modules
land in later checkpoints (BLE in CP-8, and other native APIs in CP-7)
that Expo Go cannot load. `eas.json` defines `development`, `preview` and
`production` profiles from CP-0 onward so the development build workflow
is available as soon as native modules are added — no profile changes are
needed later.

## Testing

- Backend tests run against the real `postgres-test` and `redis-test`
  docker-compose services — no SQLite, no mocked database. Each test runs
  inside a transaction with a nested `SAVEPOINT` that is rolled back, and
  Redis is flushed before each test.
- Time-dependent backend tests use `time-machine`; time-dependent mobile
  tests use Jest fake timers.
- Mobile tests use `jest-expo`, `@testing-library/react-native`, and MSW
  to mock HTTP calls — colocated as `*.test.tsx` next to the code under
  test (documented choice over a separate `__tests__/` tree).
