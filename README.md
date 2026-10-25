# iLikePdf

<p align="center">
  <img src="frontend/public/favicon.svg" width="72" alt="iLikePdf logo">
</p>

<p align="center">
  <strong>A 100% Free, Private, and Self-Hostable PDF Workspace.</strong><br>
  Edit, convert, split, merge, compress, sign, redact, and automate PDFs without login, tracking, or paywalls.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-f97316"></a>
  <a href="https://github.com/Lounes-213/iLikePdf"><img alt="GitHub" src="https://img.shields.io/github/stars/Lounes-213/iLikePdf?style=social"></a>
</p>

**iLikePdf** is a lightweight, privacy-focused alternative to web PDF suites like iLovePDF. It combines a modern **React + Vite** frontend with a robust **Spring Boot** processing engine.

All tools are **unlimited and free**—no sign-in required, no accounts, no token limits, and no external tracking.

---

## Key Features

- **50+ PDF Tools** — Merge, split, rotate, compress, OCR, sign, redact, watermark, and convert between PDF, Office, images, HTML, and more.
- **Zero Login & No Accounts** — Instant access to every single tool. No passwords, no sign-ups, and no paywalls.
- **100% Private** — Documents are processed in-memory or on your own self-hosted infrastructure. Files never leave your control.
- **Client-Side File Management** — Upload documents once and chain tools seamlessly using IndexedDB caching.
- **Multi-Language Support** — 40+ languages with full light and dark mode.
- **Deploy Anywhere** — Run locally, host on Docker, or deploy the web interface to Cloudflare Workers / Pages with a secure backend tunnel.

---

## Live Deployments

| Surface | Deployment | Description |
| --- | --- | --- |
| **App** | [https://ilikepdf-app.ilikepdf.workers.dev](https://ilikepdf-app.ilikepdf.workers.dev) | The full interactive PDF web app |
| **Landing Site (Cloudflare)** | [https://ilikepdf-site.ilikepdf.workers.dev](https://ilikepdf-site.ilikepdf.workers.dev) | Static introduction and feature page |
| **Landing Site (GitHub Pages)** | [https://lounes-213.github.io/iLikePdf/](https://lounes-213.github.io/iLikePdf/) | Static introduction deployed via GitHub Pages |

---

## Quick Start (Local Development)

### Prerequisites

- **JDK 25** (Gradle handles download if needed)
- **Node.js 20+** and `npm`

### 1. Run the Backend

```bash
# Starts Spring Boot on http://localhost:8080
./gradlew :stirling-pdf:bootRun
```

### 2. Run the Frontend

```bash
cd frontend
npm install
npx vite
```

Open [http://localhost:5173](http://localhost:5173). The frontend automatically proxies `/api` calls to the local backend at `http://localhost:8080`.

---

## Deploying to Cloudflare & GitHub

### 1. Push to GitHub

```bash
git add .
git commit -m "Update iLikePdf: remove login and D1, clean standalone app"
git push origin main
```

Repository: [https://github.com/Lounes-213/iLikePdf](https://github.com/Lounes-213/iLikePdf)

### 2. Deploy Web App to Cloudflare

The web application frontend can be built and deployed directly to Cloudflare Workers Static Assets or Cloudflare Pages:

```bash
# Build frontend
cd frontend
npm run build

# Deploy via Cloudflare Worker Static Assets
cd ../cloudflare/app-worker
npx wrangler deploy
```

*(Alternatively, via Cloudflare Pages: `npx wrangler pages deploy frontend/dist --project-name ilikepdf-app`)*

### 3. Deploy Landing Page to Cloudflare

```bash
cd cloudflare/site-worker
npx wrangler deploy
```

*(Or via Cloudflare Pages: `npx wrangler pages deploy site --project-name ilikepdf-site`)*

### 4. Connect Cloudflare to your Backend

For remote deployments, expose your self-hosted Spring Boot backend securely to your Cloudflare frontend using **Cloudflare Tunnel** (`cloudflared`):

```bash
# Install cloudflared and route backend port 8080 to your domain
cloudflared tunnel run <tunnel-name>
```

Then configure `VITE_API_BASE_URL` in `frontend/.env.local` to point to your secure backend URL and rebuild.

---

## Architecture Overview

```
├── app/                  # Spring Boot PDF processing engine (PDFBox, LibreOffice, OCR)
├── frontend/             # React + Vite web application (Editor, UI, Tools, i18n)
├── cloudflare/
│   ├── app-worker/       # Cloudflare Worker serving the frontend web app
│   └── site-worker/      # Cloudflare Worker serving the static landing page
├── engine/               # Optional Python reasoning service
└── site/                 # Static marketing and landing page
```

---

## License

This project is licensed under the **MIT License** — see [`LICENSE`](LICENSE) for details.

iLikePdf is derived from Stirling-PDF with independent UI branding, streamlined architecture, and full removal of account / token gates.
