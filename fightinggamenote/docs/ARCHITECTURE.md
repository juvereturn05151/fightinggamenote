# Architecture

Goal: a straightforward, learnable AWS setup — not the most "correct"
enterprise architecture. Optimized for understanding each piece as it's
added, not for minimizing services touched.

## Services

| Concern           | Service                                  | Notes |
|--------------------|-------------------------------------------|-------|
| Database           | RDS (PostgreSQL)                          | Start local via Docker, migrate to RDS in Phase 3 |
| Video storage       | S3                                        | Direct browser-to-S3 upload via presigned URLs |
| Video delivery       | CloudFront (in front of S3)             | CDN for playback |
| Video processing (later) | Lambda + MediaConvert, or client-side thumbnailing as a simpler v1 | Not required for MVP |
| Auth                | Cognito (or Clerk/Auth0 as a simpler alternative) | Undecided — see README |
| Backend hosting     | Elastic Beanstalk (MVP), ECS Fargate (later if wanted) | EB is the gentler on-ramp |
| Frontend hosting    | Amplify Hosting, or S3 + CloudFront directly | Amplify wraps the S3+CloudFront setup |
| IAM                 | Scoped role/policy for presigned S3 uploads | Backend generates presigned URLs, never routes video bytes through the app server |

## Upload flow (video)

1. Frontend requests a presigned upload URL from the backend API
   (`POST /videos/presign`), passing content-type/filename.
2. Backend generates a presigned S3 PUT URL (scoped, short-lived) and
   returns it, along with the eventual `s3_key`.
3. Frontend uploads the video file directly to S3 using that URL —
   the video bytes never pass through the app server.
4. Frontend notifies the backend the upload is complete
   (`POST /videos/:id/complete`), backend marks `Video.status = ready`
   (or triggers processing if thumbnailing/transcoding is added later).
5. Playback reads from CloudFront, not directly from S3.

This is the core "practice AWS" piece of the whole project — avoiding
routing video through the app server is what makes it a real
cloud-storage exercise rather than a toy file upload.

## Why not serverless-first

Lambda-per-endpoint (API Gateway + Lambda) is a legitimate architecture,
but it adds cold-start/packaging/local-dev-parity complexity on top of
everything else being learned simultaneously (RDS, S3, IAM, Cognito).
Recommendation: ship the API on Elastic Beanstalk first, revisit
serverless as a later refactor once the rest of the stack is familiar.

## Deployment order (maps to ROADMAP.md Phase 3)

1. RDS Postgres up, app points at it instead of local DB
2. S3 bucket + IAM policy for presigned uploads, video storage flow works end-to-end
3. Backend deployed (Elastic Beanstalk)
4. Frontend deployed (Amplify or S3+CloudFront)
5. Auth wired against the deployed app (Cognito or chosen alternative)
6. CloudFront in front of S3 for playback

## Explicitly deferred / out of scope for MVP

- Video transcoding/multiple-resolution playback
- Autoscaling tuning
- Multi-region anything
- Serverless API refactor
