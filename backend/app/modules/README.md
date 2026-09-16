# Module layout

Every product area lives in its own package under `app/modules/<name>/`:

- `router.py` — FastAPI `APIRouter`. Thin: parses/validates the request via
  `schemas.py`, calls `service.py`, returns the response. No business logic
  and no direct database access here.
- `schemas.py` — Pydantic request/response models for this module's API.
- `models.py` — SQLAlchemy ORM models owned by this module.
- `repository.py` — the only place in the module that runs queries against
  the database. Returns ORM models or plain data, never raw rows leaked
  past this layer.
- `service.py` — business logic. Every business rule (BR-xx from
  [docs/BUSINESS_RULES.md](../../../docs/BUSINESS_RULES.md)) enforced by
  this module is enforced here, with the rule ID cited in a comment.
- `deps.py` — FastAPI `Depends()` callables specific to this module (e.g.
  "current user must own this resource").
- `policy.py` — optional; used only when a module has non-trivial
  authorization logic worth separating from `service.py`.

`app/main.py` wires each module's `router` into the app under
`/api/v1/...`; it does not contain module logic itself.

CP-0 ships no product modules — `health/` is infrastructure (readiness of
the app itself), not a product feature, and follows this same layout to
stay consistent as the codebase grows.
