.PHONY: up down migrate dev-backend worker test-backend test-mobile test lint fmt

COMPOSE := docker compose
BACKEND := cd backend && uv run

TEST_ENV := ENV=test \
	DATABASE_URL=postgresql+asyncpg://proxi:proxi@localhost:5433/proxi_test \
	REDIS_URL=redis://localhost:6380/0 \
	JWT_SECRET=test-secret-please-change-1234

up:
	$(COMPOSE) up -d postgres redis minio minio-init

down:
	$(COMPOSE) down

migrate:
	$(BACKEND) alembic upgrade head

dev-backend:
	$(BACKEND) uvicorn app.main:app --reload

worker:
	$(BACKEND) arq app.worker.WorkerSettings

test-backend:
	$(COMPOSE) --profile test up -d postgres-test redis-test
	$(COMPOSE) --profile test exec -T postgres-test sh -c 'until pg_isready -U proxi -d proxi_test; do sleep 1; done'
	$(COMPOSE) --profile test exec -T redis-test redis-cli ping
	$(TEST_ENV) $(BACKEND) pytest --cov=app --cov-report=term-missing

test-mobile:
	cd mobile && npm test -- --watchAll=false

test: test-backend test-mobile

lint:
	$(BACKEND) ruff check .
	$(BACKEND) mypy app
	cd mobile && npx tsc --noEmit
	cd mobile && npx eslint .

fmt:
	$(BACKEND) ruff format .
	cd mobile && npx prettier --write .
