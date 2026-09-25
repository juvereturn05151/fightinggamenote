import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from 'jose';
import {
  createSupabaseTokenVerifier,
  isSupabaseAccessTokenCandidate,
  SupabaseAuthError,
} from './supabase.js';

const ISSUER = 'https://project-ref.supabase.co/auth/v1';
const USER_ID = '11111111-1111-4111-8111-111111111111';

async function verifierFixture() {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = 'test-key';
  publicJwk.alg = 'ES256';
  const verify = createSupabaseTokenVerifier({
    issuer: ISSUER,
    audience: 'authenticated',
    jwks: createLocalJWKSet({ keys: [publicJwk] }),
  });

  const sign = (claims = {}, options = {}) => {
    let token = new SignJWT({
      role: 'authenticated',
      email: 'fighter@example.com',
      is_anonymous: false,
      ...claims,
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject(USER_ID)
      .setIssuer(options.issuer ?? ISSUER)
      .setAudience(options.audience ?? 'authenticated')
      .setIssuedAt();

    token = options.expired
      ? token.setExpirationTime('1 minute ago')
      : token.setExpirationTime('5 minutes');
    return token.sign(privateKey);
  };

  return { sign, verify };
}

test('verifies a signed Supabase token and returns its immutable subject', async () => {
  const { sign, verify } = await verifierFixture();
  const token = await sign();

  assert.deepEqual(await verify(token), {
    provider: 'supabase',
    providerUserId: USER_ID,
    email: 'fighter@example.com',
    token,
  });
});

test('rejects wrong issuer, audience, expiry, and anonymous users', async () => {
  const { sign, verify } = await verifierFixture();
  const invalidTokens = [
    await sign({}, { issuer: 'https://attacker.example/auth/v1' }),
    await sign({}, { audience: 'anon' }),
    await sign({}, { expired: true }),
    await sign({ is_anonymous: true }),
  ];

  for (const token of invalidTokens) {
    await assert.rejects(() => verify(token), SupabaseAuthError);
  }
});

test('provider dispatch recognizes only the configured Supabase issuer', async () => {
  const previousIssuer = process.env.SUPABASE_JWT_ISSUER;
  process.env.SUPABASE_JWT_ISSUER = ISSUER;
  try {
    const { sign } = await verifierFixture();
    assert.equal(isSupabaseAccessTokenCandidate(await sign()), true);
    assert.equal(
      isSupabaseAccessTokenCandidate(
        await sign({}, { issuer: 'https://clerk.example' })
      ),
      false
    );
    assert.equal(isSupabaseAccessTokenCandidate('not-a-jwt'), false);
  } finally {
    if (previousIssuer === undefined) {
      delete process.env.SUPABASE_JWT_ISSUER;
    } else {
      process.env.SUPABASE_JWT_ISSUER = previousIssuer;
    }
  }
});
