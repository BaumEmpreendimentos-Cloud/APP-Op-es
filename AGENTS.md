# Base44 Dev Environment

## Stack
- **Frontend**: React 19 + Vite 8 + Tailwind CSS v4 + TypeScript
- **Backend**: Express server (`server.ts`) using Vite in middleware mode (single-origin on port 3000)
- **Database**: File-based JSON at `data/db.json` (no external DB needed)
- **Dev command**: `npx tsx server.ts` (runs Express which wraps Vite middleware for HMR)

## Setup quirks
- `npm install` requires `--legacy-peer-deps` due to a peer conflict between Vite 8 and esbuild 0.25
- The server already binds to `0.0.0.0:3000`
- `DISABLE_HMR=true` env var disables Vite HMR and file watching (set by AI Studio during agent edits)

## External services (all optional — app has fallbacks)
- `GEMINI_API_KEY`: Google Gemini AI for scenario analysis. Without it, a deterministic analysis engine is used.
- `OPLAB_ACCESS_TOKEN`: OpLab API v3 for live B3 market data. Without it, a B3 ticker parser/estimator is used.
- `APP_URL`: Self-referential URL (not required for local dev)

## Demo users (seeded in db.json)
- `trader1@b3.com.br` / `senha123`
- `trader2@b3.com.br` / `senha123`

## Verify
- Health: `curl http://localhost:3000/api/health` → `{"status":"ok",...}`
- Frontend: `curl http://localhost:3000/` → HTML with Vite client scripts
