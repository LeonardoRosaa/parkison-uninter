- [x] Add `.env`
- [x] Double-check i18n
- [] Dockerfile
- [] Analysis algorithm

## Run full stack with Docker

Copy `.env.example` to `.env` first; it lists every variable the API reads.

```bash
docker compose up --build
```

Services:
- Frontend: http://localhost:5173
- API: http://localhost:8000
- Redis: localhost:6379

## API

- `POST /audios` — upload one audio file (`multipart/form-data`, field `file`,
  any `audio/*` type). Returns `{ "filename", "uuid" }`.
- `WS /ws/{uuid}` — follow that upload. Each message is
  `{ "request_id", "status", "metrics"? }`. `status` is `loading` while the
  analysis runs and ends with `health`, `nonhealthy`, `error` or `timeout`,
  after which the socket closes.
- `GET /health` — liveness check.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `REDIS_PASSWORD` | required | Where results are stored and published |
| `CORS_ORIGINS` | required | Comma-separated origins allowed to call the API |
| `WS_TIMEOUT_SECONDS` | `300` | How long a WebSocket waits for a result |
| `AUDIO_MODEL_PATH` | `models/audio.pkl` | Pickled classifier loaded at start-up |

The production compose file additionally reads `PUBLIC_API_BASE`,
`PUBLIC_WS_URL` and `PUBLIC_LOCALE` (baked into the frontend build), the
`*_PORT` host mappings and `UVICORN_WORKERS`.

## Training the model

`analysis/` is a separate uv project that trains the classifier and replaces
`models/audio.pkl`; its dependencies are not part of the API. See
[analysis/README.md](analysis/README.md).
