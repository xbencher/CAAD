from fastapi import FastAPI

from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware
from app.modules.health.router import router as health_router


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()

    app = FastAPI(title="Proxi API")
    app.add_middleware(RequestContextMiddleware)
    install_error_handlers(app)

    app.include_router(health_router, prefix=settings.api_v1_prefix)

    return app


app = create_app()
