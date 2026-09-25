import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAuthHandlers,
  AuthHttpError,
  isClerkConfigured,
} from './auth.js';
import { SupabaseAuthError } from '../auth/supabase.js';

const SUPABASE_ID = '11111111-1111-4111-8111-111111111111';

function fakeDb(initialUsers = []) {
  const users = initialUsers.map((user) => ({ ...user }));

  return {
    users,
    async query(sql, params) {
      if (sql.includes('WHERE supabase_user_id = $1')) {
        return {
          rows: users.filter((user) => user.supabase_user_id === params[0]),
        };
      }
      if (sql.includes('WHERE clerk_user_id = $1')) {
        return {
          rows: users.filter((user) => user.clerk_user_id === params[0]),
        };
      }
      if (sql.includes('WHERE lower(email) = lower($1)')) {
        return {
          rows: users
            .filter(
              (user) => user.email.toLowerCase() === params[0].toLowerCase()
            )
            .map(({ id }) => ({ id })),
        };
      }
      if (sql.includes('INSERT INTO users (supabase_user_id')) {
        const [supabaseUserId, username, email] = params;
        const conflict = users.some(
          (user) =>
            user.supabase_user_id === supabaseUserId ||
            user.username === username ||
            user.email === email
        );
        if (conflict) return { rows: [] };

        const user = {
          id: `internal-${users.length + 1}`,
          supabase_user_id: supabaseUserId,
          clerk_user_id: null,
          username,
          email,
          avatar_url: null,
        };
        users.push(user);
        return { rows: [user] };
      }
      if (sql.includes('INSERT INTO users (clerk_user_id')) {
        const [clerkUserId, username, email, avatarUrl] = params;
        const user = {
          id: `internal-${users.length + 1}`,
          clerk_user_id: clerkUserId,
          supabase_user_id: null,
          username,
          email,
          avatar_url: avatarUrl,
        };
        users.push(user);
        return { rows: [user] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
}

function requestWithToken(token = 'valid-token') {
  return {
    headers: { authorization: `Bearer ${token}` },
    get(name) {
      return this.headers[name.toLowerCase()];
    },
  };
}

function supabaseIdentity(token = 'valid-token') {
  return {
    provider: 'supabase',
    providerUserId: SUPABASE_ID,
    email: 'newuser@example.com',
    token,
  };
}

test('valid Supabase identity resolves to its mapped internal user', async () => {
  const mapped = {
    id: 'internal-existing',
    supabase_user_id: SUPABASE_ID,
    clerk_user_id: null,
    username: 'mapped',
    email: 'mapped@example.com',
    avatar_url: null,
  };
  const db = fakeDb([mapped]);
  const handlers = createAuthHandlers({
    db,
    verifySupabaseToken: async () => supabaseIdentity(),
    clerkEnabled: false,
    getSupabaseUser: async () => {
      throw new Error('mapped users must not call the Supabase user endpoint');
    },
    getClerkUserId: () => {
      throw new Error('Supabase-only auth must not call Clerk getAuth');
    },
    getClerkUser: async () => {
      throw new Error('Supabase-only auth must not call Clerk APIs');
    },
  });

  assert.deepEqual(await handlers.resolveUser(requestWithToken()), mapped);
});

test('unmapped confirmed Supabase user gets a collision-safe username', async () => {
  const db = fakeDb([
    {
      id: 'internal-existing',
      clerk_user_id: 'clerk_existing',
      supabase_user_id: null,
      username: 'newuser',
      email: 'someone@example.com',
      avatar_url: null,
    },
  ]);
  const handlers = createAuthHandlers({
    db,
    verifySupabaseToken: async () => supabaseIdentity(),
    getSupabaseUser: async () => ({
      id: SUPABASE_ID,
      email: 'NewUser@example.com',
      email_confirmed_at: '2026-09-25T00:00:00Z',
      is_anonymous: false,
    }),
    getClerkUserId: () => null,
  });

  const user = await handlers.resolveUser(requestWithToken());
  assert.equal(user.id, 'internal-2');
  assert.equal(user.username, 'newuser_11111111');
  assert.equal(user.email, 'newuser@example.com');
  assert.equal(user.supabase_user_id, SUPABASE_ID);
});

test('matching email never claims an existing Clerk-linked row', async () => {
  const existing = {
    id: 'internal-clerk',
    clerk_user_id: 'clerk_existing',
    supabase_user_id: null,
    username: 'existing',
    email: 'same@example.com',
    avatar_url: null,
  };
  const db = fakeDb([existing]);
  const handlers = createAuthHandlers({
    db,
    verifySupabaseToken: async () => supabaseIdentity(),
    getSupabaseUser: async () => ({
      id: SUPABASE_ID,
      email: 'Same@example.com',
      email_confirmed_at: '2026-09-25T00:00:00Z',
      is_anonymous: false,
    }),
    getClerkUserId: () => null,
  });

  await assert.rejects(
    () => handlers.resolveUser(requestWithToken()),
    (error) => error instanceof AuthHttpError && error.status === 409
  );
  assert.equal(db.users.length, 1);
  assert.equal(db.users[0].supabase_user_id, null);
});

test('unconfirmed Supabase user is rejected before local provisioning', async () => {
  const db = fakeDb();
  const handlers = createAuthHandlers({
    db,
    verifySupabaseToken: async () => supabaseIdentity(),
    getSupabaseUser: async () => ({
      id: SUPABASE_ID,
      email: 'newuser@example.com',
      email_confirmed_at: null,
      is_anonymous: false,
    }),
    getClerkUserId: () => null,
  });

  await assert.rejects(
    () => handlers.resolveUser(requestWithToken()),
    (error) => error instanceof AuthHttpError && error.status === 403
  );
  assert.equal(db.users.length, 0);
});

test('existing Clerk identity still resolves during the transition', async () => {
  const mapped = {
    id: 'internal-clerk',
    clerk_user_id: 'clerk_existing',
    supabase_user_id: null,
    username: 'clerk-user',
    email: 'clerk@example.com',
    avatar_url: null,
  };
  const handlers = createAuthHandlers({
    db: fakeDb([mapped]),
    verifySupabaseToken: async () => {
      throw new SupabaseAuthError('Not a Supabase token');
    },
    clerkEnabled: true,
    getClerkUserId: () => 'clerk_existing',
    getClerkUser: async () => {
      throw new Error('mapped Clerk users must not call Clerk');
    },
  });

  assert.deepEqual(
    await handlers.resolveUser(requestWithToken('clerk-token')),
    mapped
  );
});

test('unmapped Clerk identity keeps the existing Clerk provisioning flow', async () => {
  const db = fakeDb();
  const handlers = createAuthHandlers({
    db,
    clerkEnabled: true,
    getClerkUserId: () => 'clerk_new',
    getClerkUser: async () => ({
      primaryEmailAddressId: 'email_1',
      emailAddresses: [
        { id: 'email_1', emailAddress: 'new-clerk@example.com' },
      ],
      username: 'new-clerk',
      imageUrl: 'https://example.com/avatar.png',
    }),
  });

  const user = await handlers.resolveUser({ headers: {} });
  assert.equal(user.clerk_user_id, 'clerk_new');
  assert.equal(user.username, 'new-clerk');
  assert.equal(user.email, 'new-clerk@example.com');
});

test('Clerk is enabled only when both environment keys exist', () => {
  assert.equal(isClerkConfigured({}), false);
  assert.equal(
    isClerkConfigured({ CLERK_PUBLISHABLE_KEY: 'pk_test_example' }),
    false
  );
  assert.equal(
    isClerkConfigured({ CLERK_SECRET_KEY: 'sk_test_example' }),
    false
  );
  assert.equal(
    isClerkConfigured({
      CLERK_PUBLISHABLE_KEY: 'pk_test_example',
      CLERK_SECRET_KEY: 'sk_test_example',
    }),
    true
  );
});

test('public auth resolution does not touch Clerk when it is disabled', async () => {
  const handlers = createAuthHandlers({
    db: fakeDb(),
    clerkEnabled: false,
    getClerkUserId: () => {
      throw new Error('Clerk getAuth must not be called');
    },
    getClerkUser: async () => {
      throw new Error('Clerk client APIs must not be called');
    },
  });

  assert.equal(await handlers.resolveUser({ headers: {} }), null);
});
