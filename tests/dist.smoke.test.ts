import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Dual-package smoke test for the built `dist/` artefacts.
 *
 * Why this exists: the project ships both ESM and CJS entries with their own
 * type definitions. The dual-build wiring is fragile — package.json `exports`,
 * the per-target `tsc --module` flags, the minifier step, and the
 * `dist/cjs/package.json` `{"type":"commonjs"}` marker all have to stay in
 * sync. A regression in any of those would not be caught by the source-level
 * jest run, but it WILL be caught here as soon as the smoke fails to import.
 *
 * On a contributor's machine the test is skipped if `dist/` has not been built
 * (e.g. a fresh clone before `npm run prepare`), so it never blocks
 * contributors who only edit source. In CI (`CI` set) a missing `dist/` fails
 * instead: otherwise a broken build would pass its own dist checks.
 *
 * Implementation note: the ESM smoke spawns a fresh Node subprocess to load
 * the .esm.min.js file under the real ESM loader. Jest's ts-jest host runs
 * tests in CJS mode, so a direct `import()` from inside a test would route
 * through Jest's module transformer and silently re-evaluate the file as
 * CJS — defeating the point of the smoke. The subprocess approach measures
 * what an actual consumer would see.
 */
const distRoot = join(__dirname, '..', 'dist')
const cjsEntry = join(distRoot, 'cjs', 'index.min.js')
const esmEntry = join(distRoot, 'esm', 'index.min.js')
const cjsPkgJson = join(distRoot, 'cjs', 'package.json')

