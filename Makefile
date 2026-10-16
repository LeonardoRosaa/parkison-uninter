infra:
	docker compose up redis

dev:
	uv sync
	uv run uvicorn app.main:app --port 8000 --reload

dev-frontend:
	cd frontend && npm run dev

# Runs in analysis/'s own uv project; see analysis/README.md.
train:
	$(MAKE) -C analysis train

tests:
	uv run pytest .

linter:
	uv run ruff check .

format:
	uv run ruff format .

static-check:
	uv run ty check
