# Architecture

Goal: a straightforward, learnable AWS setup — not the most "correct"
enterprise architecture. Optimized for understanding each piece as it's
added, not for minimizing services touched.

## Services

| Concern           | Service                                  | Notes |
|--------------------|-------------------------------------------|-------|
| Database           | RDS (PostgreSQL)                          | Start local via Docker, migrate to RDS in Phase 3 |
| Video hosting       | YouTube                                    | New replays are attached by URL; only the validated video ID is stored |
| Video delivery      | YouTube embed player                       | Embed URL is constructed by the frontend from the stored ID |
| Legacy video storage | Local disk                                | Existing uploads and streaming route remain available during transition |
| Auth                | Clerk                                      | Backend uses `requireAuth()` then `syncUser` for authenticated writes |
| Backend hosting     | Elastic Beanstalk (MVP), ECS Fargate (later if wanted) | EB is the gentler on-ramp |
| Frontend hosting    | Amplify Hosting, or S3 + CloudFront directly | Amplify wraps the S3+CloudFront setup |
| IAM                 | Scoped role/policy for presigned S3 uploads | Backend generates presigned URLs, never routes video bytes through the app server |

## YouTube attachment flow (video)

1. The player creates a Note, optionally providing a YouTube replay URL.
2. The frontend calls the authenticated attachment endpoint for that Note.
3. The backend verifies Note ownership, strictly validates the YouTube host
   and URL shape, extracts the canonical video ID, and stores only that ID.
4. The note detail page constructs a `youtube-nocookie.com/embed/<id>` URL
   from the stored ID. The app never accepts iframe HTML or downloads,
   proxies, or uploads the YouTube video bytes.

Existing local-video records, files, upload middleware, and byte-range
streaming route are retained for compatibility until a separate migration
review is performed. YouTube visibility is independent of Note visibility;
an unlisted video is not private, and embedding depends on the video's
YouTube settings.

## Note visibility and authorization

Public feed queries select only `visibility = 'public'`. Detail, video, and
comment endpoints allow public content or match the authenticated Clerk user
to the Note owner. Owner-only endpoints use `requireAuth()` followed by
`syncUser` and compare `req.dbUser.id` with `notes.user_id`. Private legacy
videos are fetched with a Clerk token in the Authorization header; credentials
are never placed in playback URLs.

## Likes and lifetime reputation

Active Note and Comment likes are separate from permanent reputation awards.
Authenticated like routes lock the public parent Note, insert the active like,
and attempt the fixed server-defined ledger award in one transaction. Database
primary keys and the ledger's unique award key make duplicate and concurrent
requests idempotent. Unlike operations delete only the active-like row.

## Why not serverless-first

Lambda-per-endpoint (API Gateway + Lambda) is a legitimate architecture,
but it adds cold-start/packaging/local-dev-parity complexity on top of
everything else being learned simultaneously (RDS, S3, IAM, Cognito).
Recommendation: ship the API on Elastic Beanstalk first, revisit
serverless as a later refactor once the rest of the stack is familiar.

## Deployment order (maps to ROADMAP.md Phase 3)

1. RDS Postgres up, app points at it instead of local DB
2. Confirm the YouTube embed flow and legacy local playback in production
3. Backend deployed (Elastic Beanstalk)
4. Frontend deployed (Amplify or S3+CloudFront)
5. Auth wired against the deployed app (Cognito or chosen alternative)
6. CloudFront in front of S3 for playback

## Explicitly deferred / out of scope for MVP

- Self-hosted video transcoding/multiple-resolution playback
- Autoscaling tuning
- Multi-region anything
- Serverless API refactor
