import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';

test('AuthService rejects hidden users on login', async () => {
  const service = new AuthService(
    { user: { findUnique: async () => ({ id: 'user-1', isHidden: true }) } } as any,
    {} as any,
    {} as any,
  );

  await assert.rejects(
    () => service.login({ email: 'hidden@test.dev', password: 'password123' }),
    UnauthorizedException,
  );
});

test('JwtStrategy rejects hidden users', async () => {
  let findUniqueArgs: any;
  const strategy = new JwtStrategy(
    {
      user: {
        findUnique: async (args: any) => {
          findUniqueArgs = args;
          return null;
        },
      },
    } as any,
    { get: () => 'test-secret' } as any,
  );

  await assert.rejects(
    () => strategy.validate({ sub: 'user-1', role: 'USER' }),
    UnauthorizedException,
  );
  assert.deepEqual(findUniqueArgs.where, { id: 'user-1', isHidden: false });
});
