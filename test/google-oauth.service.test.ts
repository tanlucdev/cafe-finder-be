import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { GoogleOAuthService } from '../src/auth/services/google-oauth.service';

const prisma = {} as any;
const authService = {} as any;

function service(env: Record<string, string | undefined>) {
  return new GoogleOAuthService(
    { get: (key: string) => env[key] } as ConfigService,
    prisma,
    authService,
  );
}

test('Google OAuth start URL includes required redirect_uri', () => {
  const result = service({
    GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:3001/api/auth/oauth/google/callback',
  }).getAuthorizationUrl('/');

  const url = new URL(result.authorizationUrl);
  assert.equal(
    url.searchParams.get('redirect_uri'),
    'http://localhost:3001/api/auth/oauth/google/callback',
  );
  assert.equal(url.searchParams.get('client_id'), 'client-id.apps.googleusercontent.com');
});

test('Google OAuth fails fast when redirect URI config is missing', () => {
  assert.throws(
    () =>
      service({
        GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'client-secret',
      }),
    /Missing required config: GOOGLE_OAUTH_REDIRECT_URI/,
  );
});
