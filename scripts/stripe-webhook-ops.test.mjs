import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectStripe, replayEvent, validateApiKey, validateReplay, parseArgs,
  PLATFORM_ENDPOINT, CONNECT_ENDPOINT, RECEIVER_URL, SAFE_EVENT_TYPES } from './stripe-webhook-ops.mjs';

const now = Math.floor(Date.now() / 1000);
const platform = { id: PLATFORM_ENDPOINT, object: 'webhook_endpoint', livemode: false,
  url: RECEIVER_URL, status: 'enabled', enabled_events: [...SAFE_EVENT_TYPES] };
const event = { id: 'evt_existing', object: 'event', livemode: false,
  created: now - 10, type: 'customer.subscription.updated',
  data: { object: { email: 'private@example.invalid' } } };

function fixtures({ endpoint = platform, candidate = event, account = 'acct_sandbox', events = [event] } = {}) {
  const calls = [];
  const stripe = {
    accounts: { retrieve: async () => { calls.push('account'); return { id: account, email: 'private@example.invalid' }; } },
    webhookEndpoints: { retrieve: async id => {
      calls.push('endpoint:' + id);
      return id === CONNECT_ENDPOINT ? { ...endpoint, id: CONNECT_ENDPOINT, enabled_events: ['account.updated'] }
        : { ...endpoint, secret: 'whsec_never_print', metadata: { private: 'private@example.invalid' } };
    } },
    events: {
      list: async () => { calls.push('events:list'); return { data: events, has_more: false }; },
      retrieve: async () => { calls.push('events:get'); return candidate; },
    },
  };
  return { stripe, calls };
}

const options = { eventId: event.id, expectedAccount: 'acct_sandbox', confirmReplay: true };

test('inspection is read-only and prints no keys, metadata, or event contents', async () => {
  const { stripe, calls } = fixtures();
  const report = await inspectStripe(stripe, now);
  assert.equal(report.replay_candidates.length, 1);
  assert.deepEqual(calls, ['account', 'endpoint:' + PLATFORM_ENDPOINT, 'endpoint:' + CONNECT_ENDPOINT, 'events:list']);
  assert.doesNotMatch(JSON.stringify(report), /whsec_|private@example|"metadata":/);
  assert.match(report.verification, /Not performed/);
});

test('inspection distinguishes an empty candidate page from completed verification', async () => {
  const { stripe } = fixtures({ events: [] });
  const report = await inspectStripe(stripe, now);
  assert.deepEqual(report.replay_candidates, []);
  assert.match(report.next_step, /Do not generate/);
});

test('inspection reports a bounded search instead of implying all events were searched', async () => {
  const { stripe } = fixtures();
  stripe.events.list = async () => ({ data: [], has_more: true });
  assert.equal((await inspectStripe(stripe, now)).search_truncated, true);
});

test('sandbox API credentials only; secrets cannot be passed as arguments', () => {
  assert.equal(validateApiKey('rk_test_synthetic'), 'rk_test_synthetic');
  for (const key of ['sk_live_hidden', 'rk_live_hidden', 'whsec_hidden', '', undefined, 'sk_test_bad\n']) {
    assert.throws(() => validateApiKey(key));
  }
  assert.throws(() => parseArgs(['inspect', '--api-key', 'sk_test_private']), error => !error.message.includes('sk_test_private'));
});

test('unsafe event kinds, mode, scope and expired events cannot be replayed', () => {
  for (const modification of [
    { type: 'checkout.session.completed' }, { type: 'payment_intent.succeeded' },
    { type: 'payment_intent.payment_failed' }, { type: 'account.updated' },
    { livemode: true }, { livemode: undefined }, { account: 'acct_coach' },
    { created: now - 30 * 86400 }, { created: now + 60 }, { id: 'evt_bad/path' },
  ]) assert.throws(() => validateReplay({ ...event, ...modification }, platform, now));
});

test('changed, disabled, wildcard-only, or live destinations cannot be replayed', () => {
  for (const modification of [
    { id: CONNECT_ENDPOINT }, { status: 'disabled' }, { livemode: true },
    { id: 'we_1TCAt6DWCgTDQAOtMWelR3Hs' },
    { deleted: true }, { url: 'https://other.invalid/api/webhooks/stripe' },
    { url: RECEIVER_URL + '?redirect=other' }, { enabled_events: ['*'] }, { enabled_events: [] },
  ]) assert.throws(() => validateReplay(event, { ...platform, ...modification }, now));
});

test('replay requires explicit confirmation before contacting Stripe', async () => {
  const { stripe, calls } = fixtures();
  await assert.rejects(replayEvent(stripe, { ...options, confirmReplay: false }, () => assert.fail('CLI invoked')));
  assert.deepEqual(calls, []);
});

test('account mismatch stops replay before endpoint/event reads or mutation', async () => {
  const { stripe, calls } = fixtures({ account: 'acct_other' });
  await assert.rejects(replayEvent(stripe, options, () => assert.fail('CLI invoked')), /Account changed/);
  assert.deepEqual(calls, ['account']);
});

test('event substitution cannot reach the CLI', async () => {
  const { stripe } = fixtures({ candidate: { ...event, id: 'evt_other' } });
  await assert.rejects(replayEvent(stripe, options, () => assert.fail('CLI invoked')), /does not match/);
});

test('a payment event is blocked before the CLI can request delivery', async () => {
  const { stripe } = fixtures({ candidate: { ...event, type: 'checkout.session.completed' } });
  await assert.rejects(replayEvent(stripe, options, () => assert.fail('CLI invoked')), /business handler/);
});

test('an existing ignored event targets only the pinned platform endpoint', async () => {
  const { stripe } = fixtures();
  const report = await replayEvent(stripe, options, async args => {
    assert.deepEqual(args, ['events', 'resend', event.id,
      '--webhook-endpoint=we_1UD6tGDWCgTDQAOtLzqwDtjx', '--confirm']);
    return { status: 0, stdout: JSON.stringify(event) };
  });
  assert.match(report.verification, /PENDING/);
  assert.doesNotMatch(JSON.stringify(report), /private@example/);
});

test('provider and CLI errors cannot print raw credentials or payloads', async () => {
  const { stripe } = fixtures();
  stripe.accounts.retrieve = async () => { throw Object.assign(new Error('sk_test_private'), { statusCode: 401 }); };
  await assert.rejects(inspectStripe(stripe), error => error.message.includes('401') && !error.message.includes('sk_test_private'));
  const { stripe: second } = fixtures();
  await assert.rejects(replayEvent(second, options, async () => ({ status: 1, stderr: 'sk_test_private' })),
    error => !error.message.includes('sk_test_private'));
});

test('a successful CLI exit without an event acknowledgment is not a pass', async () => {
  const { stripe } = fixtures();
  await assert.rejects(replayEvent(stripe, options, async () => ({ status: 0, stdout: 'Saved successfully' })));
});
