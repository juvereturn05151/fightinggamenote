import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import multer from 'multer';

import { router as gamesRouter } from './routes/games.js';
import { router as notesRouter } from './routes/notes.js';
import { router as commentsRouter } from './routes/comments.js';
import { router as videosRouter } from './routes/videos.js';
import { router as likesRouter } from './routes/likes.js';
import { isSupabaseAccessTokenCandidate } from './auth/supabase.js';
import { isClerkConfigured } from './middleware/auth.js';

export function createApp({
  env = process.env,
  createClerkMiddleware = clerkMiddleware,
} = {}) {
  const app = express();

  app.use(cors({ origin: env.FRONTEND_URL ?? 'http://localhost:5173' }));
  app.use(express.json());

  if (isClerkConfigured(env)) {
    const authenticateWithClerk = createClerkMiddleware({
      publishableKey: env.CLERK_PUBLISHABLE_KEY,
      secretKey: env.CLERK_SECRET_KEY,
    });
    app.use((req, res, next) => {
      const bearerToken = /^Bearer\s+([^\s]+)$/i.exec(
        req.get('authorization') ?? ''
      )?.[1];

      // Supabase JWTs are verified by the provider-neutral route middleware.
      // Skipping Clerk here prevents it from trying to parse another
      // provider's token. The unverified issuer is used only for dispatch,
      // never access.
      if (isSupabaseAccessTokenCandidate(bearerToken)) return next();
      return authenticateWithClerk(req, res, next);
    });
  }

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use('/games', gamesRouter);
  app.use('/notes', notesRouter);
  app.use('/comments', commentsRouter);
  app.use('/', videosRouter);
  app.use('/', likesRouter);

  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'Video exceeds the 100 MiB upload limit',
      });
    }

    if (err.message === 'Unsupported video type') {
      return res.status(400).json({
        error: 'Only MP4 and WebM videos are supported',
      });
    }

    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

export function startServer({ env = process.env } = {}) {
  const app = createApp({ env });
  const port = env.PORT ?? 3001;
  return app.listen(port, () => console.log(`API listening on :${port}`));
}

const isMainModule =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMainModule) startServer();
