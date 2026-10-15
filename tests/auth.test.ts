import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmEmailLink, registerNewUser } from '../src/lib/authService';
import { requireSupabaseClient } from '../src/lib/supabase';

test('a consumed confirmation link explains that normal login is the next step', async () => {
  (requireSupabaseClient().auth as any).verifyOtp = async () => ({ data: {}, error: { code: 'otp_expired', message: 'Email link is invalid or has expired' } });
  await assert.rejects(confirmEmailLink('https://pelfdcqxaevipjyehqzg.supabase.co/auth/v1/verify?token=test-token&type=signup'), /gå til innlogging/);
});

test('confirmation rejects a link from a different service before contacting Auth', async () => {
  await assert.rejects(confirmEmailLink('https://example.test/auth/v1/verify?token=test-token&type=signup'), /Elevhub sin e-post/);
});

test('registration rejects fewer than eight characters before contacting Auth', async () => {
  await assert.rejects(registerNewUser('Test', 'test@example.invalid', '1234567'), /minst 8 tegn/);
});
