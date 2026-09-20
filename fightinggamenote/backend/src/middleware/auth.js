// Wraps Clerk's requireAuth/getAuth with a step that ensures a matching
// row exists in our own `users` table (keyed by clerk_user_id), so the
// rest of the app can just join against users.id like any normal FK
// without reaching into Clerk on every request.

import { getAuth } from '@clerk/express';
import { pool } from '../db/pool.js';

export async function syncUser(req, res, next) {
  const { userId: clerkUserId, sessionClaims } = getAuth(req);

  if (!clerkUserId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // sessionClaims content depends on your Clerk session token
  // customization — adjust field names to match your Clerk dashboard
  // config. These are reasonable defaults for a fresh Clerk project.
  const email = sessionClaims?.email ?? null;
  const username =
    sessionClaims?.username ?? (email ? email.split('@')[0] : clerkUserId);

  const { rows } = await pool.query(
    `INSERT INTO users (clerk_user_id, username, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (clerk_user_id) DO UPDATE
       SET email = EXCLUDED.email
     RETURNING id, username, email, avatar_url`,
    [clerkUserId, username, email]
  );

  req.dbUser = rows[0];
  next();
}
