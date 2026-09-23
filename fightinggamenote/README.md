# FightingGameNote

A web app for fighting game players to log training notes (combos,
setups) per game and character, attach an optional replay video, and get
feedback from other players in the note-level comment thread.

Notes are private by default. Their creator can publish them to the public
feed, return them to private later, and see both kinds together in My Notes.
Players earn permanent lifetime reputation when other users like their public
notes and comments; removing or repeating a like cannot remove or duplicate an
award.

Full design context: `docs/SCHEMA.md`, `docs/ARCHITECTURE.md`,
`docs/ROADMAP.md`. If you're a coding agent, read `AGENTS.md` first.

## Status

**Phase 2 in progress** — local development with YouTube replay embeds and
legacy local-video playback. See `docs/ROADMAP.md` for the current checklist.

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

- Direct uploads for new replay attachments — new videos are hosted by
  YouTube and attached by URL
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
