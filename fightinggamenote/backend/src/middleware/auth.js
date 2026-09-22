// Wraps Clerk's requireAuth/getAuth with a step that ensures a matching
// row exists in our own `users` table (keyed by clerk_user_id), so the
// rest of the app can just join against users.id like any normal FK.
//
// NOTE: session token claims (getAuth(req).sessionClaims) do NOT include
// email/username by default — that needs custom claims configured in
// the Clerk dashboard. Rather than depend on that being set up, we call
// Clerk's Backend API directly (clerkClient.users.getUser) the first
// time we see a given user, then cache the result locally so we don't
// pay that round-trip on every request afterward.

import { getAuth, clerkClient } from '@clerk/express';
import { pool } from '../db/pool.js';

export async function syncUser(req, res, next) {
  try {
    const { userId: clerkUserId } = getAuth(req);

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Fast path: already synced locally, skip the Clerk API call.
    const existing = await pool.query(
      'SELECT id, username, email, avatar_url FROM users WHERE clerk_user_id = $1',
      [clerkUserId]
    );
    if (existing.rows.length > 0) {
      req.dbUser = existing.rows[0];
      return next();
    }

    // First time seeing this user — fetch their real profile from Clerk.
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const email =
      clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress ?? null;

    if (!email) {
      return res.status(400).json({
        error: 'Your Clerk account has no email on file — cannot create a profile.',
      });
    }

    const username = clerkUser.username ?? email.split('@')[0];

    const { rows } = await pool.query(
      `INSERT INTO users (clerk_user_id, username, email, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (clerk_user_id) DO UPDATE
         SET email = EXCLUDED.email, username = EXCLUDED.username
       RETURNING id, username, email, avatar_url`,
      [clerkUserId, username, email, clerkUser.imageUrl ?? null]
    );

    req.dbUser = rows[0];
    next();
  } catch (err) {
    next(err); // let Express's error handler respond with 500 instead of crashing the process
  }
}