# iLikePdf

<p align="center">
  <img src="frontend/public/favicon.svg" width="72" alt="iLikePdf logo">
</p>

<p align="center">
  <strong>A private, self-hostable PDF workspace.</strong><br>
  Edit, convert, sign, redact and automate PDFs without sending your documents to a third party.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-f97316"></a>
  <a href="https://github.com/Lounes-213/iLikePdf"><img alt="GitHub" src="https://img.shields.io/github/stars/Lounes-213/iLikePdf?style=social"></a>
</p>

iLikePdf is a complete PDF workstation: a React + TypeScript front end, a Spring Boot engine, and an optional Cloudflare Worker that adds Google sign-in, a token balance and card/PayPal top-ups. It runs entirely on your machine or your own server, so files never leave infrastructure you control.

---

## Highlights

- **50+ tools** — merge, split, rotate, compress, OCR, redact, watermark, sign, compare, convert to and from Office, images, HTML and more.
- **Private by default** — the backend is stateless; processing happens in memory or temporary storage on your own host.
- **Desktop-class file handling** — upload a PDF once and chain tools without re-uploading; the browser keeps files in IndexedDB with memory-safe cleanup.
- **Automation** — build no-code pipelines and call the REST API for every tool.
- **Your interface, your language** — 40+ locales, full dark/light theming, orange brand identity.
- **Accounts and tokens (optional)** — Google sign-in, a shared token ledger in Cloudflare D1, and top-ups through Stripe or PayPal.

## Quick start

Requirements: **JDK 25** (Gradle downloads it automatically) and Node.js 20+.

```bash
# Backend — http://localhost:8080
./gradlew :stirling-pdf:bootRun

# Frontend — http://localhost:5173 (proxies /api to the backend)
cd frontend
npm install
npx vite --mode proprietary
```

Or use the task runner:

```bash
task dev          # backend + frontend
task test         # backend + frontend + engine
task check        # lint, typecheck, tests
```

Open <http://localhost:5173>. Login is off by default; every tool works without an account.

## Accounts, tokens and payments

Accounts are optional and live in `cloudflare/auth-worker` (Workers + D1). When `VITE_AUTH_WORKER_URL` is set, the app asks for a Google session and charges tokens per run:

| Action | Cost |
| --- | --- |
| PDF tool run | 1 token |
| AI-assisted run | 5 tokens |
| New account | 50 free tokens |

Token packs and prices live in `cloudflare/auth-worker/src/index.ts`; the ledger, session handling, Stripe Checkout and PayPal Orders v2 capture all run in the Worker. See [`cloudflare/auth-worker/README.md`](cloudflare/auth-worker/README.md) for deployment.

Without the Worker URL the app stays fully offline: no sign-in, no metering, no external calls.

## Architecture

| Layer | Stack | Location |
| --- | --- | --- |
| Web app | React, TypeScript, Vite, Mantine, Tailwind | `frontend/` |
| PDF engine | Spring Boot 4, PDFBox, LibreOffice, Tesseract | `app/` |
| AI engine | FastAPI + Pydantic AI | `engine/` |
| Accounts | Cloudflare Worker, D1, Google GIS | `cloudflare/auth-worker/` |
| Desktop shell | Tauri (Rust) | `frontend/src-tauri/` |

The front end talks to the Java backend through `/api/v1/*`; Vite proxies that path in development. Files are held client-side and streamed to the backend per operation.

## Repository layout

```
app/            Spring Boot modules (core, common, proprietary, saas, desktop)
frontend/       React editor, tool registry, i18n, icons and brand assets
cloudflare/     Google auth + token ledger + payments Worker (D1 schema included)
engine/         Optional Python reasoning service
docs/           Developer, security and API documentation
site/           Static landing page deployed to Cloudflare Pages
```

## Development

- `task --list` shows every command.
- `task backend:check`, `task frontend:check`, `task engine:check` are the quality gates.
- `task format` applies Google Java Format, Prettier and Ruff.
- Translations live in `frontend/public/locales/`; update `en-US` only.

Read [`AGENTS.md`](AGENTS.md) and the [`Developer Guide`](docs/developer/DeveloperGuide.md) before larger changes.

## Security

- No analytics, telemetry or update pings are enabled.
- The backend is stateless and processes documents in memory or temp storage.
- Worker secrets (Google client ID, Stripe/PayPal keys, session signing key) stay in Cloudflare, never in the repo.
- Sessions are signed JWTs stored in `localStorage`; deploy the Worker on HTTPS and keep the client bundle trusted.

Report issues privately by opening a security advisory on GitHub.

## License

MIT — see [`LICENSE`](LICENSE).

iLikePdf is derived from the open-source Stirling PDF project and keeps its MIT license and attribution. Branding, name and UI are original to this fork.
