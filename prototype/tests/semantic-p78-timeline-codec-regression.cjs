'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, '..', 'lib', 'p78-timeline-codec.js');
const source = fs.readFileSync(sourcePath, 'utf8');
global.window = global;
require(sourcePath);
const codec = global.MRDP78TimelineCodec;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function deeplyFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Object.keys(value).every((key) => deeplyFrozen(value[key], seen));
}

const checks = [];
function check(name, run) {
  try { checks.push({ ok: true, name, detail: run() || '' }); }
  catch (error) { checks.push({ ok: false, name, detail: error.message || String(error) }); }
}

check('classic API is complete, versioned and deeply frozen', () => {
  assert(codec && codec.version === '1.0.0', 'codec export/version is missing');
  ['encodeBinary', 'decodeBinary', 'encodeMorse', 'encode', 'createReport', 'contentHash', 'getProfile', 'listProfiles']
    .forEach((name) => assert(typeof codec[name] === 'function', `${name} is missing`));
  assert(codec.bitOrder === 'msb0' && codec.encoding === 'UTF-8', 'canonical binary metadata changed');
  assert(codec.evidenceLevel === 'STRUCTURAL' && codec.soundness === 'NOT_COMPUTED', 'evidence boundary changed');
  assert(deeplyFrozen(codec), 'public API is mutable');
});

check('UTF-8 bytes and msb0 groups are canonical for mixed Unicode', () => {
  const result = codec.encodeBinary('AЯ🙂');
  assert(result.status === 'READY' && result.roundtripExact, 'mixed text did not encode exactly');
  assert(JSON.stringify(result.bytes) === JSON.stringify([0x41, 0xd0, 0xaf, 0xf0, 0x9f, 0x99, 0x82]), 'UTF-8 bytes changed');
  assert(JSON.stringify(result.groups) === JSON.stringify([
    '01000001', '11010000', '10101111', '11110000', '10011111', '10011001', '10000010',
  ]), 'msb0 groups changed');
  assert(result.bitLength === 56 && result.byteLength === 7, 'binary lengths changed');
  assert(deeplyFrozen(result), 'binary result is mutable');
});

check('content hash is deterministic SHA-256 over UTF-8 bytes', () => {
  const expected = 'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  const first = codec.encodeBinary('abc');
  const second = codec.encodeBinary('abc');
  assert(first.contentHash === expected, `unexpected SHA-256: ${first.contentHash}`);
  assert(codec.contentHash('abc') === expected, 'contentHash helper disagrees');
  assert(JSON.stringify(first) === JSON.stringify(second), 'binary encoding is nondeterministic');
});

check('binary roundtrip preserves the exact unnormalized snapshot', () => {
  const composed = codec.encodeBinary('é');
  const decomposed = codec.encodeBinary('e\u0301');
  const composedBack = codec.decodeBinary(composed);
  const decomposedBack = codec.decodeBinary(decomposed);
  assert(composedBack.status === 'READY' && composedBack.text === 'é', 'composed snapshot changed');
  assert(decomposedBack.status === 'READY' && decomposedBack.text === 'e\u0301', 'decomposed snapshot changed');
  assert(composed.contentHash !== decomposed.contentHash, 'implicit Unicode normalization occurred');
  assert(composed.normalizationProfile.normalization === 'NONE', 'normalization profile is not explicit');
});

check('decoder rejects malformed, contradictory or tampered binary', () => {
  const malformed = codec.decodeBinary([0xc0, 0x80]);
  const contradictory = codec.decodeBinary({ bytes: [65], groups: ['01000010'], bitOrder: 'msb0', encoding: 'UTF-8' });
  const contradictoryAlias = codec.decodeBinary({ groups: ['01000001'], byteGroups: ['01000010'] });
  const tamperedHash = codec.decodeBinary({ bytes: [65], contentHash: `sha256:${'0'.repeat(64)}` });
  const tamperedText = codec.decodeBinary({ bytes: [65], text: 'B' });
  const tamperedLength = codec.decodeBinary({ bytes: [65], byteLength: 2 });
  const wrongOrder = codec.decodeBinary({ bytes: [65], bitOrder: 'lsb0' });
  assert(malformed.status === 'INVALID' && malformed.code === 'CODEC_INVALID_UTF8', 'invalid UTF-8 was accepted');
  assert(contradictory.status === 'INVALID' && contradictory.code === 'CODEC_INVALID_BINARY', 'contradictory views were accepted');
  assert(contradictoryAlias.status === 'INVALID' && contradictoryAlias.code === 'CODEC_INVALID_BINARY', 'contradictory group aliases were accepted');
  assert(tamperedHash.status === 'INVALID' && tamperedHash.code === 'CODEC_HASH_MISMATCH', 'hash tampering was accepted');
  assert(tamperedText.status === 'INVALID' && tamperedText.code === 'CODEC_ROUNDTRIP_MISMATCH', 'snapshot text tampering was accepted');
  assert(tamperedLength.status === 'INVALID' && tamperedLength.code === 'CODEC_INVALID_BINARY', 'length tampering was accepted');
  assert(wrongOrder.status === 'INVALID' && wrongOrder.code === 'CODEC_INVALID_BINARY', 'non-msb0 data was accepted');
});

