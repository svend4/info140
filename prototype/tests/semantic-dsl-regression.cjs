'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const MODULE_PATH = path.join(__dirname, '..', 'lib', 'semantic-command-dsl.js');
const RESULTS = [];

const SOURCE = Object.freeze({
  qtyAdd: 'add(QTY,QTY)',
  idEq: 'eq(ID,ID)',
  idNeq: 'neq(ID,ID)',
  mixedAdd: 'add(ID,QTY)',
  unknown: 'mystery(QTY,QTY)',
  malformed: 'add(QTY,',
  explicitObserve: 'observe(input:ID)->state:STATE',
  explicitOrbit: 'orbit(state:STATE)->effect:EFFECT',
});

const METHOD_NAMES = Object.freeze({
  parse: ['parse', 'parseCommand', 'parseExpression', 'parseDSL', 'parseDsl'],
  validate: ['validate', 'validateCommand', 'validateDSL', 'validateDsl', 'check', 'checkCommand', 'isValid'],
  compile: ['compile', 'compileCommand', 'compileDSL', 'compileDsl', 'build', 'buildCommand'],
  compose: ['compose', 'composeCommands', 'composeCommand', 'chain', 'pipe'],
});

const EXPORT_NAMES = [
  'MRDSemanticCommandDSL',
  'SemanticCommandDSL',
  'MRDSemanticDSL',
  'SemanticDSL',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isObject(value) {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function hasOwn(value, key) {
  return isObject(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function describe(value) {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return Object.prototype.toString.call(value);
  }
}

function check(name, run) {
  try {
    const detail = run();
    RESULTS.push({ ok: true, name, detail: detail || '' });
  } catch (error) {
    RESULTS.push({
      ok: false,
      name,
      detail: error && error.message ? error.message : String(error),
    });
  }
}

function capture(run) {
  try {
    return { threw: false, value: run() };
  } catch (error) {
    return { threw: true, error };
  }
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function explicitOutcome(value, depth, seen) {
  if (typeof value === 'boolean') return value;
  if (!isObject(value) || depth > 4) return null;

  seen = seen || new Set();
  if (seen.has(value)) return null;
  seen.add(value);

  const signals = [];
  ['valid', 'ok', 'success', 'accepted', 'compatible'].forEach((key) => {
    if (hasOwn(value, key) && typeof value[key] === 'boolean') signals.push(value[key]);
  });

  ['status', 'state', 'verdict', 'result'].forEach((key) => {
    if (!hasOwn(value, key) || typeof value[key] !== 'string') return;
    const status = normalizeStatus(value[key]);
    if (['valid', 'ok', 'accept', 'accepted', 'success', 'succeeded', 'compiled', 'composed'].includes(status)) {
      signals.push(true);
    }
    if (['invalid', 'error', 'fail', 'failed', 'reject', 'rejected', 'blocked', 'incompatible'].includes(status)) {
      signals.push(false);
    }
  });

  ['errors', 'diagnostics', 'issues'].forEach((key) => {
    if (hasOwn(value, key) && Array.isArray(value[key])) signals.push(value[key].length === 0);
  });

  if (hasOwn(value, 'error') && value.error) signals.push(false);
  if (signals.includes(false)) return false;
  if (signals.includes(true)) return true;

  for (const key of ['validation', 'outcome', 'result', 'value']) {
    if (!hasOwn(value, key) || value[key] === value) continue;
    const nested = explicitOutcome(value[key], depth + 1, seen);
    if (nested !== null) return nested;
  }
  return null;
}

function assess(call, mode) {
  if (call.threw) {
    return { ok: false, explicit: true, detail: describe(call.error), call };
  }

  const explicit = explicitOutcome(call.value, 0);
  if (explicit !== null) {
    return { ok: explicit, explicit: true, detail: describe(call.value), call };
  }

  if (call.value === null) {
    return { ok: false, explicit: false, detail: 'null', call };
  }

  if (mode === 'validate' && Array.isArray(call.value)) {
    return {
      ok: call.value.length === 0,
      explicit: true,
      detail: `${call.value.length} validation issue(s)`,
      call,
    };
  }

  // Parsers and compilers commonly signal failure by throwing and return an AST/artifact on success.
  return { ok: true, explicit: false, detail: describe(call.value), call };
}

function methods(api, kind) {
  return METHOD_NAMES[kind]
    .filter((name) => typeof api[name] === 'function')
    .map((name) => ({ name, call: api[name].bind(api) }));
}

function looksLikeDslApi(value) {
  if (!isObject(value)) return false;
  const semanticMethods = [...METHOD_NAMES.parse, ...METHOD_NAMES.validate, ...METHOD_NAMES.compile];
  return semanticMethods.some((name) => typeof value[name] === 'function')
    && METHOD_NAMES.compose.some((name) => typeof value[name] === 'function');
}

function loadBrowserIife(filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const sandbox = Object.create(null);
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.console = console;

  const before = new Set(Reflect.ownKeys(sandbox));
  const context = vm.createContext(sandbox);
  new vm.Script(source, { filename }).runInContext(context, { timeout: 2000 });

  for (const name of EXPORT_NAMES) {
    if (looksLikeDslApi(sandbox[name])) return { api: sandbox[name], exportName: name };
  }

  const discovered = Reflect.ownKeys(sandbox)
    .filter((key) => !before.has(key))
    .filter((key) => looksLikeDslApi(sandbox[key]));
  assert(discovered.length === 1, discovered.length
    ? `ambiguous DSL exports: ${discovered.join(', ')}`
    : `no browser-global DSL API found; tried ${EXPORT_NAMES.join(', ')}`);
  return { api: sandbox[discovered[0]], exportName: String(discovered[0]) };
}

function payloadVariants(value, prefix) {
  const variants = [{ id: prefix, value }];
  if (!isObject(value)) return variants;

  for (const key of ['ast', 'command', 'compiled', 'node', 'value', 'result', 'program']) {
    if (!hasOwn(value, key) || !isObject(value[key]) || value[key] === value) continue;
    variants.push({ id: `${prefix}.${key}`, value: value[key] });
  }
  return variants;
}

function dedupeVariants(variants) {
  const primitives = new Set();
  const objects = new Set();
  return variants.filter((variant) => {
    if (isObject(variant.value)) {
      if (objects.has(variant.value)) return false;
      objects.add(variant.value);
      return true;
    }
    const key = `${typeof variant.value}:${String(variant.value)}`;
    if (primitives.has(key)) return false;
    primitives.add(key);
    return true;
  });
}

function createAdapter(api) {
  const parseMethods = methods(api, 'parse');
  const validateMethods = methods(api, 'validate');
  const compileMethods = methods(api, 'compile');
  const composeMethods = methods(api, 'compose');

  assert(validateMethods.length || compileMethods.length,
    `expected one of ${[...METHOD_NAMES.validate, ...METHOD_NAMES.compile].join(', ')}`);
  assert(composeMethods.length, `expected one of ${METHOD_NAMES.compose.join(', ')}`);

  function inputVariants(source) {
    const variants = [{ id: 'source', value: source }];
    for (const parser of parseMethods) {
      const parsed = capture(() => parser.call(source));
      const outcome = assess(parsed, 'parse');
      if (!outcome.ok) continue;
      variants.push(...payloadVariants(parsed.value, `parse:${parser.name}`));
    }
    return dedupeVariants(variants);
  }

  function invokeSemantic(strategy, source) {
    const input = inputVariants(source).find((variant) => variant.id === strategy.inputId);
    if (!input) {
      return {
        ok: false,
        explicit: true,
        detail: `${strategy.inputId} was not produced (syntax rejected)`,
      };
    }
    return assess(capture(() => strategy.method.call(input.value)), strategy.kind);
  }

  let validationStrategy = null;

  function selectValidationStrategy() {
    if (validationStrategy) return validationStrategy;

    const candidates = [];
    for (const kind of ['validate', 'compile']) {
      const list = kind === 'validate' ? validateMethods : compileMethods;
      for (const method of list) {
        for (const input of inputVariants(SOURCE.qtyAdd)) {
          candidates.push({ kind, method, inputId: input.id });
        }
      }
    }

    for (const candidate of candidates) {
      const valid = invokeSemantic(candidate, SOURCE.qtyAdd);
      if (valid.ok) {
        validationStrategy = candidate;
        return candidate;
      }
    }

    throw new Error('no validate/compile call accepts add(QTY,QTY)');
  }

  function validate(source) {
    return invokeSemantic(selectValidationStrategy(), source);
  }

  function representationVariants(source) {
    const inputs = inputVariants(source);
    const variants = [];

    for (const compiler of compileMethods) {
      for (const input of inputs) {
        const compiled = capture(() => compiler.call(input.value));
        if (!assess(compiled, 'compile').ok) continue;
        variants.push(...payloadVariants(compiled.value, `compile:${compiler.name}<-${input.id}`));
      }
    }

    variants.push(...inputs);
    return dedupeVariants(variants);
  }

  function callCompose(method, form, left, right) {
    if (form === 'array') return method.call([left, right]);
    if (form === 'object') return method.call({ left, right });
    return method.call(left, right);
  }

  let compositionStrategy = null;

  function invokeComposition(strategy, leftSource, rightSource) {
    const left = representationVariants(leftSource).find((item) => item.id === strategy.leftId);
    const right = representationVariants(rightSource).find((item) => item.id === strategy.rightId);
    if (!left || !right) {
      return {
        ok: false,
        explicit: true,
        detail: `composition inputs unavailable: ${strategy.leftId}, ${strategy.rightId}`,
      };
    }
    const call = capture(() => callCompose(strategy.method, strategy.form, left.value, right.value));
    return assess(call, 'compose');
  }

  function selectCompositionStrategy() {
    if (compositionStrategy) return compositionStrategy;

    const left = representationVariants(SOURCE.qtyAdd);
    const compatibleRight = representationVariants(SOURCE.qtyAdd);
    const forms = ['pair', 'array', 'object'];

    for (const method of composeMethods) {
      for (const form of forms) {
        for (const leftValue of left) {
          for (const rightValue of compatibleRight) {
            const candidate = {
              method,
              form,
              leftId: leftValue.id,
              rightId: rightValue.id,
            };
            const compatible = invokeComposition(candidate, SOURCE.qtyAdd, SOURCE.qtyAdd);
            const incompatible = invokeComposition(candidate, SOURCE.qtyAdd, SOURCE.idEq);
            if (compatible.ok && !incompatible.ok) {
              compositionStrategy = candidate;
              return candidate;
            }
          }
        }
      }
    }

    throw new Error('no compose call accepts QTY -> QTY and blocks QTY -> ID');
  }

  function compose(leftSource, rightSource) {
    return invokeComposition(selectCompositionStrategy(), leftSource, rightSource);
  }

  return {
    names: {
      parse: parseMethods.map((item) => item.name),
      validate: validateMethods.map((item) => item.name),
      compile: compileMethods.map((item) => item.name),
      compose: composeMethods.map((item) => item.name),
    },
    validate,
    compose,
    validationStrategy: selectValidationStrategy,
    compositionStrategy: selectCompositionStrategy,
  };
}

function findContract(value, depth, seen) {
  if (!isObject(value) || depth > 7) return null;
  seen = seen || new Set();
  if (seen.has(value)) return null;
  seen.add(value);

  const required = ['pre', 'inv', 'post', 'proof', 'evidence'];
  if (required.every((key) => hasOwn(value, key))) return value;
  if (hasOwn(value, 'contract')) {
    const contract = findContract(value.contract, depth + 1, seen);
    if (contract) return contract;
  }

  for (const key of Object.keys(value)) {
    const nested = findContract(value[key], depth + 1, seen);
    if (nested) return nested;
  }
  return null;
}

function hasPayload(value) {
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === 'string' || Array.isArray(value)) return value.length > 0;
  return true;
}

function collectNamed(value, property, depth, seen, output) {
  output = output || [];
  if (!isObject(value) || depth > 8) return output;
  seen = seen || new Set();
  if (seen.has(value)) return output;
  seen.add(value);

  if (hasOwn(value, property)) output.push(value[property]);
  for (const key of Object.keys(value)) {
    collectNamed(value[key], property, depth + 1, seen, output);
  }
  return output;
}

function compact(value, maxLength) {
  const oneLine = String(value || '').replace(/\s+/g, ' ').trim();
  return oneLine.length <= maxLength ? oneLine : `${oneLine.slice(0, maxLength - 3)}...`;
}

function printTable(rows) {
  const normalized = rows.map((row) => ({
    result: row.ok ? 'PASS' : 'FAIL',
    check: compact(row.name, 38),
    detail: compact(row.detail, 100),
  }));
  const headers = { result: 'RESULT', check: 'CHECK', detail: 'DETAIL' };
  const widths = {
    result: Math.max(headers.result.length, ...normalized.map((row) => row.result.length)),
    check: Math.max(headers.check.length, ...normalized.map((row) => row.check.length)),
    detail: Math.max(headers.detail.length, ...normalized.map((row) => row.detail.length)),
  };
  const format = (row) => `${row.result.padEnd(widths.result)} | ${row.check.padEnd(widths.check)} | ${row.detail}`;

  console.log(format(headers));
  console.log(`${'-'.repeat(widths.result)}-+-${'-'.repeat(widths.check)}-+-${'-'.repeat(widths.detail)}`);
  normalized.forEach((row) => console.log(format(row)));
}

let loaded = null;
let adapter = null;
let compatibleComposition = null;

check('browser IIFE export and API', () => {
  assert(fs.existsSync(MODULE_PATH), `missing ${MODULE_PATH}`);
  loaded = loadBrowserIife(MODULE_PATH);
  adapter = createAdapter(loaded.api);
  const available = Object.entries(adapter.names)
    .filter((entry) => entry[1].length)
    .map((entry) => `${entry[0]}=${entry[1].join('/')}`);
  return `${loaded.exportName}; ${available.join('; ')}`;
});

if (adapter) {
  check('QTY add is valid', () => {
    const result = adapter.validate(SOURCE.qtyAdd);
    assert(result.ok, `${SOURCE.qtyAdd} rejected: ${result.detail}`);
    const strategy = adapter.validationStrategy();
    return `${strategy.method.name}(${strategy.inputId})`;
  });

  check('ID eq and neq are valid', () => {
    for (const source of [SOURCE.idEq, SOURCE.idNeq]) {
      const result = adapter.validate(source);
      assert(result.ok, `${source} rejected: ${result.detail}`);
    }
    return `${SOURCE.idEq}; ${SOURCE.idNeq}`;
  });

  check('mixed add is invalid', () => {
    const result = adapter.validate(SOURCE.mixedAdd);
    assert(!result.ok, `${SOURCE.mixedAdd} was accepted`);
    return SOURCE.mixedAdd;
  });

  check('unknown operation is invalid', () => {
    const result = adapter.validate(SOURCE.unknown);
    assert(!result.ok, `${SOURCE.unknown} was accepted`);
    return SOURCE.unknown;
  });

  check('malformed syntax is invalid', () => {
    const result = adapter.validate(SOURCE.malformed);
    assert(!result.ok, `${SOURCE.malformed} was accepted`);
    return SOURCE.malformed;
  });

  check('compatible ports compose', () => {
    compatibleComposition = adapter.compose(SOURCE.qtyAdd, SOURCE.qtyAdd);
    assert(compatibleComposition.ok, `QTY output -> QTY input rejected: ${compatibleComposition.detail}`);
    const strategy = adapter.compositionStrategy();
    return `${strategy.method.name}/${strategy.form}: QTY -> QTY`;
  });

  check('incompatible ports are blocked', () => {
    const result = adapter.compose(SOURCE.qtyAdd, SOURCE.idEq);
    assert(!result.ok, 'QTY output -> ID input was accepted');
    return 'QTY -> ID blocked';
  });

  check('explicit STATE ports compose when supported', () => {
    const observe = adapter.validate(SOURCE.explicitObserve);
    const orbit = adapter.validate(SOURCE.explicitOrbit);
    if (!observe.ok && !orbit.ok) return 'explicit-port declarations are not supported by this API';

    assert(observe.ok && orbit.ok,
      `partial explicit-port support: observe=${observe.ok}, orbit=${orbit.ok}`);
    const result = adapter.compose(SOURCE.explicitObserve, SOURCE.explicitOrbit);
    assert(result.ok, `STATE output -> STATE input rejected: ${result.detail}`);
    return `${SOURCE.explicitObserve} + ${SOURCE.explicitOrbit}`;
  });

  check('composite contract is complete', () => {
    compatibleComposition = compatibleComposition || adapter.compose(SOURCE.qtyAdd, SOURCE.qtyAdd);
    assert(compatibleComposition.ok, 'compatible composition unavailable');
    const contract = findContract(compatibleComposition.call.value, 0);
    assert(contract, 'composition has no contract with pre/inv/post/proof/evidence');
    for (const key of ['pre', 'inv', 'post', 'proof', 'evidence']) {
      assert(hasPayload(contract[key]), `composite contract.${key} is empty or false`);
    }
    return 'pre/inv/post/proof/evidence present';
  });

  check('soundness remains NOT_COMPUTED', () => {
    compatibleComposition = compatibleComposition || adapter.compose(SOURCE.qtyAdd, SOURCE.qtyAdd);
    assert(compatibleComposition.ok, 'compatible composition unavailable');
    const values = collectNamed(compatibleComposition.call.value, 'soundness', 0);
    assert(values.length > 0, 'composition exposes no soundness field');
    assert(values.every((value) => value === 'NOT_COMPUTED'),
      `unexpected soundness: ${values.map(describe).join(', ')}`);
    return `${values.length} soundness field(s) = NOT_COMPUTED`;
  });
}

printTable(RESULTS);
const failures = RESULTS.filter((result) => !result.ok).length;
console.log(`\n${failures ? 'FAIL' : 'PASS'}: ${RESULTS.length - failures}/${RESULTS.length} checks.`);
process.exitCode = failures ? 1 : 0;
