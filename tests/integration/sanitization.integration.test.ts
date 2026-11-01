/**
 * Sanitization Integration Tests — Inji Interoperability Playground
 *
 * Comprehensive tests for the EventSanitizer redaction policy.
 * These validate the acceptance criterion:
 *   "Sensitive tokens, OTPs, private keys, and personal credential data must be redacted."
 *
 * Run with:
 *   node --test tests/integration/sanitization.integration.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { EventSanitizer } from '../../src/engine/event-bus.js';

const REDACTED = '[REDACTED_SENSITIVE_DATA]';

// ─── Key-name redaction ───────────────────────────────────────────────────────

test('Sanitizer redacts authorization header values', () => {
  const result = EventSanitizer.sanitize({ authorization: 'Bearer eyJhbGc...' }) as Record<string, unknown>;
  assert.equal(result.authorization, REDACTED);
});

test('Sanitizer redacts access_token fields', () => {
  const result = EventSanitizer.sanitize({ access_token: 'raw_access_token_xyz' }) as Record<string, unknown>;
  assert.equal(result.access_token, REDACTED);
});

test('Sanitizer redacts refresh_token fields', () => {
  const result = EventSanitizer.sanitize({ refresh_token: 'raw_refresh_token' }) as Record<string, unknown>;
  assert.equal(result.refresh_token, REDACTED);
});

test('Sanitizer redacts client_secret fields', () => {
  const result = EventSanitizer.sanitize({ client_secret: 'very_secret_value' }) as Record<string, unknown>;
  assert.equal(result.client_secret, REDACTED);
});

test('Sanitizer redacts client_assertion fields', () => {
  const result = EventSanitizer.sanitize({ client_assertion: 'jwt.assertion.here' }) as Record<string, unknown>;
  assert.equal(result.client_assertion, REDACTED);
});

test('Sanitizer redacts private_key fields', () => {
  const result = EventSanitizer.sanitize({ private_key: 'base64encodedkey' }) as Record<string, unknown>;
  assert.equal(result.private_key, REDACTED);
});

test('Sanitizer redacts privatekey (no underscore) fields', () => {
  const result = EventSanitizer.sanitize({ privatekey: 'rawkey' }) as Record<string, unknown>;
  assert.equal(result.privatekey, REDACTED);
});

test('Sanitizer redacts user_pin fields', () => {
  const result = EventSanitizer.sanitize({ user_pin: '1234' }) as Record<string, unknown>;
  assert.equal(result.user_pin, REDACTED);
});

test('Sanitizer redacts password fields', () => {
  const result = EventSanitizer.sanitize({ password: 'hunter2' }) as Record<string, unknown>;
  assert.equal(result.password, REDACTED);
});

test('Sanitizer redacts ssn fields', () => {
  const result = EventSanitizer.sanitize({ ssn: '123-45-6789' }) as Record<string, unknown>;
  assert.equal(result.ssn, REDACTED);
});

test('Sanitizer redacts dpop_proof fields', () => {
  const result = EventSanitizer.sanitize({ dpop_proof: 'dpop_value_here' }) as Record<string, unknown>;
  assert.equal(result.dpop_proof, REDACTED);
});

test('Sanitizer redacts national_id fields', () => {
  const result = EventSanitizer.sanitize({ national_id: 'ID123456789' }) as Record<string, unknown>;
  assert.equal(result.national_id, REDACTED);
});

// ─── Safe fields are preserved ───────────────────────────────────────────────

test('Sanitizer preserves safe string fields', () => {
  const result = EventSanitizer.sanitize({
    safeField: 'hello_world',
    endpoint: 'https://api.example.com/path',
    runId: 'run-uuid-12345',
    format: 'w3c_vc_jsonld',
    status: 200,
  }) as Record<string, unknown>;

  assert.equal(result.safeField, 'hello_world');
  assert.equal(result.endpoint, 'https://api.example.com/path');
  assert.equal(result.runId, 'run-uuid-12345');
  assert.equal(result.format, 'w3c_vc_jsonld');
  assert.equal(result.status, 200);
});

// ─── All sensitive keys in one pass ──────────────────────────────────────────

test('Sanitizer redacts all known sensitive keys in a single payload', () => {
  const payload = {
    authorization: 'Bearer eyJhbGc...',
    access_token: 'raw_access_token',
    refresh_token: 'raw_refresh_token',
    client_secret: 'very_secret',
    client_assertion: 'jwt.assertion.here',
    private_key: 'BEGIN PRIVATE KEY...',
    privatekey: 'rawkey',
    user_pin: '1234',
    password: 'hunter2',
    ssn: '123-45-6789',
    dpop_proof: 'dpop_value',
    national_id: 'ID123456789',
    safeTopLevel: 'this is fine',
  };

  const result = EventSanitizer.sanitize(payload) as Record<string, unknown>;

  const shouldBeRedacted = [
    'authorization', 'access_token', 'refresh_token', 'client_secret',
    'client_assertion', 'private_key', 'privatekey', 'user_pin',
    'password', 'ssn', 'dpop_proof', 'national_id',
  ];

  for (const key of shouldBeRedacted) {
    assert.equal(result[key], REDACTED, `Key '${key}' should be redacted`);
  }

  assert.equal(result.safeTopLevel, 'this is fine', 'Safe fields should pass through');
});

// ─── Nested object sanitization ───────────────────────────────────────────────

test('Sanitizer recursively redacts nested sensitive fields', () => {
  const payload = {
    data: {
      access_token: 'jwt.token.abc',
      safeField: 'hello_world',
      deeper: {
        client_secret: 'nested_secret',
        keepThis: 'value',
      },
    },
  };

  const result = EventSanitizer.sanitize(payload) as Record<string, unknown>;
  const data = result.data as Record<string, unknown>;
  assert.equal(data.access_token, REDACTED);
  assert.equal(data.safeField, 'hello_world');

  const deeper = data.deeper as Record<string, unknown>;
  assert.equal(deeper.client_secret, REDACTED);
  assert.equal(deeper.keepThis, 'value');
});

// ─── Array sanitization ──────────────────────────────────────────────────────

test('Sanitizer recursively sanitizes array elements', () => {
  const arr = [
    { token: 'secret_value', safe: 'keep' },
    { access_token: 'another_secret', description: 'ok' },
  ];

  const result = EventSanitizer.sanitize(arr) as Array<Record<string, unknown>>;

  assert.equal(result[0].token, REDACTED);
  assert.equal(result[0].safe, 'keep');
  assert.equal(result[1].access_token, REDACTED);
  assert.equal(result[1].description, 'ok');
});

// ─── String-level redaction ───────────────────────────────────────────────────

test('Sanitizer redacts Bearer token strings in field values', () => {
  const result = EventSanitizer.sanitize({
    header: 'Bearer eyJhbGciOiJSUzI1NiJ9.payload.signature',
  }) as Record<string, unknown>;

  assert.equal(result.header, 'Bearer [REDACTED_TOKEN]', 'Bearer token value should be redacted');
});

test('Sanitizer does not alter non-Bearer string values', () => {
  const result = EventSanitizer.sanitize({ message: 'No sensitive data here' }) as Record<string, unknown>;
  assert.equal(result.message, 'No sensitive data here');
});

test('Sanitizer redacts PEM private key content in string values', () => {
  const result = EventSanitizer.sanitize({
    keyData: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg==\n-----END PRIVATE KEY-----',
  }) as Record<string, unknown>;

  assert.equal(result.keyData, '[REDACTED_PRIVATE_KEY]');
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

test('Sanitizer handles null values gracefully', () => {
  const result = EventSanitizer.sanitize(null);
  assert.equal(result, null);
});

test('Sanitizer handles undefined values gracefully', () => {
  const result = EventSanitizer.sanitize(undefined);
  assert.equal(result, undefined);
});

test('Sanitizer handles empty object without throwing', () => {
  const result = EventSanitizer.sanitize({}) as Record<string, unknown>;
  assert.deepEqual(result, {});
});

test('Sanitizer handles empty array without throwing', () => {
  const result = EventSanitizer.sanitize([]) as unknown[];
  assert.deepEqual(result, []);
});

test('Sanitizer handles number and boolean primitives', () => {
  assert.equal(EventSanitizer.sanitize(42), 42);
  assert.equal(EventSanitizer.sanitize(true), true);
  assert.equal(EventSanitizer.sanitize(false), false);
});

test('Sanitizer truncates at maximum depth (depth > 6 guard)', () => {
  // Build an object 9 levels deep
  const deep: Record<string, unknown> = {};
  let cur = deep;
  for (let i = 0; i < 9; i++) {
    cur.child = {};
    cur = cur.child as Record<string, unknown>;
  }
  cur.password = 'DEEP_SECRET'; // at depth 9, beyond the guard

  const result = EventSanitizer.sanitize(deep);
  const serialized = JSON.stringify(result);

  // The deep secret must not appear in the output
  assert.ok(!serialized.includes('DEEP_SECRET'), 'Secrets beyond max depth must be truncated, not exposed');
  assert.ok(serialized.includes('TRUNCATED'), 'Truncation marker should appear for deep objects');
});

// ─── Case-insensitive key matching ────────────────────────────────────────────

test('Sanitizer performs case-insensitive key matching', () => {
  const result = EventSanitizer.sanitize({
    Authorization: 'Bearer token_value',
    ACCESS_TOKEN: 'uppercase_token',
    Client_Secret: 'mixed_case_secret',
  }) as Record<string, unknown>;

  // Keys containing sensitive patterns (case-insensitive) must be redacted
  assert.equal(result.Authorization, REDACTED, 'Capitalized Authorization should be redacted');
  assert.equal(result.ACCESS_TOKEN, REDACTED, 'Uppercase ACCESS_TOKEN should be redacted');
  assert.equal(result.Client_Secret, REDACTED, 'Mixed-case Client_Secret should be redacted');
});
