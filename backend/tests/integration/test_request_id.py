import uuid

from httpx import AsyncClient


async def test_request_id_is_echoed_or_generated(client: AsyncClient) -> None:
    supplied_id = str(uuid.uuid4())
    echoed = await client.get("/api/v1/health", headers={"X-Request-ID": supplied_id})
    assert echoed.headers["X-Request-ID"] == supplied_id

    generated = await client.get("/api/v1/health")
    generated_id = generated.headers["X-Request-ID"]
    assert uuid.UUID(generated_id)
    assert generated_id != supplied_id
