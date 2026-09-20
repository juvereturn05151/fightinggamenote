# AGENTS.md

Instructions for coding agents (Claude Code, or similar) working in this
repository. Read this before making changes.

## What this project is

FightingGameNote — a web app where users post fighting-game training
notes (combos/setups), scoped to a specific Game and Character, with an
optional replay video and threaded comments. Full context: `README.md`,
`docs/SCHEMA.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`. Read the
relevant doc before touching schema, infra, or upload-flow code —
decisions there were made deliberately and have stated reasoning; don't
silently diverge from them.

## Current phase

Check `docs/ROADMAP.md` for the current phase and only work within it
unless explicitly asked to jump ahead. Do not introduce AWS services,
video processing, or auth providers not listed in `docs/ARCHITECTURE.md`
without flagging the change to the user first — the architecture was
chosen for learning-progression reasons (local-first, AWS piece by
piece), not just technical fit.

## Stack (see README.md for the up-to-date table)

- Frontend: React (Vite)
- Backend: Node.js + Express — decided
- Auth: Clerk (`@clerk/express` on backend, `@clerk/clerk-react` on
  frontend) — decided
- DB: PostgreSQL, local via Docker Compose in Phase 1/2, RDS in Phase 3
- Video storage: S3 via presigned URLs (never proxy video bytes through
  the app server) — not yet implemented, Phase 2/3

## Auth pattern already established

The `users` table is keyed by `clerk_user_id`. `middleware/auth.js`
(`syncUser`) upserts a local `users` row on each authenticated request
and attaches it as `req.dbUser`, so route handlers join against
`req.dbUser.id` like a normal FK — they never call out to Clerk
directly. Follow this pattern for any new authenticated route rather
than re-deriving user identity a different way.

## Conventions

- Schema changes go through `docs/SCHEMA.md` first — update the doc
  and the migration together, not the migration alone.
- `Note.game_id` is intentionally denormalized alongside
  `Note.character_id` — do not "clean this up" by removing it; see
  `docs/SCHEMA.md` for why.
- Comments use a polymorphic `(commentable_type, commentable_id)` pair
  to attach to either a Note or a Video — this is a deliberate tradeoff
  (see SCHEMA.md), not an oversight; don't silently refactor to
  per-type comment tables without flagging it.
- No fabricated fighting-game data: character rosters, move lists, or
  frame data must come from the user or an explicit real source — never
  invent plausible-looking game data as seed/placeholder content.

## What NOT to do without asking

- Don't add a new cloud service (queue, cache, serverless function,
  CDN alternative) outside what's in `docs/ARCHITECTURE.md`.
- Don't swap the DB, frontend framework, or auth provider choice.
- Don't remove the standalone-note capability (video is optional, not
  required) — this was a deliberate product decision.
- Don't skip the moderation/`Report` entity when building comment or
  video features — it's part of the MVP schema, not a later add-on.

## Open decisions the agent should surface, not resolve unilaterally

- One video per note vs many (schema currently assumes many, via
  `videos.note_id` as a plain FK rather than unique)
