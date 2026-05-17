import nextra from 'nextra'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const withNextra = nextra({
  latex: true,
  search: {
    codeblocks: false
  },
  contentDirBasePath: '/docs'
})

export default withNextra({
  reactStrictMode: true,
  devIndicators: false,
  // Pin file tracing to this docs app. Otherwise Next walks up to the
  // repo-root lockfile and infers a workspace root that differs from
  // `turbopack.root`, which triggers "Both outputFileTracingRoot and
  // turbopack.root are set, but they must have the same value" and a broken
  // Vercel build (#27). Vercel's Root Directory is `docs`, so this dir is
  // the correct tracing root.
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname
  }
})
