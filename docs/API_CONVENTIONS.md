# API Conventions

## Base

- All endpoints are prefixed with `/api/v1`.
- Request/response bodies are JSON (`application/json`) unless documented
  otherwise (e.g. file upload endpoints in later checkpoints).
- Every request may send `X-Request-ID`. If absent, the server generates
  one (UUID4). The same value is always echoed back on the response as
  `X-Request-ID`, and included in every structured log line for that
  request.

## Error envelope

Every error response (4xx and 5xx) uses this shape:

```json
{
  "error": {
    "code": "UPPER_SNAKE_CASE",
    "message": "Human-readable message, safe to show to a developer.",
    "details": {}
  }
}
```

- `code` is a stable, machine-readable identifier. Clients should branch on
  `code`, never on `message`.
- `details` is an object, empty (`{}`) when there is nothing structured to
  add (e.g. field-level validation errors go under `details.fields`).
- Unhandled server exceptions are mapped to `code: "INTERNAL_ERROR"` with a
  generic `message`. Stack traces are never returned in the response body;
  they are only written to server-side logs.
- FastAPI `RequestValidationError` (422) is mapped to `code:
  "VALIDATION_ERROR"` with `details.fields` listing each failing field and
  its message.
- `HTTPException` is mapped using its `status_code` and, when the
  exception's `detail` is itself an error-envelope-shaped dict, that shape
  is preserved; otherwise `detail` becomes `message` and `code` is derived
  from the status code (e.g. `404` → `NOT_FOUND`).

## Pagination

List endpoints that can grow unbounded use cursor pagination:

```json
{
  "items": [ ... ],
  "next_cursor": "opaque-string-or-null"
}
```

- `next_cursor` is `null` when there are no more items.
- Clients pass the previous response's `next_cursor` back as a
  `?cursor=...` query parameter to fetch the next page.
- Cursors are opaque server-generated tokens (never raw offsets), so the
  server is free to change its internal encoding between releases.

## Health

- `GET /api/v1/health` → `200 {"status": "ok"}`. No dependency checks;
  used for liveness probes.
- `GET /api/v1/health/ready` → `200 {"status": "ok"}` when the database
  (via `SELECT 1` and `PostGIS_Version()`) and Redis (`PING`) are both
  reachable; otherwise `503` with the standard error envelope, `code:
  "NOT_READY"`, and `details` naming which dependency failed.
