import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { parseCookies } from '../src/auth/services/auth-cookie.service';

test('AuthService rejects hidden users on login', async () => {
  let findUniqueArgs: any;
  const service = new AuthService(
    {
      user: {
        findUnique: async (args: any) => {
          findUniqueArgs = args;
          return { id: 'user-1', isHidden: true };
        },
      },
    } as any,
    {} as any,
    {} as any,
  );

  await assert.rejects(
    () => service.login({ email: 'hidden@test.dev', password: 'password123' }),
    UnauthorizedException,
  );
  assert.deepEqual(findUniqueArgs.select, {
    id: true,
    email: true,
    passwordHash: true,
    displayName: true,
    role: true,
    isHidden: true,
    authVersion: true,
    createdAt: true,
  });
});

test('AuthService registers email accounts with an immutable EMAIL origin', async () => {
  let createArgs: any;
  const service = new AuthService(
    {
      user: {
        findUnique: async () => null,
        create: async (args: any) => {
          createArgs = args;
          return { id: 'user-1', email: 'new@test.dev', role: 'USER' };
        },
      },
    } as any,
    { sign: () => 'token' } as any,
    {} as any,
  );

  await service.register({
    email: 'new@test.dev',
    password: 'password123',
    displayName: 'New User',
  });

  assert.equal(createArgs.data.registrationMethod, 'EMAIL');
});

test('AuthService rejects passwordless users on password login', async () => {
  const service = new AuthService(
    {
      user: {
        findUnique: async () => ({
          id: 'user-1',
          email: 'google@test.dev',
          passwordHash: null,
          isHidden: false,
        }),
      },
    } as any,
    {} as any,
    {} as any,
  );

  await assert.rejects(
    () => service.login({ email: 'google@test.dev', password: 'password123' }),
    UnauthorizedException,
  );
});

test('JwtStrategy only accepts the current user auth version', async () => {
  let findFirstArgs: any;
  const strategy = new JwtStrategy(
    { get: () => 'test-secret' } as any,
    {
      user: {
        findFirst: async (args: any) => {
          findFirstArgs = args;
          return { id: 'user-1', role: 'USER' };
        },
      },
    } as any,
  );

  assert.deepEqual(await strategy.validate({ sub: 'user-1', role: 'ADMIN', version: 2 }), {
    id: 'user-1',
    role: 'USER',
  });
  assert.deepEqual(findFirstArgs.where, { id: 'user-1', authVersion: 2, isHidden: false });
});

test('JwtStrategy treats pre-version JWTs as version zero', async () => {
  let findFirstArgs: any;
  const strategy = new JwtStrategy(
    { get: () => 'test-secret' } as any,
    {
      user: {
        findFirst: async (args: any) => ((findFirstArgs = args), { id: 'user-1', role: 'USER' }),
      },
    } as any,
  );

  await strategy.validate({ sub: 'user-1', role: 'USER' });
  assert.deepEqual(findFirstArgs.where, { id: 'user-1', authVersion: 0, isHidden: false });
});

test('parseCookies reads URL encoded auth cookie values', () => {
  assert.equal(parseCookies('a=1; cafe-auth-token=abc%201')['cafe-auth-token'], 'abc 1');
});
