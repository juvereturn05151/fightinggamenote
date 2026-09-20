# FightingGameNote

A web app for fighting game players to log training notes (combos,
setups) per game and character, attach optional replay video with
self-annotated mistakes, and get feedback from other players via
comments.

Full design context: `docs/SCHEMA.md`, `docs/ARCHITECTURE.md`,
`docs/ROADMAP.md`. If you're a coding agent, read `AGENTS.md` first.

## Status

**Phase 1 in progress** — local dev, no video/S3 yet. See
`docs/ROADMAP.md` for the current checklist.

## Stack

- Frontend: React (Vite) — `frontend/`
- Backend: Node.js + Express — `backend/`
- Database: PostgreSQL (Docker locally, RDS in Phase 3)
- Auth: Clerk

## Getting started (local dev)

### 1. Start Postgres

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env — fill in CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY from
# https://dashboard.clerk.com (API Keys section)

npm run migrate   # applies migrations/*.sql, including starter seed data
npm run dev        # starts on :3001
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# edit .env — fill in VITE_CLERK_PUBLISHABLE_KEY (same Clerk project,
# publishable key)

npm run dev         # starts on :5173
```

Visit http://localhost:5173. You should see the seeded Street Fighter 6
roster in the sidebar and be able to sign in (Clerk), post a note, and
comment.

## What's not built yet

- Video upload (Phase 2) — the note detail page has a placeholder
  comment marking where the player + "what I got wrong" annotation goes
- Any AWS deployment (Phase 3) — everything above is local-only
- Moderation / reporting (Phase 4)

## Repo layout

```
backend/
  src/
    index.js           Express app entrypoint
    db/pool.js          Postgres connection pool
    db/migrate.js       minimal migration runner
    middleware/auth.js  Clerk verification + local user sync
    routes/              games, notes, comments
  migrations/            *.sql files, applied in filename order
frontend/
  src/
    api.js               fetch wrapper for the backend API
    App.jsx               routes + top nav
    pages/                Feed, NoteDetail, CreateNote
docs/                     schema, architecture, roadmap
AGENTS.md                 instructions for coding agents working here
docker-compose.yml         local Postgres
```
