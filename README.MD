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
  `{ "request_id", "status", "metrics"?, "out_of_range"? }`. `status` is
  `loading` while the analysis runs and ends with `health`, `nonhealthy`,
  `inconclusive`, `error` or `timeout`, after which the socket closes.
  `inconclusive` means the recording is far outside the range the model was
  trained on, so it gives no answer; `out_of_range` then names the features
  responsible.
- `GET /health` — liveness check.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `REDIS_URL` | optional | Single Redis connection URL; when set, the four variables below are not needed |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `REDIS_PASSWORD` | required unless `REDIS_URL` is set | Where results are stored and published |
| `CORS_ORIGINS` | required | Comma-separated origins allowed to call the API |
| `AUDIO_MODEL_PATH` | required | Pickled classifier loaded at start-up, e.g. `models/audio.pkl` |
| `WS_TIMEOUT_SECONDS` | `300` | How long a WebSocket waits for a result |

The production compose file additionally reads `PUBLIC_API_BASE`,
`PUBLIC_WS_URL` and `PUBLIC_LOCALE` (baked into the frontend build), the
`*_PORT` host mappings and `UVICORN_WORKERS`.

## Deploy on Railway

One Railway project with three services: Redis, the API and the frontend.

- **Redis:** Railway's Redis database.
- **API:** from the repo root, with `RAILWAY_DOCKERFILE_PATH=Dockerfile.prod`.
  Variables: `PORT=8000`, `UVICORN_WORKERS=1`, `AUDIO_MODEL_PATH=models/audio.pkl`,
  `REDIS_URL=${{Redis.REDIS_URL}}` and `CORS_ORIGINS=<the frontend URL>`.
  Health check path `/health`; generate a public domain on port 8000.
- **Frontend:** from the same repo with root directory `frontend` and
  `RAILWAY_DOCKERFILE_PATH=Dockerfile.prod`. Variables: `PORT=4173`,
  `VITE_API_BASE=https://<api domain>` and
  `VITE_WS_URL=wss://<api domain>/ws/{requestId}`. These are baked in at build
  time, so redeploy the frontend if the API domain changes. Generate a public
  domain on port 4173.

Create the API's domain first, since the frontend build needs it.

## Training the model

`analysis/` is a separate uv project that trains the classifier and replaces
`models/audio.pkl`; its dependencies are not part of the API. See
[analysis/README.md](analysis/README.md).
