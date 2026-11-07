// Post-build: minify the compiled entry with a source map (referencing the
// shipped src) and drop the unminified output.
//
// Uses the terser API (rather than chained `terser` shell commands) so the
// source-map options stay readable.
import { readFile, writeFile, rm } from 'node:fs/promises'
import { minify } from 'terser'

const ENTRIES = ['index']
const DIR = 'dist/esm'

for (const entry of ENTRIES) {
  const jsPath = `${DIR}/${entry}.js`
  const mapPath = `${jsPath}.map`

  const code = await readFile(jsPath, 'utf8')
  const inputMap = await readFile(mapPath, 'utf8').catch(() => undefined)

  const result = await minify(
    { [`${entry}.js`]: code },
    {
      compress: true,
      mangle: true,
      // Maps reference ../../src/*.ts (shipped in the tarball) rather than
      // embedding the source, so the source is published once and stays
      // auditable without bloating every map.
      sourceMap: {
        content: inputMap,
        url: `${entry}.min.js.map`,
      },
    },
  )

  await writeFile(`${DIR}/${entry}.min.js`, result.code)
  if (result.map) await writeFile(`${DIR}/${entry}.min.js.map`, result.map)

  // Ship only *.min.js (+ its map and the .d.ts tsc emitted).
  await rm(jsPath, { force: true })
  await rm(mapPath, { force: true })
}

// The package is ESM-only. A checkout built before that change still holds
// the old CommonJS output in dist/cjs: remove it, so it is never packed or
// smoke-tested as if it were current.
await rm('dist/cjs', { recursive: true, force: true })
