# Frontend (Svelte)

Single-page frontend to record or upload a voice sample and follow its analysis.

- `/` — record a take with the microphone (the default tab when the browser
  supports it) or upload a file. Uploads are limited to WAV.
- `/analysis/{requestId}` — waits for the result of that upload and shows it
  with the voice measurements.

## Requirements

- Node.js 20+

## Run

```bash
npm install
npm run dev
```

## API integration

- Upload endpoint: `POST http://localhost:8000/audios`
- WebSocket endpoint: `ws://localhost:8000/ws/{requestId}`

The app uses these environment variables (see `.env.example`):

- `VITE_API_BASE` (default: `http://localhost:8000`)
- `VITE_WS_URL` (default: `ws://localhost:8000/ws/{requestId}`): `{requestId}` is replaced with the id the upload returned; a URL without the placeholder gets the id appended to its path
- `VITE_LOCALE` (optional: `en` or `pt-BR`; if omitted or unsupported, the browser language is used)

The locale can also be switched per page load with a URL query param, for example `?lang=pt-BR` or `?locale=pt`. The query param takes precedence over `VITE_LOCALE`.
