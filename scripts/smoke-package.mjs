// Installs a packed rut.ts tarball into an empty temporary project and checks
// it the way a consumer gets it: through the package name and its `exports`
// map, under both `import` and `require()`, with the security controls intact
// in the minified build. CI runs it on every change, and the publish workflow
// runs it on the exact tarball it is about to publish.
//
// Usage: node scripts/smoke-package.mjs <path-to-tarball>
// Needs no network: rut.ts has no runtime dependencies.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const tarball = process.argv[2]
if (!tarball) {
  console.error('Usage: node scripts/smoke-package.mjs <path-to-tarball>')
  process.exit(2)
}

// Shared by the ESM and CJS runs; `m` is the loaded module.
const CHECKS = `
  const fail = (what) => { console.error('package smoke FAILED (' + KIND + '): ' + what); process.exit(1) };
  const thrown = (fn) => { try { fn() } catch (err) { return err } };
  if (m.validate('12.345.678-5') !== true) fail('a valid RUT is rejected');
  if (m.validate('12.345.678-4') !== false) fail('a wrong verifier is accepted');
  if (m.validate('012.345.678-5') !== false) fail('leading-zero padding is accepted');
  if (m.validate(' '.repeat(53) + '12.345.678-5') !== false) fail('input over the 64-char cap is accepted');
  if (m.format('123456785') !== '12.345.678-5') fail('format() output changed');
  const err = thrown(() => m.format('12.345.678-4'));
  if (!(err instanceof m.InvalidRutError) || err.code !== 'INVALID_RUT') fail('format() did not throw InvalidRutError');
  if (err.message !== 'Invalid RUT input' || String(err.stack).includes('12.345.678-4')) fail('the error shows the input');
  if (typeof m.RUT_PATTERN?.any !== 'string') fail('RUT_PATTERN is missing');
  console.log('package smoke ok (' + KIND + ')');
`

const dir = mkdtempSync(join(tmpdir(), 'rut-ts-package-smoke-'))
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'rut-ts-package-smoke', private: true }))
  execFileSync(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', resolve(tarball)],
    { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' },
  )

  const run = (args) => execFileSync(process.execPath, args, { cwd: dir, stdio: 'inherit' })
  run(['--input-type=module', '-e', `const KIND = 'ESM'; import * as m from 'rut.ts'; ${CHECKS}`])
  run(['--input-type=commonjs', '-e', `const KIND = 'CJS'; const m = require('rut.ts'); ${CHECKS}`])
} finally {
  rmSync(dir, { recursive: true, force: true })
}
