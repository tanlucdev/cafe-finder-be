import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/auth/auth.service';

const genericMessage = 'If an eligible account exists, you will receive instructions via email';

test('forgot password hides nonexistent, hidden, and Google-only accounts', async () => {
  for (const user of [
    null,
    { id: 'hidden', isHidden: true, passwordHash: 'hash' },
    { id: 'google', isHidden: false, passwordHash: null },
  ]) {
    let created = false;
    const service = new AuthService(
      {
        user: { findUnique: async () => user },
        passwordResetToken: {
          create: async () => {
            created = true;
          },
        },
      } as any,
      {} as any,
      {} as any,
    );
    assert.deepEqual(await service.forgotPassword('person@example.test', 'en'), {
      message: genericMessage,
    });
    assert.equal(created, false);
  }
});

test('forgot password stores only a SHA-256 token hash', async () => {
  let createArgs: any;
  let sent: any;
  const service = new AuthService(
    {
      user: {
        findUnique: async () => ({
          id: 'user-1',
          email: 'person@example.test',
          isHidden: false,
          passwordHash: 'hash',
        }),
      },
      passwordResetToken: {
        create: async (args: any) => {
          createArgs = args;
        },
      },
    } as any,
    {} as any,
    {
      sendPasswordReset: async (...args: any[]) => {
        sent = args;
      },
    } as any,
  );

  await service.forgotPassword('person@example.test', 'en');
  assert.equal(createArgs.data.tokenHash.length, 64);
  assert.notEqual(createArgs.data.tokenHash, sent[1]);
  assert.equal(
    createArgs.data.tokenHash,
    crypto.createHash('sha256').update(sent[1]).digest('hex'),
  );
  assert.equal(sent[2], 'en');
});

test('forgot password rate limit remains enumeration-safe', async () => {
  let sent = false;
  const service = new AuthService(
    {
      user: {
        findUnique: async () => ({
          id: 'user-1',
          email: 'person@example.test',
          isHidden: false,
          passwordHash: 'hash',
        }),
      },
      passwordResetToken: {
        create: async () => {
          throw { code: 'P2002' };
        },
      },
    } as any,
    {} as any,
    {
      sendPasswordReset: async () => {
        sent = true;
      },
    } as any,
  );
  assert.deepEqual(await service.forgotPassword('person@example.test', 'en'), {
    message: genericMessage,
  });
  assert.equal(sent, false);
});

test('forgot password hides email delivery failures', async () => {
  const service = new AuthService(
    {
      user: {
        findUnique: async () => ({
          id: 'user-1',
          email: 'person@example.test',
          isHidden: false,
          passwordHash: 'hash',
        }),
      },
      passwordResetToken: { create: async () => undefined },
    } as any,
    {} as any,
    {
      sendPasswordReset: async () => {
        throw new Error('Resend rejected sender');
      },
    } as any,
  );

  assert.deepEqual(await service.forgotPassword('person@example.test', 'en'), {
    message: genericMessage,
  });
});

test('only one concurrent reset can claim a valid token', async () => {
  let used = false;
  let updates = 0;
  const transaction = async (callback: (tx: any) => Promise<unknown>) =>
    callback({
      passwordResetToken: {
        findUnique: async () => ({ userId: 'user-1' }),
        updateMany: async () => {
          if (used) return { count: 0 };
          used = true;
          return { count: 1 };
        },
      },
      user: {
        update: async () => {
          updates += 1;
        },
      },
    });
  const service = new AuthService({ $transaction: transaction } as any, {} as any, {} as any);
  const results = await Promise.allSettled([
    service.resetPassword('a-token', 'password123'),
    service.resetPassword('a-token', 'password123'),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(updates, 1);
});

test('expired or used token is rejected before changing a password', async () => {
  const service = new AuthService(
    {
      $transaction: async (callback: (tx: any) => Promise<unknown>) =>
        callback({
          passwordResetToken: {
            findUnique: async () => ({ userId: 'user-1' }),
            updateMany: async () => ({ count: 0 }),
          },
          user: { update: async () => assert.fail('must not update password') },
        }),
    } as any,
    {} as any,
    {} as any,
  );
  await assert.rejects(
    () => service.resetPassword('expired-token', 'password123'),
    BadRequestException,
  );
});

test('password changes increment authVersion and revoke existing JWTs', async () => {
  let updateArgs: any;
  const service = new AuthService(
    {
      user: {
        findUnique: async () => ({
          id: 'user-1',
          isHidden: false,
          passwordHash: await bcrypt.hash('password123', 4),
        }),
        update: async (args: any) => {
          updateArgs = args;
        },
      },
    } as any,
    {} as any,
    {} as any,
  );

  await service.changePassword('user-1', {
    currentPassword: 'password123',
    newPassword: 'newpassword123',
  });
  assert.deepEqual(updateArgs.data.authVersion, { increment: 1 });
});
