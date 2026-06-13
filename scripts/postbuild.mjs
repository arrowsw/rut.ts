// Post-build: minify each compiled entry with a sources-embedded source map,
// point the `zod` subpath at the minified core, drop the unminified output, and
// write the CJS subpackage marker.
//
// Replaces the old chained `minify:* && afterbuild` npm scripts so the build can
// handle multiple entries (index + zod) without per-entry shell commands.
import { readFile, writeFile, rm } from 'node:fs/promises'
import { minify } from 'terser'

const ENTRIES = ['index', 'zod']
const DIRS = ['dist/esm', 'dist/cjs']

for (const dir of DIRS) {
  for (const entry of ENTRIES) {
    const jsPath = `${dir}/${entry}.js`
    const mapPath = `${jsPath}.map`

    let code = await readFile(jsPath, 'utf8')
    const inputMap = await readFile(mapPath, 'utf8').catch(() => undefined)

    // The `zod` entry imports the core (`./index`). After minification the core
    // lives in `index.min.js`, so retarget the specifier before minifying (so
    // the source map stays accurate). Handles both ESM (`'./index'`) and the
    // CJS require (`"./index"`).
    if (entry === 'zod') {
      code = code.replaceAll("'./index'", "'./index.min.js'").replaceAll('"./index"', '"./index.min.js"')
    }

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

    await writeFile(`${dir}/${entry}.min.js`, result.code)
    if (result.map) await writeFile(`${dir}/${entry}.min.js.map`, result.map)

    // Ship only *.min.js (+ its map and the .d.ts tsc emitted).
    await rm(jsPath, { force: true })
    await rm(mapPath, { force: true })
  }
}

await writeFile('dist/cjs/package.json', '{"type":"commonjs"}\n')
