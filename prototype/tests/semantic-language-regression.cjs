const fs = require('fs');
const path = require('path');
const vm = require('vm');

const lib = (name) => path.join(__dirname, '..', 'lib', `${name}.js`);
const coreFilename = lib('semantic-core');
const languageFilename = lib('semantic-language');
const languageSource = fs.readFileSync(languageFilename, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadBrowserContract() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);

  for (const filename of [coreFilename, languageFilename]) {
    const source = fs.readFileSync(filename, 'utf8');
    new vm.Script(source, { filename }).runInContext(context, { timeout: 2000 });
  }

  return sandbox.MRDSemanticLanguage;
}

function occurrence(result, token) {
  const found = result.occurrences.find((item) => item.token === token);
  assert(found, `occurrence not found: ${token}`);
  return found;
}

function grammarCheck(result, type) {
  const found = result.grammar.checks.find((item) => item.type === type);
  assert(found, `grammar check not found: ${type}`);
  return found;
}

const language = loadBrowserContract();
const analyze = (text) => language.analyze(text);
const checks = [];

function check(name, run) {
  try {
    checks.push({ ok: true, name, detail: run() || '' });
  } catch (error) {
    checks.push({ ok: false, name, detail: error.message || String(error) });
  }
}

check('browser IIFE exports a versioned language contract', () => {
  assert(language && typeof language === 'object', 'MRDSemanticLanguage export is missing');
  assert(/^\d+\.\d+\.\d+$/.test(language.version), `unexpected version: ${language.version}`);
  assert(typeof language.analyze === 'function', 'analyze export is missing');
  assert(typeof language.tokenize === 'function', 'tokenize export is missing');
  assert(typeof language.annotate === 'function', 'annotate export is missing');
  assert(language.constants && language.constants.mode === 'RULE_BASED_MINI_RU', 'mode metadata is missing');
  const result = analyze('Ключ лежит рядом.');
  assert(result.version === language.version, 'analysis version does not match export version');
  assert(result.kind === 'MRDSemanticLanguageAnalysis', `unexpected result kind: ${result.kind}`);
  return `v${language.version}`;
});

