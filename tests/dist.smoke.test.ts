import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
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
 * The test is auto-skipped if `dist/` has not been built (e.g. a fresh clone
 * before `npm run prepare`), so it never blocks contributors who only edit
 * source.
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
  'parse',
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

const distExists = existsSync(cjsEntry) && existsSync(esmEntry)
const guarded = distExists ? describe : describe.skip

guarded('dist smoke (dual ESM + CJS package)', () => {
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
    const parsed = (cjs.parse as (s: string) => { success: boolean; formatted?: string })('0012345674')
    expect(parsed).toMatchObject({ success: true, formatted: '1.234.567-4' })
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
          process.stdout.write(JSON.stringify({ names, validateOk, calcOk }));
        },
        (err) => {
          process.stderr.write(String(err));
          process.exit(1);
        }
      );
    `
    const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', loaderScript], { encoding: 'utf8' })
    const result = JSON.parse(stdout) as { names: string[]; validateOk: boolean; calcOk: boolean }
    for (const name of EXPECTED_NAMES) {
      expect(result.names).toContain(name)
    }
    expect(result.validateOk).toBe(true)
    expect(result.calcOk).toBe(true)
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
})
