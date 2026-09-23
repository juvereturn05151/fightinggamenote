# Roadmap

Ordered so app logic is validated locally before any AWS complexity is
introduced — keeps "is my code right" and "is my AWS config right" as
separate debugging problems.

## Phase 1 — Local, no AWS

- [ ] Postgres schema (see `docs/SCHEMA.md`) as migrations, running locally
      (Docker)
- [ ] API: CRUD for Note, nested Comment (with one-level threading), basic
      auth (email/password or JWT)
- [ ] Frontend: note feed, note detail, create/edit note form — **no video
      yet**
- [x] Private-by-default notes, public feed, owner-only My Notes, and
      owner-controlled visibility changes
- [ ] Game/Character seed data for at least one game, to unblock note
      creation
- **Exit criteria**: can create an account, create a standalone note
  scoped to a game+character, comment on it, all running locally.

## Phase 2 — Video, still local

- [x] YouTube URL attachment wired into the note-creation flow; legacy local
      uploads remain playable
- [x] Video detail view with a single note-level comment thread
- **Exit criteria**: can attach a YouTube video to a note and see it play back,
  locally, while existing local uploads continue to work.

## Phase 3 — Move to AWS (see `docs/ARCHITECTURE.md` for details)

- [ ] RDS Postgres, cut over from local DB
- [ ] Validate YouTube embedding in the deployed environment; no S3 upload
      infrastructure is needed for the current video approach
- [ ] Backend deployed (Elastic Beanstalk)
- [ ] Frontend deployed (Amplify / S3+CloudFront)
- [ ] Auth wired against deployed app (Cognito or alternative)
- **Exit criteria**: app is live on the internet, video upload goes
  straight to S3, playback via CloudFront.

## Phase 4 — Community/moderation polish

- [x] Public Note/Comment likes with permanent lifetime reputation awards
- [ ] Report button + basic admin review/hide flow
- [ ] Video thumbnail generation (Lambda+MediaConvert, or simpler
      client-side generation as v1)
- [ ] Revisit: user-submitted game/character additions, with moderation

## Explicitly not yet scheduled

- Move-list/frame-data structured data beyond free-text note body
- Serverless API refactor
- Mobile app