check('language source avoids dynamic code evaluation', () => {
  assert(!/\beval\s*\(/.test(languageSource), 'eval() is present');
  assert(!/\bnew\s+Function\b/.test(languageSource), 'new Function is present');
  return 'no eval/new Function';
});

check('key and lock resolve as physical object and device', () => {
  const result = analyze('Ключ открыл замок.');
  const key = occurrence(result, 'ключ');
  const lock = occurrence(result, 'замок');
  assert(key.senseStatus === 'RESOLVED', `key status: ${key.senseStatus}`);
  assert(key.senseId === 'key.object', `key sense: ${key.senseId}`);
  assert(lock.senseStatus === 'RESOLVED', `lock status: ${lock.senseStatus}`);
  assert(lock.senseId === 'lock.device', `lock sense: ${lock.senseId}`);
  assert(result.grammar.status === 'PASS', `grammar status: ${result.grammar.status}`);
  return `${key.senseId} + ${lock.senseId}; grammar PASS`;
});

check('spring context resolves key as a water source', () => {
  const result = analyze('Ключ журчит из земли.');
  const key = occurrence(result, 'ключ');
  assert(key.senseStatus === 'RESOLVED', `key status: ${key.senseStatus}`);
  assert(key.senseId === 'key.spring', `key sense: ${key.senseId}`);
  assert(key.senseConfidence > 0 && key.senseConfidence <= 1, `sense confidence: ${key.senseConfidence}`);
  return key.senseId;
});

check('unsupported key context remains honestly ambiguous', () => {
  const result = analyze('Ключ лежит рядом.');
  const key = occurrence(result, 'ключ');
  const ambiguity = result.ambiguities.find((item) => item.index === key.index);
  assert(key.senseStatus === 'AMBIGUOUS', `key status: ${key.senseStatus}`);
  assert(key.senseId === null, `invented key sense: ${key.senseId}`);
  assert(key.senseConfidence === 0, `ambiguous confidence: ${key.senseConfidence}`);
  assert(ambiguity && ambiguity.resolved === false, 'unresolved ambiguity record is missing');
  assert(ambiguity.candidates.length >= 2, 'sense candidates are missing');
  return `${ambiguity.candidates.length} candidates`;
});

check('matching adjective and noun agreement passes', () => {
  const result = analyze('Старый мост стоит.');
  const agreement = grammarCheck(result, 'agreement');
  assert(result.grammar.status === 'PASS', `grammar status: ${result.grammar.status}`);
  assert(agreement.status === 'PASS', `agreement status: ${agreement.status}`);
  assert(agreement.relation === 'amod', `agreement relation: ${agreement.relation}`);
  assert(agreement.known >= 2, `known agreement features: ${agreement.known}`);
  return `agreement ${agreement.status}`;
});

check('gender disagreement produces a grammar conflict', () => {
  const result = analyze('Старая мост стоит.');
  const agreement = grammarCheck(result, 'agreement');
  assert(result.grammar.status === 'CONFLICT', `grammar status: ${result.grammar.status}`);
  assert(agreement.status === 'FAIL', `agreement status: ${agreement.status}`);
  assert(agreement.issues.includes('gender'), `agreement issues: ${agreement.issues.join(', ')}`);
  assert(result.grammar.failures.includes(agreement), 'failed agreement is absent from grammar.failures');
  return `conflict: ${agreement.issues.join(', ')}`;
});

check('accusative object satisfies read valency', () => {
  const result = analyze('Герой читает книгу.');
  const valency = grammarCheck(result, 'valency');
  assert(result.grammar.status === 'PASS', `grammar status: ${result.grammar.status}`);
  assert(valency.status === 'PASS', `valency status: ${valency.status}`);
  assert(valency.relation === 'obj', `valency relation: ${valency.relation}`);
  assert(valency.expected.case === 'ACC', `expected case: ${valency.expected.case}`);
  assert(valency.actual && valency.actual.case.split('|').includes('ACC'), `actual case: ${valency.actual && valency.actual.case}`);
  return `${valency.actual.lemma}:${valency.actual.case}`;
});

check('nominative object violates read valency', () => {
  const result = analyze('Герой читает книга.');
  const valency = grammarCheck(result, 'valency');
  assert(result.grammar.status === 'CONFLICT', `grammar status: ${result.grammar.status}`);
  assert(valency.status === 'FAIL', `valency status: ${valency.status}`);
  assert(valency.expected.case === 'ACC', `expected case: ${valency.expected.case}`);
  assert(valency.actual && valency.actual.case === 'NOM', `actual case: ${valency.actual && valency.actual.case}`);
  assert(result.grammar.failures.includes(valency), 'failed valency is absent from grammar.failures');
  return `${valency.actual.lemma}:${valency.actual.case}`;
});

check('onion and bow contexts select different senses', () => {
  const food = analyze('Лук как овощ рос на грядке.');
  const shooting = analyze('Лук выпустил стрелу.');
  const onion = occurrence(food, 'лук');
  const bow = occurrence(shooting, 'лук');
  assert(onion.senseStatus === 'RESOLVED', `onion status: ${onion.senseStatus}`);
  assert(onion.senseId === 'onion.plant', `food-context sense: ${onion.senseId}`);
  assert(bow.senseStatus === 'RESOLVED', `bow status: ${bow.senseStatus}`);
  assert(bow.senseId === 'bow.weapon', `shooting-context sense: ${bow.senseId}`);
  assert(onion.senseId !== bow.senseId, 'contexts produced the same sense');
  return `${onion.senseId} != ${bow.senseId}`;
});

check('unknown words keep low confidence and no invented sense', () => {
  const result = analyze('Кваргл фыркает.');
  const unknown = result.occurrences.filter((item) => item.match === 'oov');
  assert(unknown.length === 2, `OOV count: ${unknown.length}`);
  assert(result.status === 'PARTIAL', `analysis status: ${result.status}`);
  assert(result.coverage === 0, `coverage: ${result.coverage}`);
  unknown.forEach((item) => {
    assert(item.confidence <= 0.3, `${item.token} confidence is too high: ${item.confidence}`);
    assert(item.senseId === null, `${item.token} received an invented sense: ${item.senseId}`);
    assert(item.senseConfidence === 0, `${item.token} sense confidence: ${item.senseConfidence}`);
  });
  return `OOV confidence <= ${Math.max(...unknown.map((item) => item.confidence))}`;
});

checks.forEach((result) => {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} | ${result.name}${result.detail ? ` | ${result.detail}` : ''}`);
});
const failures = checks.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${checks.length - failures}/${checks.length} checks.`);
if (failures) process.exitCode = 1;
