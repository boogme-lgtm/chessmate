import Stripe from 'stripe';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Existing resources confirmed during the September 8 recovery, not creation instructions.
// The former platform endpoint we_1TCAt6DWCgTDQAOtMWelR3Hs is no longer listed.
export const PLATFORM_ENDPOINT = 'we_1UD6tGDWCgTDQAOtLzqwDtjx';
export const CONNECT_ENDPOINT = 'we_1UD5OiDWCgTDQAOtFD4KDpyJ';
export const RECEIVER_URL = 'https://boogme.com/api/webhooks/stripe';
export const SAFE_EVENT_TYPES = Object.freeze([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateApiKey(key) {
  requireCondition(typeof key === 'string' && /^(sk|rk)_test_[A-Za-z0-9]+$/.test(key),
    'Supply an authorized sandbox API key as BOOGME_STRIPE_OPS_KEY. Live keys are refused.');
  return key;
}

function safeApiError(error) {
  // Provider messages can contain keys, request bodies, and customer data.
  // Return only known categories and an HTTP status, not the original exception.
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : null;
  return new Error('Stripe API request failed' + (status ? ' (HTTP ' + status + ')' : '')
    + '. Check account access and API-key permissions; no request details were printed.');
}

async function api(operation) {
  try { return await operation(); } catch (error) { throw safeApiError(error); }
}

export function validateEndpoint(endpoint, expectedId = PLATFORM_ENDPOINT) {
  requireCondition(endpoint?.id === expectedId && endpoint.object === 'webhook_endpoint'
    && !endpoint.deleted, 'Unexpected or deleted destination.');
  requireCondition(endpoint.livemode === false, 'Refusing a live-mode destination.');
  requireCondition(endpoint.url === RECEIVER_URL, 'Destination URL differs from the reviewed receiver.');
  requireCondition(Array.isArray(endpoint.enabled_events), 'Destination event list is unavailable.');
  return endpoint;
}

export function validateReplay(event, endpoint, nowSeconds = Math.floor(Date.now() / 1000)) {
  validateEndpoint(endpoint);
  requireCondition(endpoint.status === 'enabled', 'Platform destination is not enabled.');
  requireCondition(event?.object === 'event' && /^evt_[A-Za-z0-9]+$/.test(event.id), 'Invalid Stripe event.');
  requireCondition(event.livemode === false && !event.account, 'Only sandbox platform events may be replayed.');
  requireCondition(SAFE_EVENT_TYPES.includes(event.type), 'Refusing an event that could enter a business handler.');
  requireCondition(endpoint.enabled_events.includes(event.type), 'Event is not explicitly subscribed on this destination.');
  requireCondition(Number.isInteger(event.created) && event.created <= nowSeconds
    && event.created > nowSeconds - 30 * 86400, 'Event is outside the Stripe resend window.');
  return event;
}

function endpointSummary(endpoint) {
  return {
    id: endpoint.id, url: endpoint.url, livemode: endpoint.livemode,
    status: endpoint.status, enabled_events: endpoint.enabled_events,
    api_version: endpoint.api_version ?? null,
    scope: 'Use the previously verified scope; the v1 retrieve response does not expose connect.',
  };
}

export async function inspectStripe(stripe, nowSeconds = Math.floor(Date.now() / 1000)) {
  const account = await api(() => stripe.accounts.retrieve());
  requireCondition(/^acct_[A-Za-z0-9]+$/.test(account?.id), 'Stripe account identity is unavailable.');
  // These resource IDs must exist under the authenticated account before listing events.
  const platform = validateEndpoint(await api(() => stripe.webhookEndpoints.retrieve(PLATFORM_ENDPOINT)));
  const connect = validateEndpoint(await api(() => stripe.webhookEndpoints.retrieve(CONNECT_ENDPOINT)), CONNECT_ENDPOINT);
  const page = await api(() => stripe.events.list({
    types: [...SAFE_EVENT_TYPES], created: { gte: nowSeconds - 29 * 86400 }, limit: 100,
  }));
  const candidates = [];
  for (const event of page.data ?? []) {
    try {
      validateReplay(event, platform, nowSeconds);
      candidates.push({ id: event.id, type: event.type, created_utc: new Date(event.created * 1000).toISOString() });
    } catch { /* Report only events that meet every replay condition. */ }
  }
  return {
    operation: 'read-only inspection', account_id: account.id,
    platform: endpointSummary(platform), connect: endpointSummary(connect),
    replay_candidates: candidates,
    search_window_days: 29, search_truncated: page.has_more === true,
    verification: 'Not performed. Endpoint metadata and a local save are not delivery evidence.',
    next_step: candidates.length ? 'Review an existing candidate before explicitly requesting its replay.'
      : 'No eligible event in this page. Do not generate payment or subscription fixtures to obtain one.',
  };
}

export async function replayEvent(stripe, options, runCli) {
  requireCondition(options.confirmReplay === true, 'Replay needs the explicit --confirm-replay flag.');
  requireCondition(/^acct_[A-Za-z0-9]+$/.test(options.expectedAccount ?? ''),
    'Replay needs --expected-account from the read-only inspection.');
  requireCondition(/^evt_[A-Za-z0-9]+$/.test(options.eventId ?? ''), 'A valid --event ID is required.');
  const account = await api(() => stripe.accounts.retrieve());
  requireCondition(account.id === options.expectedAccount, 'Account changed since inspection; replay refused.');
  const endpoint = await api(() => stripe.webhookEndpoints.retrieve(PLATFORM_ENDPOINT));
  const event = await api(() => stripe.events.retrieve(options.eventId));
  requireCondition(event.id === options.eventId, 'Returned event does not match the requested event.');
  validateReplay(event, endpoint);
  // The official CLI signs the request to Stripe using an API credential.
  // Stripe creates the webhook signature; no endpoint signing secret is needed.
  let result;
  try {
    result = await runCli(['events', 'resend', event.id,
      '--webhook-endpoint=' + PLATFORM_ENDPOINT, '--confirm']);
  } catch {
    throw new Error('Stripe CLI could not run. No subprocess details were printed.');
  }
  requireCondition(result?.status === 0, 'Stripe CLI replay failed. Raw CLI output was withheld.');
  let response;
  try { response = JSON.parse(result.stdout); } catch { throw new Error('Stripe CLI returned no usable event acknowledgment.'); }
  requireCondition(response.id === event.id && response.object === 'event', 'Unexpected Stripe replay acknowledgment.');
  return {
    operation: 'replay requested', account_id: account.id, endpoint_id: PLATFORM_ENDPOINT,
    event_id: event.id, event_type: event.type,
    requested_at: new Date().toISOString(),
    verification: 'PENDING: a replay acknowledgment is not the receiver HTTP result.',
    required_evidence: 'Match this event to a Stripe delivery result and production receipt. '
      + 'For these ignored events expect HTTP 200, {"received":true}, and no business processing. '
      + 'Do not retire a signing secret on this command result alone.',
  };
}

function cliRunner(key, execute = spawnSync) {
  return args => {
    const result = execute('stripe', args, {
      // Do not put credentials on the command line or pass other application secrets.
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', STRIPE_API_KEY: key,
        NO_COLOR: '1', STRIPE_CLI_TELEMETRY_OPTOUT: '1' },
      encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'], shell: false,
    });
    return result;
  };
}

export function parseArgs(args) {
  const [command, ...rest] = args;
  if (command === '--help' || command === 'help' || !command) return { command: 'help' };
  requireCondition(command === 'inspect' || command === 'replay', 'Use inspect, replay, or --help.');
  const options = { command };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--confirm-replay') { options.confirmReplay = true; continue; }
    if (rest[i] === '--event' || rest[i] === '--expected-account') {
      const name = rest[i] === '--event' ? 'eventId' : 'expectedAccount';
      requireCondition(rest[i + 1] && !rest[i + 1].startsWith('--'), 'Missing option value.');
      requireCondition(options[name] === undefined, 'Duplicate option.');
      options[name] = rest[++i];
      continue;
    }
    throw new Error('Unknown option. Secret values must never be command-line arguments.');
  }
  requireCondition(command !== 'inspect' || rest.length === 0, 'inspect accepts no mutation options.');
  return options;
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.command === 'help') {
    console.log('BooGMe sandbox webhook operations\n'
      + '  node scripts/stripe-webhook-ops.mjs inspect\n'
      + '  node scripts/stripe-webhook-ops.mjs replay --event evt_ID --expected-account acct_ID --confirm-replay\n'
      + 'Supply BOOGME_STRIPE_OPS_KEY through an authorized secret mechanism. No webhook secret is read.\n'
      + 'inspect is read-only. replay needs the official Stripe CLI and deliberately resends one existing ignored event.');
    return;
  }
  const key = validateApiKey(process.env.BOOGME_STRIPE_OPS_KEY);
  const stripe = new Stripe(key, { timeout: 15000, maxNetworkRetries: 0 });
  const report = options.command === 'inspect'
    ? await inspectStripe(stripe) : await replayEvent(stripe, options, cliRunner(key));
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
