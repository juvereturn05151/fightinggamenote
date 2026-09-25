import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from './index.js';

async function withApp(app, callback) {
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

test('Supabase-only configuration starts without constructing Clerk middleware', async () => {
  const app = createApp({
    env: { FRONTEND_URL: 'http://localhost:5173' },
    createClerkMiddleware: () => {
      throw new Error('Clerk middleware must not be constructed without keys');
    },
  });

  await withApp(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });
});

test('configured Clerk fallback registers and runs Clerk middleware', async () => {
  let receivedOptions;
  let middlewareCalls = 0;
  const app = createApp({
    env: {
      FRONTEND_URL: 'http://localhost:5173',
      CLERK_PUBLISHABLE_KEY: 'pk_test_example',
      CLERK_SECRET_KEY: 'sk_test_example',
    },
    createClerkMiddleware: (options) => {
      receivedOptions = options;
      return (req, res, next) => {
        middlewareCalls += 1;
        next();
      };
    },
  });

  await withApp(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
  });

  assert.deepEqual(receivedOptions, {
    publishableKey: 'pk_test_example',
    secretKey: 'sk_test_example',
  });
  assert.equal(middlewareCalls, 1);
});
