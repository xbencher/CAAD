# Proxi — Project Rulebook

Proxi is a venue-based, safety-first social discovery (dating) app for India.
Mobile: React Native with Expo (TypeScript). Backend: FastAPI (Python 3.12).
Database: PostgreSQL 16 + PostGIS. Redis 7 for presence, pub/sub and jobs (arq).
S3-compatible object storage (MinIO locally).

The project is built in 10 checkpoints, CP-0 to CP-9. Work on exactly one
checkpoint at a time; never start the next checkpoint without being asked.

## Hard rules

- Never invent a library, API, function, CLI flag or config key. A dependency
  is added only via `uv add` (backend) or `npx expo install` / `npm install`
  (mobile), and only if the command succeeds. Pin resolved versions.
- Use `npx expo install` for any package that contains native code, so
  versions match the Expo SDK.
- If you are not certain how a third-party API works (SMS, Razorpay, Expo
  push, etc.), say so and ask for the official doc section to be pasted in.
  Do not guess endpoints or payload shapes.
- Business rules live in [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md)
  with IDs (BR-xx). Code that enforces a rule cites the ID in a comment.
  Each rule enforced in a checkpoint has at least one test whose name
  contains the ID, e.g. `test_br08_fourth_free_request_is_rejected`.
- If a requirement is ambiguous, or conflicts with BUSINESS_RULES.md, STOP
  and ask. Do not guess.
- No TODO/placeholder business logic, no `pass` bodies, no hardcoded fake
  responses in production code. Navigation stub screens for features of a
  future checkpoint are allowed (a screen with a title only).
- External providers (SMS, storage, payments, face verification, push,
  content moderation) sit behind a Python `Protocol` / TS interface. A Fake
  implementation is used in tests and dev; the real one is selected by
  config.
- Backend module layout: `app/modules/<name>/{router.py, schemas.py,
  models.py, repository.py, service.py, deps.py, policy.py (if needed)}`.
  Routers are thin. Business logic only in `service.py`. DB access only in
  `repository.py`.
- All DB access is async (SQLAlchemy 2.0 + asyncpg). Every schema change
  goes through an Alembic migration. Never call `metadata.create_all`
  outside tests.
- IDs are UUIDs. Money is integer paise. Timestamps are timestamptz in UTC.
  "Day" boundaries use Asia/Kolkata (IST).
- Never persist raw GPS coordinates of users (BR-21). Never return other
  users' distance, coordinates or check-in times (BR-02).
- Never log phone numbers, OTPs, tokens, coordinates, message bodies or
  photo URLs. Logging redaction is tested.
- API: prefix `/api/v1`, error envelope
  `{"error": {"code": "UPPER_SNAKE", "message": "...", "details": {}}}`,
  cursor pagination `{"items": [...], "next_cursor": "..."}`. Documented in
  [docs/API_CONVENTIONS.md](docs/API_CONVENTIONS.md).
- Tests run against real PostgreSQL+PostGIS and Redis from the
  docker-compose test services. No SQLite. Time-dependent tests use
  time-machine (backend) and Jest fake timers (mobile).
- A checkpoint is done only when `make lint` and `make test` pass with zero
  failures and backend coverage for modules touched in that checkpoint is
  >= 85%. Paste the final summary lines of both commands.
- Never modify or delete tests from earlier checkpoints to make them pass.
  If an earlier test is genuinely wrong, explain why and ask first.
- End of every checkpoint: update [docs/PROGRESS.md](docs/PROGRESS.md)
  (built features, endpoints, migrations, env vars added, known
  limitations), commit with `"CP-N: <title>"`, then STOP.

## Checkpoint discipline

- Implement only the checkpoint that was asked for. Do not build product
  features from later checkpoints. Do not "helpfully" get ahead.
- Do not remove or weaken any rule in this file. New rules may be added if
  a checkpoint surfaces a gap.
