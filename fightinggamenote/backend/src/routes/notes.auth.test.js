import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { createGetNoteHandler } from './notes.js';

const INTERNAL_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function withNotesApp({ dbUser, query }, callback) {
  const app = express();
  const optionalAuth = (req, res, next) => {
    req.dbUser = dbUser;
    next();
  };
  app.get(
    '/notes/:id',
    optionalAuth,
    createGetNoteHandler({ query })
  );

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('private-note access is authorized with the internal users.id', async () => {
  let queryText;
  let queryParams;
  await withNotesApp(
    {
      dbUser: { id: INTERNAL_USER_ID },
      query: async (sql, params) => {
        queryText = sql;
        queryParams = params;
        return {
          rows:
            params[1] === INTERNAL_USER_ID
              ? [{ id: 'private-note', visibility: 'private', is_owner: true }]
              : [],
        };
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/notes/private-note`);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).is_owner, true);
    }
  );

  assert.match(queryText, /OR notes\.user_id = \$2/);
  assert.doesNotMatch(queryText, /clerk_user_id|supabase_user_id/);
  assert.deepEqual(queryParams, ['private-note', INTERNAL_USER_ID]);
});

test('public note access remains available without authentication', async () => {
  await withNotesApp(
    {
      dbUser: null,
      query: async (sql, params) => {
        assert.match(sql, /notes\.visibility = 'public'/);
        assert.equal(params[1], null);
        return {
          rows: [{ id: 'public-note', visibility: 'public', is_owner: false }],
        };
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/notes/public-note`);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).visibility, 'public');
    }
  );
});
