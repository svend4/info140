'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = __dirname;
const suites = fs.readdirSync(root)
  .filter((name) => name === 'semantic-regression.cjs' || /^semantic-.*-regression\.cjs$/.test(name))
  .sort();

let failedSuites = 0;
let passedChecks = 0;
let totalChecks = 0;

for (const suite of suites) {
  const result = spawnSync(process.execPath, [path.join(root, suite)], {
    cwd: path.join(root, '..', '..'),
    encoding: 'utf8',
    windowsHide: true,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (output) process.stdout.write(`${output}\n`);

  const checkSummary = output.match(/(?:PASS|FAIL):\s*(\d+)\/(\d+)\s+checks/i);
  const legacySummary = output.match(/SUMMARY\s+pass=(\d+)\s+fail=(\d+)/i);
  if (checkSummary) {
    passedChecks += Number(checkSummary[1]);
    totalChecks += Number(checkSummary[2]);
  } else if (legacySummary) {
    passedChecks += Number(legacySummary[1]);
    totalChecks += Number(legacySummary[1]) + Number(legacySummary[2]);
  }

  if (result.status !== 0) failedSuites++;
  process.stdout.write(`SUITE ${result.status === 0 ? 'PASS' : 'FAIL'} | ${suite}\n\n`);
}

const passedSuites = suites.length - failedSuites;
process.stdout.write(
  `ALL ${failedSuites ? 'FAIL' : 'PASS'} | suites ${passedSuites}/${suites.length}` +
  (totalChecks ? ` | checks ${passedChecks}/${totalChecks}` : '') + '\n',
);
process.exitCode = failedSuites ? 1 : 0;