check('invalid JS Unicode and implicit normalization fail closed', () => {
  const loneSurrogate = codec.encodeBinary('\ud800');
  const normalized = codec.encodeBinary('é', { normalization: 'NFC' });
  assert(loneSurrogate.status === 'INVALID' && loneSurrogate.code === 'CODEC_INVALID_UNICODE', 'lone surrogate was silently replaced');
  assert(normalized.status === 'INVALID' && normalized.code === 'CODEC_NORMALIZATION_UNSUPPORTED', 'undeclared normalization was accepted');
  assert(codec.contentHash('\ud800') === null, 'invalid Unicode received a misleading hash');
});

check('International Morse emits exact dot, dash and intra-character timing', () => {
  const result = codec.encodeMorse('SOS');
  const units = result.timeline.map((event) => event.units);
  const expected = [1, 1, 1, 1, 1, 3, 3, 1, 3, 1, 3, 3, 1, 1, 1, 1, 1];
  assert(result.status === 'READY' && result.notation === '... --- ...', 'SOS notation changed');
  assert(JSON.stringify(units) === JSON.stringify(expected), `SOS timing changed: ${units.join(',')}`);
  assert(result.timeline.filter((event) => event.type === 'MARK').every((event) => event.units === 1 || event.units === 3), 'mark duration escaped 1/3');
  assert(result.timeline.filter((event) => event.gap === 'INTRA_CHARACTER').every((event) => event.units === 1), 'intra-character gap escaped 1');
});

check('Morse distinguishes character and word gaps as 3 and 7 units', () => {
  const characters = codec.encodeMorse('AB');
  const words = codec.encodeMorse('A B');
  assert(characters.timeline.some((event) => event.gap === 'CHARACTER' && event.units === 3), 'character gap is not 3');
  assert(!characters.timeline.some((event) => event.gap === 'WORD'), 'word gap appeared inside a word');
  assert(words.timeline.some((event) => event.gap === 'WORD' && event.units === 7), 'word gap is not 7');
  assert(!words.timeline.some((event) => event.gap === 'CHARACTER'), 'character gap replaced the word gap');
});

check('Morse profiles expose explicit alphabet, versions, timing and table hash', () => {
  const profiles = codec.listProfiles();
  assert(profiles.length === 2 && deeplyFrozen(profiles), 'profile list changed or is mutable');
  profiles.forEach((profile) => {
    assert(profile.id && profile.alphabetId && profile.version === '1.0.0', 'profile identity is incomplete');
    assert(profile.alphabetVersion === '1.0.0' && profile.tableVersion === '1.0.0', 'profile versions are incomplete');
    assert(/^sha256:[0-9a-f]{64}$/.test(profile.tableHash), 'tableHash is not explicit SHA-256');
    assert(profile.timing.dot === 1 && profile.timing.dash === 3, 'mark timing changed');
    assert(profile.timing.intraCharacterGap === 1 && profile.timing.characterGap === 3 && profile.timing.wordGap === 7, 'gap timing changed');
  });
  assert(JSON.stringify(codec.listProfiles()) === JSON.stringify(profiles), 'profile listing is nondeterministic');
});

check('Cyrillic never transliterates under the default international profile', () => {
  const onlyCyrillic = codec.encodeMorse('Привет');
  const mixed = codec.encodeMorse('SOS Привет');
  assert(onlyCyrillic.status === 'ABSTAIN' && onlyCyrillic.code === 'CODEC_UNSUPPORTED_SYMBOL', 'unsupported Cyrillic did not abstain');
  assert(onlyCyrillic.encodedCount === 0 && onlyCyrillic.unsupportedCount === 6, 'Cyrillic was transliterated or dropped');
  assert(mixed.status === 'PARTIAL' && mixed.encodedCount === 3 && mixed.unsupportedCount === 6, 'mixed alphabet status changed');
  assert(mixed.tokens.map((token) => token.symbol).join('') === 'SOS Привет', 'unsupported source symbols disappeared');
  assert(mixed.unsupported.map((token) => token.symbol).join('') === 'Привет', 'unsupported Cyrillic evidence changed');
});

