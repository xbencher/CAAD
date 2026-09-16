from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.core.errors import install_error_handlers


def _build_test_app() -> FastAPI:
    app = FastAPI()
    install_error_handlers(app)

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("boom")

    @app.get("/items/{item_id}")
    async def get_item(item_id: int) -> dict[str, int]:
        return {"item_id": item_id}

    @app.get("/pre-enveloped")
    async def pre_enveloped() -> None:
        raise HTTPException(
            status_code=409,
            detail={"error": {"code": "ALREADY_EXISTS", "message": "nope", "details": {}}},
        )

    return app


async def test_error_envelope_for_404_422_and_unhandled_500() -> None:
    app = _build_test_app()
    # Starlette's ServerErrorMiddleware always re-raises after invoking the
    # registered Exception handler (so a real server can still log it); the
    # response it built is sent to the client either way. Tell the ASGI
    # transport not to re-raise that exception into the test itself.
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        not_found = await client.get("/does-not-exist")
        assert not_found.status_code == 404
        assert not_found.json()["error"]["code"] == "NOT_FOUND"

        validation_error = await client.get("/items/not-an-int")
        assert validation_error.status_code == 422
        body = validation_error.json()
        assert body["error"]["code"] == "VALIDATION_ERROR"
        assert body["error"]["details"]["fields"]

        unhandled = await client.get("/boom")
        assert unhandled.status_code == 500
        assert unhandled.json()["error"]["code"] == "INTERNAL_ERROR"

        pre_enveloped = await client.get("/pre-enveloped")
        assert pre_enveloped.status_code == 409
        assert pre_enveloped.json()["error"]["code"] == "ALREADY_EXISTS"
