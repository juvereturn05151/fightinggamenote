import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import multer from 'multer';

import { router as gamesRouter } from './routes/games.js';
import { router as notesRouter } from './routes/notes.js';
import { router as commentsRouter } from './routes/comments.js';
import { router as videosRouter } from './routes/videos.js';
import { router as likesRouter } from './routes/likes.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json());
app.use(clerkMiddleware()); // attaches req.auth; doesn't block unauthenticated requests

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

const port = process.env.PORT ?? 3001;
app.listen(port, () => console.log(`API listening on :${port}`));
