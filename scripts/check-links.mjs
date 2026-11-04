// Checks every http(s) link in llms.txt, README.md and LICENSE and prints a
// console warning for each one that is broken. Never fails the process unless
// `--strict` is passed (so it is safe to run locally or as a non-blocking CI step).
//
// Usage: npm run check-links [-- --strict]
import { readFile } from 'node:fs/promises'

const FILES = ['llms.txt', 'README.md', 'LICENSE']
const TIMEOUT_MS = 15_000
const CONCURRENCY = 8
// Sites like npmjs.com answer bots with these; the link may be fine, so it is
// reported as unverified rather than broken.
const BOT_BLOCKED = new Set([401, 403, 429])
// Links skipped on purpose because they are known-good but unverifiable from a
// script (e.g. bot protection). npmjs.com blocks automated requests with 403;
// the package itself is confirmed via https://registry.npmjs.org/rut.ts.
const BYPASS = new Set(['https://www.npmjs.com/package/rut.ts'])
const strict = process.argv.includes('--strict')

// `[` and `]` are allowed inside URLs (e.g. treeshake=[*]); only `)` ends one.
const URL_RE = /https?:\/\/[^\s<>"'`)]+/g

// Trailing sentence punctuation is not part of the URL. `*` and `_` are kept
// (they can be real URL characters) and a closing `]` is only stripped when it
// has no matching `[` inside the URL (e.g. `[https://x.com]`).
const clean = (url) => {
  url = url.replace(/[.,;:!?]+$/, '')
  while (url.endsWith(']') && url.split(']').length > url.split('[').length) {
    url = url.slice(0, -1)
  }
  return url
}

const extract = (text) => [...text.matchAll(URL_RE)].map((m) => clean(m[0]))

const request = async (url, method) => {
  const res = await fetch(url, {
    method,
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'user-agent': 'rut.ts-link-checker' },
  })
  await res.body?.cancel()
  return res.status
}

const check = async (url) => {
  const target = url.split('#')[0]
  try {
    let status = await request(target, 'HEAD')
    // Some servers reject HEAD; retry with GET before declaring it broken.
    if (status >= 400) status = await request(target, 'GET')
    if (BOT_BLOCKED.has(status)) return { unverified: `HTTP ${status}` }
    return status >= 400 ? `HTTP ${status}` : null
  } catch (err) {
    return err?.name === 'TimeoutError' ? 'timeout' : (err?.cause?.code ?? err.message)
  }
}

// url -> files that reference it
const links = new Map()
for (const file of FILES) {
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch {
    console.warn(`⚠️  Could not read ${file}, skipping`)
    continue
  }
  for (const url of extract(text)) {
    if (!links.has(url)) links.set(url, new Set())
    links.get(url).add(file)
  }
}

const queue = [...links.keys()].filter((url) => !BYPASS.has(url))
const total = queue.length
const broken = []
const unverified = []
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let url; (url = queue.shift()); ) {
      const problem = await check(url)
      if (problem?.unverified) unverified.push({ url, problem: problem.unverified })
      else if (problem) broken.push({ url, problem })
    }
  }),
)

for (const { url, problem } of unverified) {
  console.log(`ℹ️  Could not verify (${problem}, likely bot protection): ${url}`)
}
console.log(`Checked ${total} unique links in ${FILES.join(', ')} (${links.size - total} bypassed).`)
if (broken.length === 0) {
  console.log('✅ No broken links found.')
} else {
  for (const { url, problem } of broken.sort((a, b) => a.url.localeCompare(b.url))) {
    console.warn(`⚠️  Broken link (${problem}): ${url}  [${[...links.get(url)].join(', ')}]`)
  }
  console.warn(`⚠️  ${broken.length} broken link(s) found.`)
  if (strict) process.exitCode = 1
}
