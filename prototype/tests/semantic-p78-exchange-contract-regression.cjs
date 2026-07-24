'use strict';

const fs = require('node:fs');
const path = require('node:path');

global.window = global;
const sourcePath = path.join(__dirname, '..', 'lib', 'p78-exchange-contract.js');
const exchange = require(sourcePath);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const checks = [];
function check(name, run) {
  try {
    checks.push({ name, ok: true, detail: run() || '' });
  } catch (error) {
    checks.push({ name, ok: false, detail: error.message || String(error) });
  }
}

function evidence(id) {
  return { providerId: id, providerVersion: '1.0.0' };
}

function request(operation = 'ENCODE') {
  return exchange.create({
    kind: 'REQUEST', from: '2d', to: '1d', epoch: 3, revision: 'rev-source-1',
    status: 'READY', code: null, body: { operation, text: 'SOS' }, evidence: evidence('living-ring'),
  });
}

check('API is frozen, versioned and side-effect free', () => {
  assert(exchange === global.MRDP78ExchangeContract, 'global and CommonJS exports differ');
  assert(exchange.version === '1.0.0' && exchange.schema === 'p78.exchange/1', 'version/schema mismatch');
  assert(Object.isFrozen(exchange), 'API is mutable');
  ['create', 'reply', 'validate', 'routeAllowed', 'isStale', 'sameMessage'].forEach((name) => {
    assert(typeof exchange[name] === 'function', `${name} is missing`);
  });
});

check('2D to 1D request is exact and deterministic', () => {
  const first = request();
  const second = request();
  assert(first.status === 'READY' && exchange.validate(first).ok, 'valid request rejected');
  assert(first.messageId === second.messageId && exchange.sameMessage(first, second), 'request is not deterministic');
  assert(first.evidence.contentHash === exchange.hash(first.body), 'body hash mismatch');
  return first.messageId;
});

check('2D to 3D routes are explicit', () => {
  assert(exchange.routeAllowed('2d', '3d', 'REQUEST', 'DIAGNOSE_Q6'), 'DIAGNOSE_Q6 blocked');
  assert(exchange.routeAllowed('2d', '3d', 'REQUEST', 'FIND_COUNTERFACTUAL'), 'FIND_COUNTERFACTUAL blocked');
  assert(!exchange.routeAllowed('2d', '3d', 'REQUEST', 'ENCODE'), 'cross-domain operation leaked');
});

check('direct 1D to 3D bypass fails closed', () => {
  const result = exchange.create({
    kind: 'REQUEST', from: '1d', to: '3d', epoch: 1, revision: 'r1', status: 'READY', code: null,
    body: { operation: 'DIAGNOSE_Q6' }, evidence: evidence('pulse-tape'),
  });
  assert(result.status === 'INVALID' && result.code === 'EXCHANGE_2D_ARBITER_REQUIRED', `unexpected ${result.code}`);
});

check('reply echoes request snapshot and uses declared report route', () => {
  const source = request();
  const result = exchange.reply(source, {
    body: { operation: 'SEQUENCE_REPORT', bytes: [83, 79, 83] }, evidence: evidence('pulse-codec'),
  });
  assert(exchange.validate(result).ok, 'reply rejected');
  assert(result.from === '1d' && result.to === '2d', 'reply direction changed');
  assert(result.replyTo === source.messageId, 'replyTo mismatch');
  assert(result.epoch === source.epoch && result.revision === source.revision, 'snapshot mismatch');
});

check('non-ready replies require an explicit code', () => {
  const result = exchange.reply(request(), {
    status: 'PARTIAL', body: { operation: 'SEQUENCE_REPORT' }, evidence: evidence('pulse-codec'),
  });
  assert(result.status === 'INVALID' && result.code === 'EXCHANGE_CODE_REQUIRED', 'missing code was accepted');
});

check('tampered body and message id fail integrity', () => {
  const good = request();
  const bodyTamper = JSON.parse(JSON.stringify(good));
  bodyTamper.body.text = 'changed';
  assert(exchange.validate(bodyTamper).code === 'EXCHANGE_CONTENT_HASH', 'body tamper not detected first');
  const idTamper = JSON.parse(JSON.stringify(good));
  idTamper.messageId = 'p78x-00000000';
  assert(exchange.validate(idTamper).errors.some((item) => item.code === 'EXCHANGE_MESSAGE_INTEGRITY'), 'id tamper not detected');
});

check('stale epoch or revision cannot be treated as current', () => {
  const value = request();
  assert(!exchange.isStale(value, 3, 'rev-source-1'), 'current request marked stale');
  assert(exchange.isStale(value, 4, 'rev-source-1'), 'stale epoch accepted');
  assert(exchange.isStale(value, 3, 'rev-source-2'), 'stale revision accepted');
});

check('evidence remains structural and never claims semantic truth', () => {
  const value = request();
  const validation = exchange.validate(value);
  assert(value.evidence.level === 'STRUCTURAL' && value.evidence.soundness === 'NOT_COMPUTED', 'envelope evidence widened');
  assert(validation.semanticTruth === false && validation.soundness === 'NOT_COMPUTED', 'validation claims truth');
});

check('source is classic static JavaScript', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  assert(!/\beval\s*\(|new\s+Function\b/.test(source), 'dynamic evaluation found');
  assert(!/fetch\s*\(|XMLHttpRequest|WebSocket|BroadcastChannel/.test(source), 'transport side effect found');
  assert(!/document\.|querySelector|getElementById/.test(source), 'DOM dependency found');
});

for (const item of checks) {
  process.stdout.write(`${item.ok ? 'PASS' : 'FAIL'} | ${item.name}${item.detail ? ` | ${item.detail}` : ''}\n`);
}
const passed = checks.filter((item) => item.ok).length;
process.stdout.write(`\n${passed === checks.length ? 'PASS' : 'FAIL'}: ${passed}/${checks.length} checks.\n`);
process.exitCode = passed === checks.length ? 0 : 1;
