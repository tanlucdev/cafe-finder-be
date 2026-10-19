import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ForgotPasswordDto } from '../src/auth/dto/forgot-password.dto';

test('ForgotPasswordDto accepts supported locales only', async () => {
  const valid = plainToInstance(ForgotPasswordDto, { email: 'user@example.com', locale: 'vi' });
  const invalid = plainToInstance(ForgotPasswordDto, { email: 'user@example.com', locale: 'fr' });

  assert.equal((await validate(valid)).length, 0);
  assert.equal((await validate(invalid))[0].property, 'locale');
});
