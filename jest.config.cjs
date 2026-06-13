/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  // Only TS sources are transformed. The dual-package smoke test loads the
  // already-compiled `dist/*.min.js` via Node's own require/import, so handing
  // those `.js` files to ts-jest only produced the spurious `allowJs` warning.
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  // `[jt]s` matches only `.js`/`.ts`. The old `(js?|ts?)` made the trailing `s`
  // optional, so it also matched stray `.j` / `.t` files.
  testRegex: '(/tests/.*|(\\.|/)(test|spec))\\.[jt]s$',
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  testEnvironment: 'node',
  // Coverage is measured against source, never the built `dist/*.min.js` that
  // the smoke test imports (which otherwise showed up at ~49%).
  collectCoverageFrom: ['src/**/*.ts'],
  // Source coverage is ~99% stmts / ~96% branch / 100% funcs / ~99% lines.
  // The branch gap is defensive/unreachable code (redundant length checks in
  // `isCleanRut`, the `: null`/`: fail` fallbacks in `getVerifier`/`decompose`
  // that `clean()` already rules out) plus native `?.`/`??` short-circuits the
  // ES2020 target emits as branches. These thresholds are a regression ratchet
  // sitting just under the real floor: CI fails on any drop. Raise them if real
  // coverage improves.
  coverageThreshold: {
    global: { statements: 98, branches: 95, functions: 100, lines: 98 },
  },
}