check('explicit Cyrillic profile encodes Cyrillic without accepting Latin by guess', () => {
  const options = { profileId: codec.cyrillicProfileId };
  const before = JSON.stringify(options);
  const result = codec.encodeMorse('Привет 2', options);
  const latin = codec.encodeMorse('A', options);
  assert(result.status === 'READY' && result.profileExplicit, 'explicit Cyrillic profile was not used');
  assert(result.alphabetId === 'russian-cyrillic-morse' && result.tokens[0].pattern === '.--.', 'Cyrillic table changed');
  assert(latin.status === 'ABSTAIN' && latin.unsupported[0].symbol === 'A', 'Latin was guessed inside the Cyrillic profile');
  assert(JSON.stringify(options) === before, 'profile options were mutated');
});

check('unsupported non-alphabet symbols remain explicit in PARTIAL output', () => {
  const result = codec.encodeMorse('A🙂B');
  assert(result.status === 'PARTIAL' && result.code === 'CODEC_UNSUPPORTED_SYMBOL', 'unsupported emoji did not produce PARTIAL');
  assert(result.unsupportedCount === 1 && result.unsupported[0].symbol === '🙂', 'unsupported emoji disappeared');
  assert(result.unsupported[0].codePoint === 'U+1F642', 'unsupported code point changed');
  assert(result.tokens.map((token) => token.symbol).join('') === 'A🙂B', 'token accounting is not exact');
  assert(result.contract.inv.ok && result.contract.inv.inputAccounted, 'input-accounting invariant failed');
});

check('sequence report keeps binary exact when Morse is only partial', () => {
  const report = codec.encode('A🙂B');
  const decoded = codec.decodeBinary(report.binary);
  assert(report.status === 'PARTIAL' && report.morse.status === 'PARTIAL', 'report did not preserve Morse status');
  assert(report.binary.status === 'READY' && decoded.text === 'A🙂B', 'binary data stopped being exact');
  assert(report.contentHash === report.binary.contentHash && report.morse.contentHash === report.contentHash, 'layer hashes diverged');
  assert(report.evidenceLevel === 'STRUCTURAL' && report.soundness === 'NOT_COMPUTED' && report.semanticTruth === false, 'report overstates evidence');
  assert(deeplyFrozen(report), 'sequence report is mutable');
});

check('empty input is exact binary but an abstaining Morse timeline', () => {
  const binary = codec.encodeBinary('');
  const morse = codec.encodeMorse('');
  assert(binary.status === 'READY' && binary.byteLength === 0 && codec.decodeBinary(binary).text === '', 'empty binary roundtrip failed');
  assert(morse.status === 'ABSTAIN' && morse.code === 'CODEC_EMPTY_INPUT' && morse.timeline.length === 0, 'empty Morse did not abstain');
});

check('module is static and has no DOM, network, dynamic evaluation or runtime dependency', () => {
  const forbidden = [
    /\bdocument\s*\./, /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bBroadcastChannel\b/,
    /\beval\s*\(/, /\bnew\s+Function\s*\(/, /\brequire\s*\(/,
  ];
  forbidden.forEach((pattern) => assert(!pattern.test(source), `forbidden source pattern: ${pattern}`));
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  new vm.Script(source, { filename: sourcePath }).runInContext(vm.createContext(sandbox), { timeout: 2000 });
  const isolated = sandbox.MRDP78TimelineCodec;
  assert(isolated && isolated.encodeBinary('abc').status === 'READY', 'isolated classic IIFE failed');
  assert(isolated.encodeMorse('SOS').totalUnits === codec.encodeMorse('SOS').totalUnits, 'isolated result changed');
});

check('all repeated reports are byte-for-byte deterministic', () => {
  const text = 'Signal 7 / Сигнал';
  const options = { profileId: codec.defaultProfileId };
  const first = JSON.stringify(codec.createReport(text, options));
  for (let i = 0; i < 8; i++) {
    assert(JSON.stringify(codec.createReport(text, options)) === first, `report changed at repetition ${i + 1}`);
  }
  return codec.encodeBinary(text).contentHash;
});

checks.forEach((result) => console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`));
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
process.exitCode = failures ? 1 : 0;
