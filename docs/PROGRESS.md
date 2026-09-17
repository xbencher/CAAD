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

## CP-1: Auth, Age Gate, Consent (2026-09-17)

### Built Features
- Phone OTP login with E.164 normalization (`+91` default for 10-digit Indian numbers)
- HMAC-SHA256 hashed OTPs stored in Redis with 5-minute TTL
- BR-23 rate limiting: max 3 requests per 10 minutes per phone, max 3 incorrect attempts locks the OTP
- SMS Provider abstraction: `MockSmsProvider` (dev/test) + `Msg91SmsProvider` skeleton
- JWT access tokens (15m TTL) + rotating refresh tokens (30d TTL) with device binding
- Refresh token rotation with family tracking: reusing an already-revoked refresh token revokes the entire token family
- BR-01 18+ age gate: strict check calculated against Asia/Kolkata (IST) date; under-18 hard rejection deactivates/deletes user and writes blocked phone hash (HMAC-SHA256 with pepper) for 365 days
- DOB immutability: once set, DOB cannot be changed via API
- Versioned consents: `terms`, `privacy`, and `location` required (version `1.0`); `marketing` optional
- Mobile token management: SecureStore storage for tokens and unique device UUID
- Mobile single-flight 401 interceptor: queues concurrent failed requests, refreshes token once, retries all
- Route guards: table-driven routing directing users to auth, dob, consent, profile stub, or app tabs based on status

### Backend Data Models (`app/modules/`)
- `users`: `id`, `phone_e164`, `status` (`pending_profile`, `active`, `suspended`, `shadow_hidden`, `deactivated`, `deleted`), `dob`, timestamps
- `refresh_tokens`: `id`, `user_id`, `token_hash`, `family_id`, `device_id`, `expires_at`, `revoked_at`, `replaced_by_id`, `created_at`
- `consents`: `id`, `user_id`, `consent_type` (`terms`, `privacy`, `location`, `marketing`), `version`, `granted_at`, `withdrawn_at`
- `blocked_phone_hashes`: `phone_hash` (PK), `reason`, `blocked_until`, `created_at`

### Database Migrations
| Revision | Description |
|----------|-------------|
| `0002` | Create `users`, `refresh_tokens`, `consents`, `blocked_phone_hashes` tables with enums and indexes |

### Backend Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/otp/request` | Request OTP via SMS (rate limited, 202 Accepted) |
| POST | `/api/v1/auth/otp/verify` | Verify OTP, issue access + rotating refresh token |
| POST | `/api/v1/auth/token/refresh` | Rotate refresh token, issue new access token |
| POST | `/api/v1/auth/logout` | Revoke active refresh token |
| GET | `/api/v1/dev/last-otp` | Dev/test only endpoint returning last OTP for phone |
| GET | `/api/v1/users/me` | Current user profile status, DOB state, and consents |
| POST | `/api/v1/users/me/dob` | Set DOB with 18+ age verification (immutable once set) |
| POST | `/api/v1/users/me/consents` | Grant or withdraw versioned consents |

### Mobile Screens & Navigation
- `(auth)/welcome.tsx` — landing welcome screen
- `(auth)/phone.tsx` — Indian phone entry with format validation
- `(auth)/otp.tsx` — 6-digit OTP verification screen with 60s resend timer
- `(auth)/blocked.tsx` — blocked / suspended account screen
- `(onboarding)/dob.tsx` — date of birth picker with BR-01 under-18 blocking modal
- `(onboarding)/consent.tsx` — versioned terms, privacy, location, and marketing checkboxes
- `(onboarding)/profile.tsx` — stub screen ready for CP-2 profile onboarding
- `(app)/tabs/index.tsx` — authenticated home dashboard with status badge and logout
- `RouteGuard.tsx` — high-order route guard wrapper in root `_layout.tsx`

### Environment Variables Added
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OTP_PEPPER` | yes | — | Pepper for OTP HMAC-SHA256 |
| `PHONE_HASH_PEPPER` | yes | — | Pepper for blocked phone hash HMAC-SHA256 |
| `JWT_ACCESS_TTL_MINUTES` | no | `15` | Access token lifetime in minutes |
| `JWT_REFRESH_TTL_DAYS` | no | `30` | Refresh token lifetime in days |
| `SMS_PROVIDER` | no | `mock` | `mock` \| `msg91` |

### Known Limitations & Next Steps
- Profile setup (photos, bio, display name, gender, intent) will be implemented in Checkpoint 2 (CP-2)
- Geofencing and venue discovery will be implemented in Checkpoint 3 (CP-3)

