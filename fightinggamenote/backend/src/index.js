import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';

import { router as gamesRouter } from './routes/games.js';
import { router as notesRouter } from './routes/notes.js';
import { router as commentsRouter } from './routes/comments.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json());
app.use(clerkMiddleware()); // attaches req.auth; doesn't block unauthenticated requests

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/games', gamesRouter);
app.use('/notes', notesRouter);
app.use('/comments', commentsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT ?? 3001;
app.listen(port, () => console.log(`API listening on :${port}`));
