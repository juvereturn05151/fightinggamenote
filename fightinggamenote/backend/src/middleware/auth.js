import { getAuth, clerkClient } from '@clerk/express';
import { pool } from '../db/pool.js';
import {
  fetchSupabaseUser,
  SupabaseAuthError,
  verifySupabaseAccessToken,
} from '../auth/supabase.js';

const LOCAL_USER_FIELDS = 'id, username, email, avatar_url';

export function isClerkConfigured(env = process.env) {
  return Boolean(env.CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY);
}

export class AuthHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AuthHttpError';
    this.status = status;
  }
}

function bearerToken(req) {
  const header = req.get?.('authorization') ?? req.headers?.authorization;
  if (!header) return null;

  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  return match?.[1] ?? null;
}

function usernameBase(email) {
  const localPart = email.split('@')[0].normalize('NFKC').toLowerCase();
  const sanitized = localPart
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
    .slice(0, 40);
  return sanitized || 'fighter';
}

async function resolveSupabaseUser(identity, { db, getSupabaseUser }) {
  const existing = await db.query(
    `SELECT ${LOCAL_USER_FIELDS}
     FROM users
     WHERE supabase_user_id = $1`,
    [identity.providerUserId]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const supabaseUser = await getSupabaseUser(identity.token);
  if (
    supabaseUser?.id !== identity.providerUserId ||
    supabaseUser?.is_anonymous === true ||
    !supabaseUser?.email_confirmed_at ||
    typeof supabaseUser?.email !== 'string' ||
    !supabaseUser.email.includes('@')
  ) {
    throw new AuthHttpError(
      403,
      'A confirmed, non-anonymous Supabase email is required'
    );
  }

  const email = supabaseUser.email.trim().toLowerCase();
  const emailCollision = await db.query(
    'SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1',
    [email]
  );
  if (emailCollision.rows.length > 0) {
    throw new AuthHttpError(
      409,
      'An account with this email already exists; accounts are not linked automatically'
    );
  }

  const base = usernameBase(email);
  const idSuffix = identity.providerUserId.replaceAll('-', '').slice(0, 8);

  // ON CONFLICT handles concurrent first requests and username collisions.
  // Email is checked independently and is never used to claim an existing row.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const username =
      attempt === 0
        ? base
        : `${base}_${idSuffix}${attempt === 1 ? '' : `_${attempt}`}`;
    const inserted = await db.query(
      `INSERT INTO users (supabase_user_id, username, email, avatar_url)
       VALUES ($1, $2, $3, NULL)
       ON CONFLICT DO NOTHING
       RETURNING ${LOCAL_USER_FIELDS}`,
      [identity.providerUserId, username, email]
    );
    if (inserted.rows.length > 0) return inserted.rows[0];

    const concurrentIdentity = await db.query(
      `SELECT ${LOCAL_USER_FIELDS}
       FROM users
       WHERE supabase_user_id = $1`,
      [identity.providerUserId]
    );
    if (concurrentIdentity.rows.length > 0) {
      return concurrentIdentity.rows[0];
    }

    const concurrentEmail = await db.query(
      'SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1',
      [email]
    );
    if (concurrentEmail.rows.length > 0) {
      throw new AuthHttpError(
        409,
        'An account with this email already exists; accounts are not linked automatically'
      );
    }
  }

  throw new AuthHttpError(409, 'Unable to create a unique username');
}

async function resolveClerkUser(clerkUserId, { db, getClerkUser }) {
  const existing = await db.query(
    `SELECT ${LOCAL_USER_FIELDS}
     FROM users
     WHERE clerk_user_id = $1`,
    [clerkUserId]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  // Preserve the existing Clerk provisioning behavior during the transition.
  const clerkUser = await getClerkUser(clerkUserId);
  const email =
    clerkUser.emailAddresses.find(
      (entry) => entry.id === clerkUser.primaryEmailAddressId
    )?.emailAddress ?? null;

  if (!email) {
    throw new AuthHttpError(
      400,
      'Your Clerk account has no email on file — cannot create a profile.'
    );
  }

  const username = clerkUser.username ?? email.split('@')[0];
  const { rows } = await db.query(
    `INSERT INTO users (clerk_user_id, username, email, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (clerk_user_id) DO UPDATE
       SET email = EXCLUDED.email, username = EXCLUDED.username
     RETURNING ${LOCAL_USER_FIELDS}`,
    [clerkUserId, username, email, clerkUser.imageUrl ?? null]
  );
  return rows[0];
}

function sendAuthError(error, res, next) {
  if (error instanceof AuthHttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error instanceof SupabaseAuthError) {
    return res.status(401).json({ error: error.message });
  }
  return next(error);
}

export function createAuthHandlers({
  db = pool,
  verifySupabaseToken = verifySupabaseAccessToken,
  getSupabaseUser = fetchSupabaseUser,
  clerkEnabled = isClerkConfigured(),
  getClerkUserId = (req) => getAuth(req).userId,
  getClerkUser = (userId) => clerkClient.users.getUser(userId),
} = {}) {
  async function resolveUser(req) {
    const token = bearerToken(req);
    let supabaseError = null;

    if (token) {
      try {
        const identity = await verifySupabaseToken(token);
        return resolveSupabaseUser(identity, { db, getSupabaseUser });
      } catch (error) {
        if (!(error instanceof SupabaseAuthError)) throw error;
        supabaseError = error;
      }
    }

    if (clerkEnabled) {
      let clerkUserId = null;
      try {
        clerkUserId = getClerkUserId(req) ?? null;
      } catch {
        // A non-Clerk bearer token can make Clerk report a failed auth state.
        // The verified Supabase path above remains authoritative for that token.
      }

      if (clerkUserId) {
        return resolveClerkUser(clerkUserId, { db, getClerkUser });
      }
    }

    if (token && supabaseError) throw supabaseError;
    return null;
  }

  async function optionalAuthenticatedUser(req, res, next) {
    try {
      req.dbUser = await resolveUser(req);
      return next();
    } catch (error) {
      return sendAuthError(error, res, next);
    }
  }

  async function requireAuthenticatedUser(req, res, next) {
    try {
      req.dbUser = await resolveUser(req);
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      return next();
    } catch (error) {
      return sendAuthError(error, res, next);
    }
  }

  return {
    optionalAuthenticatedUser,
    requireAuthenticatedUser,
    resolveUser,
  };
}

export const {
  optionalAuthenticatedUser,
  requireAuthenticatedUser,
  resolveUser,
} = createAuthHandlers();
