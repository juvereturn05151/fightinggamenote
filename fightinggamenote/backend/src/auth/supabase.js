import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SupabaseAuthError extends Error {
  constructor(message = 'Invalid Supabase access token', options) {
    super(message, options);
    this.name = 'SupabaseAuthError';
  }
}

function configuredIssuer() {
  if (process.env.SUPABASE_JWT_ISSUER) {
    return process.env.SUPABASE_JWT_ISSUER.replace(/\/$/, '');
  }

  if (!process.env.SUPABASE_URL) return null;
  return `${process.env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1`;
}

// This is only provider dispatch. Authorization still requires jwtVerify below.
export function isSupabaseAccessTokenCandidate(token) {
  const issuer = configuredIssuer();
  if (!issuer || !token) return false;

  try {
    return decodeJwt(token).iss === issuer;
  } catch {
    return false;
  }
}

export function createSupabaseTokenVerifier({
  issuer,
  audience = 'authenticated',
  jwks,
} = {}) {
  if (!issuer || !jwks) {
    throw new Error('Supabase JWT issuer and JWKS are required');
  }

  return async function verifySupabaseToken(token) {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, jwks, {
        issuer,
        audience,
        algorithms: ['RS256', 'ES256', 'EdDSA'],
        clockTolerance: 5,
      }));
    } catch (error) {
      throw new SupabaseAuthError('Invalid Supabase access token', {
        cause: error,
      });
    }

    if (
      typeof payload.sub !== 'string' ||
      !UUID_PATTERN.test(payload.sub) ||
      payload.role !== 'authenticated' ||
      payload.is_anonymous !== false ||
      typeof payload.email !== 'string' ||
      !payload.email.includes('@')
    ) {
      throw new SupabaseAuthError(
        'Supabase token does not represent a non-anonymous user'
      );
    }

    return {
      provider: 'supabase',
      providerUserId: payload.sub,
      email: payload.email,
      token,
    };
  };
}

let defaultVerifier;

export async function verifySupabaseAccessToken(token) {
  if (!defaultVerifier) {
    const issuer = configuredIssuer();
    if (!issuer) {
      throw new SupabaseAuthError('Supabase authentication is not configured');
    }

    const audience = process.env.SUPABASE_JWT_AUDIENCE ?? 'authenticated';
    const jwks = createRemoteJWKSet(
      new URL(`${issuer}/.well-known/jwks.json`)
    );
    defaultVerifier = createSupabaseTokenVerifier({ issuer, audience, jwks });
  }

  return defaultVerifier(token);
}

export async function fetchSupabaseUser(token) {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required to provision users'
    );
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new SupabaseAuthError('Supabase user lookup failed');
  }

  return response.json();
}