const EXPECTED_NAMES = [
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

// The one export that is not a function: a plain object of pattern strings.
const PATTERN_KEYS = ['any', 'compact', 'dotted', 'hyphen']

const distExists = existsSync(cjsEntry) && existsSync(esmEntry)
const distRequired = Boolean(process.env.CI) && process.env.CI !== 'false'
const guarded = distExists || distRequired ? describe : describe.skip

// The security controls, checked on the built files rather than on `src/`: a
// toolchain change (tsc, terser) could drop one without any source test noticing.
// Runs in a fresh Node process, as ESM or CJS, and prints the results as JSON.
const securityScript = (load: string): string => `
  ${load}.then(
    (m) => {
      const thrown = (fn) => { try { fn() } catch (err) { return err } };
      const input = '12.345.678-4';
      const err = thrown(() => m.format(input));
      const results = {
        valid: m.validate('12.345.678-5'),
        wrongVerifier: m.validate(input),
        leadingZero: m.validate('012.345.678-5'),
        atCap: m.validate(' '.repeat(52) + '12.345.678-5'),
        overCap: m.validate(' '.repeat(53) + '12.345.678-5'),
        overCapLenient: m.clean('1'.repeat(65), { throwOnError: false }),
        errorIsTyped: err instanceof m.InvalidRutError && err.code === 'INVALID_RUT',
        errorMessage: err.message,
        errorLeaksInput: String(err.stack).includes(input) || JSON.stringify(err).includes(input),
      };
      Object.prototype.requireValid = false;
      Object.prototype.throwOnError = false;
      Object.prototype.incremental = true;
      results.inheritedRequireValid = m.equals('12345678-9', '12345678-9', {});
      results.inheritedThrowOnError = thrown(() => m.format(input, {})) instanceof m.InvalidRutError;
      process.stdout.write(JSON.stringify(results));
    },
    (err) => {
      process.stderr.write(String(err));
      process.exit(1);
    }
  );
`

const EXPECTED_SECURITY = {
  valid: true,
  wrongVerifier: false,
  leadingZero: false,
  atCap: true,
  overCap: false,
  overCapLenient: null,
  errorIsTyped: true,
  errorMessage: 'Invalid RUT input',
  errorLeaksInput: false,
  inheritedRequireValid: false,
  inheritedThrowOnError: true,
}

guarded('dist smoke (dual ESM + CJS package)', () => {
  test('dist/ has been built', () => {
    expect({ cjsEntry: existsSync(cjsEntry), esmEntry: existsSync(esmEntry) }).toEqual({
      cjsEntry: true,
      esmEntry: true,
    })
  })

  test.each([
    ['ESM', `import(${JSON.stringify(pathToFileURL(esmEntry).href)})`],
    ['CJS', `Promise.resolve().then(() => require(${JSON.stringify(cjsEntry)}))`],
  ])('the %s build keeps the security controls', (kind, load) => {
    const args = kind === 'ESM' ? ['--input-type=module', '-e'] : ['-e']
    const stdout = execFileSync(process.execPath, [...args, securityScript(load)], { encoding: 'utf8' })
    expect(JSON.parse(stdout)).toEqual(EXPECTED_SECURITY)
  })

  test('CJS entry loads via require() and exposes the full public API', () => {
    // Use createRequire so this works under ts-jest's CJS host regardless of
    // the root package.json `"type": "module"` setting.
    const req = createRequire(__filename)
    const cjs = req(cjsEntry) as Record<string, unknown>
    for (const name of EXPECTED_NAMES) {
      expect(typeof cjs[name]).toBe('function')
    }
    expect((cjs.validate as (s: string) => boolean)('12.345.678-5')).toBe(true)
    expect((cjs.format as (s: string) => string)('123456785')).toBe('12.345.678-5')
    // The 5.0.0 equals default: wrong-verifier pairs are no longer "the same RUT".
    expect((cjs.equals as (a: string, b: string) => boolean)('12345678-9', '12345678-9')).toBe(false)
    const patterns = cjs.RUT_PATTERN as Record<string, string>
    expect(Object.keys(patterns).sort()).toEqual(PATTERN_KEYS)
    expect(new RegExp(patterns.hyphen).test('12345678-5')).toBe(true)
  })

  test('CJS subpackage is marked { "type": "commonjs" } (afterbuild step)', () => {
    const req = createRequire(__filename)
    const pkg = req(cjsPkgJson) as { type?: string }
    expect(pkg.type).toBe('commonjs')
  })

  test('ESM entry loads under a real ESM loader and exposes the full public API', () => {
    // The fresh-process invariant: pass the ESM URL on stdin instead of as an
    // -e flag, so quoting around the URL is never an issue.
    const esmUrl = pathToFileURL(esmEntry).href
    const loaderScript = `
      import(${JSON.stringify(esmUrl)}).then(
        (mod) => {
          const names = Object.keys(mod).sort();
          const validateOk = typeof mod.validate === 'function' && mod.validate('12.345.678-5') === true;
          const calcOk = typeof mod.calculateVerifier === 'function' && mod.calculateVerifier('12345678') === '5';
          const patternKeys = Object.keys(mod.RUT_PATTERN ?? {}).sort();
          const patternOk = new RegExp(mod.RUT_PATTERN?.hyphen ?? '$^').test('12345678-5');
          process.stdout.write(JSON.stringify({ names, validateOk, calcOk, patternKeys, patternOk }));
        },
        (err) => {
          process.stderr.write(String(err));
          process.exit(1);
        }
      );
    `
    const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', loaderScript], { encoding: 'utf8' })
    const result = JSON.parse(stdout) as {
      names: string[]
      validateOk: boolean
      calcOk: boolean
      patternKeys: string[]
      patternOk: boolean
    }
    for (const name of EXPECTED_NAMES) {
      expect(result.names).toContain(name)
    }
    expect(result.validateOk).toBe(true)
    expect(result.calcOk).toBe(true)
    expect(result.names).toContain('RUT_PATTERN')
    expect(result.patternKeys).toEqual(PATTERN_KEYS)
    expect(result.patternOk).toBe(true)
  })

  test('CJS and ESM expose the same set of public names', () => {
    const req = createRequire(__filename)
    const cjs = req(cjsEntry) as Record<string, unknown>
    const cjsNames = EXPECTED_NAMES.filter((n) => typeof cjs[n] === 'function').sort()

    const esmUrl = pathToFileURL(esmEntry).href
    const loaderScript = `
      import(${JSON.stringify(esmUrl)}).then(
        (mod) => process.stdout.write(JSON.stringify(Object.keys(mod).sort())),
        (err) => { process.stderr.write(String(err)); process.exit(1); }
      );
    `
    const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', loaderScript], { encoding: 'utf8' })
    const esmNames = (JSON.parse(stdout) as string[]).filter((n) => (EXPECTED_NAMES as readonly string[]).includes(n))
    expect(esmNames.sort()).toEqual(cjsNames)
  })

  test('an InvalidRutError thrown by the CJS build is instanceof the ESM class, and vice versa', () => {
    // The dual package hazard: a process that imports the ESM build while a
    // dependency require()s the CJS one holds two InvalidRutError classes. Both
    // builds are loaded in one real Node process, outside Jest's module system.
    const esmUrl = pathToFileURL(esmEntry).href
    const loaderScript = `
      import { createRequire } from 'node:module';
      import(${JSON.stringify(esmUrl)}).then(
        (esm) => {
          const cjs = createRequire(${JSON.stringify(cjsEntry)})(${JSON.stringify(cjsEntry)});
          const thrown = (fn) => { try { fn() } catch (err) { return err } };
          const fromCjs = thrown(() => cjs.clean('not-a-rut'));
          const fromEsm = thrown(() => esm.format('12.345.678-9'));
          process.stdout.write(JSON.stringify({
            distinctClasses: esm.InvalidRutError !== cjs.InvalidRutError,
            cjsErrorIsEsmInstance: fromCjs instanceof esm.InvalidRutError,
            esmErrorIsCjsInstance: fromEsm instanceof cjs.InvalidRutError,
            codes: [fromCjs.code, fromEsm.code],
            plainErrorIsInstance: new Error() instanceof esm.InvalidRutError || new Error() instanceof cjs.InvalidRutError,
          }));
        },
        (err) => {
          process.stderr.write(String(err));
          process.exit(1);
        }
      );
    `
    const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', loaderScript], { encoding: 'utf8' })
    expect(JSON.parse(stdout)).toEqual({
      distinctClasses: true,
      cjsErrorIsEsmInstance: true,
      esmErrorIsCjsInstance: true,
      codes: ['INVALID_RUT', 'INVALID_RUT'],
      plainErrorIsInstance: false,
    })
  })

  test('the cross-copy check leaves the published typings unchanged', () => {
    // `Symbol.hasInstance` is kept out of the .d.ts on purpose: TypeScript keeps
    // narrowing instanceof from the constructor, and the typings need no
    // `Symbol` in the consumer's `lib`.
    for (const dts of [join(distRoot, 'esm', 'index.d.ts'), join(distRoot, 'cjs', 'index.d.ts')]) {
      const source = readFileSync(dts, 'utf8')
      expect(source).toContain('export declare class InvalidRutError extends Error {')
      expect(source).not.toMatch(/hasInstance|Symbol\./)
    }
  })
})
