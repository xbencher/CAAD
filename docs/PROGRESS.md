# Proxi — Progress Log

## CP-0: Foundation (2026-09-16)

### Built Features
- Monorepo skeleton: `backend/`, `mobile/`, `docs/`, `.github/workflows/`
- Project rulebook (`CLAUDE.md`) with all 13 rules
- Business rules file (`docs/BUSINESS_RULES.md`) with BR-01 through BR-26

### Backend Core (`app/core/`)
- `config.py` — pydantic-settings `Settings`; all values from env; fail-fast on missing secrets
- `db.py` — async SQLAlchemy 2.0 engine + `AsyncSession` factory; `get_db` dependency
- `redis.py` — async Redis client via `redis.asyncio`; `get_redis` dependency
- `logging.py` — structlog JSON logger; `redact_sensitive_fields` processor
- `errors.py` — `AppError` + handlers for `AppError`, `HTTPException`, `RequestValidationError`, unhandled 500
- `middleware.py` — `X-Request-ID` echo/generate; structlog access log

### Backend Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Returns `{"status":"ok"}` |
| GET | `/api/v1/health/ready` | Checks DB (`SELECT 1`, `PostGIS_Version()`) + Redis `PING`; 503 on failure |

### Worker
- `app/worker.py` — arq `WorkerSettings` skeleton; `heartbeat` job (logs a ping every 60 s, used by integration test)

### Database Migrations
| Revision | Description |
|----------|-------------|
| `0001` | Enable `postgis` and `citext` extensions |

### Mobile Skeleton
- Expo SDK 57, TypeScript strict, Expo Router
- `src/api/client.ts` — axios instance with `X-Request-ID`, `ApiError` normalizer
- `src/lib/env.ts` — `API_BASE_URL` validated with zod from `expo-constants`
- `src/theme/` — color, spacing, typography tokens (light + dark)
- `app/health.tsx` — dev-only Health screen (calls `/api/v1/health`)
- `eas.json` — development / preview / production profiles

### Environment Variables Added
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENV` | yes | — | `dev` \| `test` \| `e2e` \| `prod` |
| `DATABASE_URL` | yes | — | `postgresql+asyncpg://...` |
| `REDIS_URL` | yes | — | `redis://...` |
| `JWT_SECRET` | yes | — | Minimum 32-char secret for JWT signing |
| `LOG_LEVEL` | no | `INFO` | structlog minimum level |
| `FREE_DAILY_REQUESTS` | no | `3` | BR-08 free-tier daily quota |
| `MEMBER_DAILY_REQUESTS` | no | `50` | BR-08 member daily quota |

### CI
- `.github/workflows/ci.yml` — backend job (PostGIS + Redis service containers → ruff, mypy, alembic upgrade, pytest/coverage) + mobile job (tsc, eslint, jest)

### Known Limitations
- No product features — all screens beyond `health.tsx` are stubs
- Expo Go is **not** supported; an EAS development build is required (native modules arrive in CP-7/CP-8)
- Backend tests require Docker (PostgreSQL+PostGIS and Redis via docker-compose test profile)
- BLE, push notifications, payments, face verification, SMS — not yet implemented; provider interfaces defined in CP-1+
