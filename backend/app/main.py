from fastapi import APIRouter, Depends, FastAPI

from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware
from app.modules.auth.deps import get_sms_provider
from app.modules.auth.providers import FakeSmsProvider
from app.modules.auth.router import router as auth_router
from app.modules.health.router import router as health_router
from app.modules.users.router import router as users_router


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()

    app = FastAPI(title="Proxi API")
    app.add_middleware(RequestContextMiddleware)
    install_error_handlers(app)

    app.include_router(health_router, prefix=settings.api_v1_prefix)
    app.include_router(auth_router, prefix=settings.api_v1_prefix)
    app.include_router(users_router, prefix=settings.api_v1_prefix)

    # Dev-only endpoint: GET /api/v1/dev/last-otp?phone=
    # Never mounted in prod — tested in test_auth.py (BR requirement).
    if settings.env in {"dev", "test", "e2e"}:
        dev_router = APIRouter(tags=["dev"])

        @dev_router.get("/dev/last-otp")
        async def dev_last_otp(
            phone: str,
            sms_provider: FakeSmsProvider = Depends(get_sms_provider),
        ) -> dict[str, str | None]:
            normalized = phone.strip()
            if not normalized.startswith("+"):
                normalized = f"+{normalized}"
            return {"code": sms_provider.get_last_code(normalized)}

        app.include_router(dev_router, prefix=settings.api_v1_prefix)

    return app


app = create_app()
