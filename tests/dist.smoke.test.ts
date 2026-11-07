import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Smoke test for the built, ESM-only `dist/` artefacts.
 *
 * Why this exists: the package ships one ES module, and CommonJS consumers
 * load that same file through Node's `require(esm)` (unflagged since Node
 * 22.12). That only works while the `exports` map exposes the file under
 * `default` (Node's `require()` never matches an `import` condition) and while
 * the module stays synchronous (a top-level `await` makes `require()` throw
 * `ERR_REQUIRE_ASYNC_MODULE`). Neither would be caught by the source-level
 * Jest run, which imports `../src`; both are caught here.
 *
 * The test is auto-skipped if `dist/` has not been built (e.g. a fresh clone
 * before `npm run prepare`), so it never blocks contributors who only edit
 * source.
 *
 * Implementation note: every check runs in a fresh Node subprocess, and loads
 * the package by its name, so it resolves through the real `exports` map
 * (a package can import itself by name). Jest runs these tests in CommonJS
 * mode, and both `import()` and `createRequire` inside a test go through
 * Jest's own module system, which cannot load an ES module ("Must use import
 * to load ES Module"). The subprocess measures what a real consumer sees.
 */
const root = join(__dirname, '..')
const distRoot = join(root, 'dist')
const esmEntry = join(distRoot, 'esm', 'index.min.js')
const ownPackageJson = join(root, 'package.json')

// The public runtime API: 13 functions and the error class, plus RUT_PATTERN.
const FUNCTION_NAMES = [
  'validate',
  'clean',
  'format',
  'calculateVerifier',
  'getBody',
  'getVerifier',
  'decompose',
  'generate',
  'isRutLike',
  'isValidRut',
  'mask',
  'equals',
  'InvalidRutError',
] as const
const EXPECTED_NAMES = [...FUNCTION_NAMES, 'RUT_PATTERN'].sort()

// The one export that is not a function: a plain object of pattern strings.
const PATTERN_KEYS = ['any', 'compact', 'dotted', 'hyphen']

// Runs `script` in a fresh Node process from the package root and parses the
// JSON it writes to stdout.
function runNode(inputType: 'module' | 'commonjs', script: string): unknown {
  const stdout = execFileSync(process.execPath, [`--input-type=${inputType}`, '-e', script], {
    cwd: root,
    encoding: 'utf8',
  })
  return JSON.parse(stdout)
}

// The checks both loaders must pass. Kept as a string: it runs in the child.
const PROBE = `(mod) => ({
  names: Object.keys(mod).sort(),
  functions: ${JSON.stringify(FUNCTION_NAMES)}.every((n) => typeof mod[n] === 'function'),
  validateOk: mod.validate('12.345.678-5') === true,
  formatOk: mod.format('123456785') === '12.345.678-5',
  calcOk: mod.calculateVerifier('12345678') === '5',
  // The 5.0.0 equals default: wrong-verifier pairs are not "the same RUT".
  equalsOk: mod.equals('12345678-9', '12345678-9') === false,
  patternKeys: Object.keys(mod.RUT_PATTERN ?? {}).sort(),
  patternOk: new RegExp(mod.RUT_PATTERN?.hyphen ?? '$^').test('12345678-5'),
})`

const PROBE_RESULT = {
  names: EXPECTED_NAMES,
  functions: true,
  validateOk: true,
  formatOk: true,
  calcOk: true,
  equalsOk: true,
  patternKeys: PATTERN_KEYS,
  patternOk: true,
}

const distExists = existsSync(esmEntry)
const guarded = distExists ? describe : describe.skip

guarded('dist smoke (ESM-only package)', () => {
  test('import() of the package resolves to the ESM build and exposes the full public API', () => {
    const result = runNode(
      'module',
      `
      const mod = await import('rut.ts');
      process.stdout.write(JSON.stringify({
        resolved: import.meta.resolve('rut.ts'),
        ...(${PROBE})(mod),
      }));
    `,
    )
    expect(result).toEqual({ resolved: expect.stringMatching(/\/dist\/esm\/index\.min\.js$/), ...PROBE_RESULT })
    expect(EXPECTED_NAMES).toHaveLength(14)
  })

  test('require() of the package loads the same ESM build and exposes the same public API', () => {
    // This child is plain CommonJS, like a consumer that never heard of ESM.
    // It fails with ERR_PACKAGE_PATH_NOT_EXPORTED if `exports` only offers an
    // `import` condition, and with ERR_REQUIRE_ASYNC_MODULE if the build ever
    // gains a top-level await.
    const result = runNode(
      'commonjs',
      `
      const req = require('node:module').createRequire(${JSON.stringify(ownPackageJson)});
      let mod;
      try {
        mod = req('rut.ts');
      } catch (err) {
        process.stdout.write(JSON.stringify({ requireFailed: err.code ?? String(err) }));
        process.exit(0);
      }
      process.stdout.write(JSON.stringify({
        resolved: req.resolve('rut.ts'),
        ...(${PROBE})(mod),
      }));
    `,
    )
    expect(result).toEqual({ resolved: join(distRoot, 'esm', 'index.min.js'), ...PROBE_RESULT })
  })

  test('an InvalidRutError obtained through require() is instanceof the class obtained through import()', () => {
    // With one build there is one class: require() and import() hand back the
    // same module instance, so the dual package hazard cannot occur.
    const result = runNode(
      'module',
      `
      import { createRequire } from 'node:module';
      const viaImport = await import('rut.ts');
      const viaRequire = createRequire(${JSON.stringify(ownPackageJson)})('rut.ts');
      const thrown = (fn) => { try { fn() } catch (err) { return err } };
      const fromRequire = thrown(() => viaRequire.clean('not-a-rut'));
      const fromImport = thrown(() => viaImport.format('12.345.678-9'));
      process.stdout.write(JSON.stringify({
        sameClass: viaRequire.InvalidRutError === viaImport.InvalidRutError,
        requireErrorIsImportInstance: fromRequire instanceof viaImport.InvalidRutError,
        importErrorIsRequireInstance: fromImport instanceof viaRequire.InvalidRutError,
        codes: [fromRequire.code, fromImport.code],
        plainErrorIsInstance: new Error() instanceof viaImport.InvalidRutError,
      }));
    `,
    )
    expect(result).toEqual({
      sameClass: true,
      requireErrorIsImportInstance: true,
      importErrorIsRequireInstance: true,
      codes: ['INVALID_RUT', 'INVALID_RUT'],
      plainErrorIsInstance: false,
    })
  })

  test('there is no CommonJS build any more', () => {
    expect(existsSync(join(distRoot, 'cjs'))).toBe(false)
  })

  test('the cross-copy check leaves the published typings unchanged', () => {
    // `Symbol.hasInstance` is kept out of the .d.ts on purpose: TypeScript keeps
    // narrowing instanceof from the constructor, and the typings need no
    // `Symbol` in the consumer's `lib`.
    const source = readFileSync(join(distRoot, 'esm', 'index.d.ts'), 'utf8')
    expect(source).toContain('export declare class InvalidRutError extends Error {')
    expect(source).not.toMatch(/hasInstance|Symbol\./)
  })
})
