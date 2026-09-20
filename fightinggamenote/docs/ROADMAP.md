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
- [ ] Game/Character seed data for at least one game, to unblock note
      creation
- **Exit criteria**: can create an account, create a standalone note
  scoped to a game+character, comment on it, all running locally.

## Phase 2 — Video, still local

- [ ] Local file upload (disk storage is fine for now) wired into the
      note-creation flow
- [ ] Video detail view: player, "what I got wrong" annotation field,
      comment thread
- **Exit criteria**: can attach a video to a note and see it play back,
  locally, no S3 yet.

## Phase 3 — Move to AWS (see `docs/ARCHITECTURE.md` for details)

- [ ] RDS Postgres, cut over from local DB
- [ ] S3 + IAM presigned upload flow, cut over from local disk storage
- [ ] Backend deployed (Elastic Beanstalk)
- [ ] Frontend deployed (Amplify / S3+CloudFront)
- [ ] Auth wired against deployed app (Cognito or alternative)
- **Exit criteria**: app is live on the internet, video upload goes
  straight to S3, playback via CloudFront.

## Phase 4 — Community/moderation polish

- [ ] Report button + basic admin review/hide flow
- [ ] Video thumbnail generation (Lambda+MediaConvert, or simpler
      client-side generation as v1)
- [ ] Revisit: user-submitted game/character additions, with moderation

## Explicitly not yet scheduled

- Move-list/frame-data structured data beyond free-text note body
- Serverless API refactor
- Mobile app
