import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { EmailService } from '../src/email/email.service';

function createEmailService(values: Record<string, string | undefined>) {
  return new EmailService({
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as any);
}

test('production requires every password reset email setting', () => {
  const required = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'APP_URL'];
  for (const missing of required) {
    const values: Record<string, string | undefined> = {
      NODE_ENV: 'production',
      RESEND_API_KEY: 're_test',
      RESEND_FROM_EMAIL: 'Cafe Maps <noreply@domain-da-verify.com>',
      APP_URL: 'https://cafemaps.vn',
    };
    delete values[missing];
    assert.throws(() => createEmailService(values), new RegExp(`${missing} is required`));
  }
});

test('password reset email uses the configured verified sender and localized copy', async () => {
  for (const locale of ['vi', 'en'] as const) {
    let payload: any;
    const service = createEmailService({
      APP_URL: 'https://cafemaps.vn/',
      RESEND_API_KEY: 're_test',
      RESEND_FROM_EMAIL: 'Cafe Maps <noreply@domain-da-verify.com>',
    });
    (service as any).resend = {
      emails: {
        send: async (value: any) => ((payload = value), { data: { id: '1' }, error: null }),
      },
    };

    await service.sendPasswordReset('person@example.test', 'token value', locale);
    assert.equal(payload.from, 'Cafe Maps <noreply@domain-da-verify.com>');
    assert.match(payload.html, new RegExp(`/` + locale + `/reset-password\\?token=token%20value`));
    assert.match(payload.text, /60 (phút|minutes)/);
    assert.match(payload.text, /bỏ qua|ignore/);
    if (locale === 'vi') assert.doesNotMatch(payload.html, /Or copy|Reset password|If you did not/);
  }
});

test('password reset email logs Resend response errors', async () => {
  const service = createEmailService({
    RESEND_API_KEY: 're_test',
    RESEND_FROM_EMAIL: 'Cafe Maps <noreply@domain-da-verify.com>',
  });
  let logged = false;
  (service as any).resend = {
    emails: { send: async () => ({ data: null, error: { message: 'invalid sender' } }) },
  };
  (service as any).logger = { error: () => (logged = true) };

  await assert.rejects(() => service.sendPasswordReset('person@example.test', 'token', 'en'));
  assert.equal(logged, true);
});
