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

test('Google OAuth records GOOGLE only for newly created users', async () => {
  let createArgs: any;
  const oauth = new GoogleOAuthService(
    {
      get: (key: string) =>
        ({
          GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
          GOOGLE_CLIENT_SECRET: 'client-secret',
          GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:3001/api/auth/oauth/google/callback',
        })[key],
    } as ConfigService,
    {
      user: {
        findUnique: async () => null,
        create: async (args: any) => {
          createArgs = args;
          return args.data;
        },
      },
    } as any,
    authService,
  );

  await (oauth as any).upsertGoogleUser({
    googleSub: 'google-sub',
    email: 'google@test.dev',
    displayName: 'Google User',
    avatarUrl: null,
  });

  assert.equal(createArgs.data.registrationMethod, 'GOOGLE');
});

test('Google OAuth linking leaves the existing registration origin unchanged', async () => {
  let updateArgs: any;
  const existing = {
    id: 'user-1',
    email: 'email@test.dev',
    googleSub: null,
    displayName: 'Email User',
    avatarUrl: null,
    registrationMethod: 'EMAIL',
    isHidden: false,
  };
  const oauth = new GoogleOAuthService(
    {
      get: (key: string) =>
        ({
          GOOGLE_CLIENT_ID: 'client-id.apps.googleusercontent.com',
          GOOGLE_CLIENT_SECRET: 'client-secret',
          GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:3001/api/auth/oauth/google/callback',
        })[key],
    } as ConfigService,
    {
      user: {
        findUnique: async ({ where }: any) => (where.email ? existing : null),
        update: async (args: any) => {
          updateArgs = args;
          return { ...existing, ...args.data };
        },
      },
    } as any,
    authService,
  );

  const user = await (oauth as any).upsertGoogleUser({
    googleSub: 'google-sub',
    email: existing.email,
    displayName: 'Different Name',
    avatarUrl: 'https://example.test/avatar.png',
  });

  assert.equal(updateArgs.data.googleSub, 'google-sub');
  assert.deepEqual(updateArgs.data, { googleSub: 'google-sub' });
  assert.equal(user.registrationMethod, 'EMAIL');
});
