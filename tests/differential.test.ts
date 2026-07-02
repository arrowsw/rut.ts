/**
 * Differential harness: v3.4.0 `validate()` vs the current `validate()`.
 *
 * Goal: characterize EXACTLY which input shapes change their validation result
 * between the last 3.x release and the current src, so a large production
 * dataset can be assessed for impact before upgrading. (The frozen baseline is
 * 3.4.0 — the last release a typical dataset predates — not the previous minor.)
 *
 * This is intentionally a single self-contained file: the project's jest
 * `testRegex` matches every `*.ts` under `tests/`, so sibling helper modules
 * would be picked up as (empty) suites and break `npm test`.
 *
 * Default `npm test` only runs a fast smoke check here. The full ~1M-case run
 * is gated behind an env var:
 *
 *   npm run test:differential                  # 1,000,000 cases (default)
 *   DIFF_CORPUS=200000 npm run test:differential
 *
 * It writes a human-readable report to `tests/differential-report.md`.
 * The corpus is generated from a seeded PRNG, so runs are reproducible.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { validate as validateV4 } from '../src/index'

/* ────────────────────────────────────────────────────────────────────────────
 * FROZEN SNAPSHOT — rut.ts v3.4.0 `validate()` and its dependencies.
 * Copied verbatim (behavior-preserving) from the 3.4.0 `src/index.ts`.
 * DO NOT "improve" this code: its job is to reproduce 3.x behavior exactly.
 * ──────────────────────────────────────────────────────────────────────────── */
const legacyPatterns = {
  cleaning: /^0+|[^0-9kK]+/g,
  rutLike: /^0*(\d{1,3}(\.?\d{3})*)-?([\dkK])$/,
  suspicious: /^(\d)\1?\.?(\1{3})\.?(\1{3})-?(\d|k)?$/,
}

const LEGACY_MIN = 8
const LEGACY_MAX = 9

const legacyCleanRaw = (rut: string): string => rut.replace(/^0+|[^0-9kK]+/g, '').toUpperCase()

const legacyClean = (rut: string): string | null => {
  const cleanRut = rut.replace(legacyPatterns.cleaning, '').toUpperCase()
  if (cleanRut.length < LEGACY_MIN || cleanRut.length > LEGACY_MAX) return null
  if (cleanRut.includes('K') && cleanRut.indexOf('K') !== cleanRut.length - 1) return null
  return cleanRut
}

const legacyCalculateVerifier = (rutBody: string): string | null => {
  const cleanedRut = legacyCleanRaw(rutBody)
  if (cleanedRut.length < 7 || cleanedRut.length > 8) return null
  if (!/^\d+$/.test(cleanedRut)) return null
  const sum = cleanedRut
    .split('')
    .reverse()
    .reduce((acc, digit, index) => acc + Number(digit) * ((index % 6) + 2), 0)
  const checkDigit = 11 - (sum % 11)
  return checkDigit === 11 ? '0' : checkDigit === 10 ? 'K' : checkDigit.toString()
}

const legacyValidate = (rut: unknown, options?: { strict?: boolean }): boolean => {
  if (typeof rut !== 'string' || rut.length === 0) return false
  if (!legacyPatterns.rutLike.test(rut)) return false
  if (options?.strict && legacyPatterns.suspicious.test(rut)) return false

  const cleaned = legacyClean(rut)
  if (cleaned === null) return false
  const body = cleaned.slice(0, -1)
  const verifier = cleaned.slice(-1)

  const calculated = legacyCalculateVerifier(body)
  if (!calculated) return false
  return calculated === verifier
}
/* ──────────────────────────── end frozen snapshot ─────────────────────────── */

/** Deterministic PRNG (mulberry32) so the corpus and report are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(0x52555420) // "RUT "
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))

/** Modulo 11 — used only to build *known-valid* corpus rows. */
function dvOf(body: string): string {
  let sum = 0
  let mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += (body.charCodeAt(i) - 48) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const c = 11 - (sum % 11)
  return c === 11 ? '0' : c === 10 ? 'K' : String(c)
}

function randomValidBody(): string {
  // 7- or 8-digit body, never all-same-digit, no leading zero.
  const len = rand() < 0.5 ? 7 : 8
  let body = ''
  do {
    body = String(randInt(0, 9) || 1)
    for (let i = 1; i < len; i++) body += String(randInt(0, 9))
  } while (/^(.)\1*$/.test(body))
  return body
}

type Row = { input: string; shape: string }

/** Render a known-valid (body+dv) into one of many real-world shapes. */
function renderShapes(body: string, dv: string): Row[] {
  const compact = `${body}${dv}`
  const dotted = (b: string) => {
    // group from the right in 3s
    const head = b.length === 8 ? b.slice(0, 2) : b.slice(0, 1)
    const rest = b.length === 8 ? b.slice(2) : b.slice(1)
    return `${head}.${rest.slice(0, 3)}.${rest.slice(3)}`
  }
  return [
    { input: compact, shape: 'compact' },
    { input: `${body}-${dv}`, shape: 'compact+hyphen' },
    { input: `${dotted(body)}-${dv}`, shape: 'canonical-dotted' },
    { input: `${dotted(body)}${dv}`, shape: 'dotted-no-hyphen' },
    { input: `${compact.slice(0, -1)}${dv.toLowerCase()}`, shape: 'lowercase-k' },
    { input: `00${compact}`, shape: 'leading-zeros' },
    { input: `  ${dotted(body)}-${dv}  `, shape: 'surrounding-space' },
    // ----- non-canonical: this is the regression surface -----
    { input: `${body.slice(0, 2)}.${body.slice(2)}-${dv}`, shape: 'noncanonical-grouping' },
    { input: `${body.split('').join('.')}-${dv}`, shape: 'every-digit-dotted' },
    { input: `${body.split('').join(' ')} ${dv}`, shape: 'internal-spaces' },
    { input: `${body.replace(/(\d{3})/g, '$1,')}${dv}`, shape: 'comma-separated' },
  ]
}

const REPORT_PATH = join(__dirname, 'differential-report.md')

function runDifferential(targetSize: number) {
  const rows: Row[] = []

  // Stratum A + B: known-valid bodies in many representations.
  while (rows.length < targetSize * 0.55) {
    const body = randomValidBody()
    rows.push(...renderShapes(body, dvOf(body)))
  }

  // Stratum C: invalid — wrong DV, random noise, wrong length, garbage chars.
  while (rows.length < targetSize * 0.9) {
    const pick = rand()
    if (pick < 0.4) {
      const body = randomValidBody()
      const good = dvOf(body)
      let bad = String(randInt(0, 9))
      while (bad === good) bad = randInt(0, 9) < 1 ? 'K' : String(randInt(0, 9))
      rows.push({ input: `${body}-${bad}`, shape: 'invalid-wrong-dv' })
    } else if (pick < 0.7) {
      const n = randInt(1, 15)
      // First digit is non-zero: leading-zero acceptance is a documented v5
      // regression characterized by the dedicated `leading-zeros` shape, so this
      // catch-all stays clean (any regression it reports is a *real* surprise).
      let s = String(randInt(1, 9))
      for (let i = 1; i < n; i++) s += String(randInt(0, 9))
      rows.push({ input: s, shape: 'random-digits' })
    } else if (pick < 0.9) {
      rows.push({
        input: Math.random()
          .toString(36)
          .slice(2, 2 + randInt(3, 12)),
        shape: 'garbage',
      })
    } else {
      const body = randomValidBody()
      rows.push({ input: `${body}${body}${dvOf(body)}`, shape: 'too-long' })
    }
  }

  // Stratum D: targeted edges + the security cases. Each appears EXACTLY ONCE.
  //
  // IMPORTANT: the frozen 3.4.0 regex is ReDoS-vulnerable, so a long adversarial
  // string must never be fed to `legacyValidate` more than a handful of times.
  // We use a moderate-length adversarial row here (single occurrence) and prove
  // the *real* 100k-char ReDoS fix as a v4-only timing assertion below — without
  // ever running the vulnerable legacy regex on it.
  const edges: Row[] = [
    { input: '', shape: 'empty' },
    { input: '   ', shape: 'whitespace-only' },
    { input: '0'.repeat(4000) + 'x', shape: 'redos-adversarial-moderate' },
    { input: '1'.repeat(20000), shape: 'huge-digits' },
    { input: '0'.repeat(55) + '123456785', shape: 'len-64-padded-valid' },
    { input: '0'.repeat(56) + '123456785', shape: 'len-65-over-cap' },
  ]
  for (const d of '0123456789') {
    const b = d.repeat(8)
    edges.push({ input: `${b}${dvOf(b)}`, shape: 'placeholder-repeated' })
  }
  rows.push(...edges)

  // Pad to the target size with CHEAP invalid rows (short random digit strings),
  // never by recycling the expensive edges above.
  while (rows.length < targetSize) {
    const n = randInt(1, 6)
    let s = ''
    for (let i = 0; i < n; i++) s += String(randInt(0, 9))
    rows.push({ input: s, shape: 'pad-short-digits' })
  }

  // v4-only ReDoS proof: the genuine 100k-char attack string is NEVER passed to
  // the vulnerable legacy regex — only to the hardened v4 validator.
  const redosInput = '0'.repeat(100_000) + 'x'
  const redosStart = performance.now()
  const redosV4Result = validateV4(redosInput)
  const redosV4Ms = performance.now() - redosStart

  // ---- classify ----
  let agreeTrue = 0
  let agreeFalse = 0
  const regressions = new Map<string, { count: number; samples: string[] }>() // old=true, new=false
  const newAccepts = new Map<string, { count: number; samples: string[] }>() // old=false, new=true

  const bump = (m: Map<string, { count: number; samples: string[] }>, shape: string, input: string) => {
    const e = m.get(shape) ?? { count: 0, samples: [] }
    e.count++
    if (e.samples.length < 8) e.samples.push(input.length > 40 ? `${input.slice(0, 37)}…` : input)
    m.set(shape, e)
  }

  for (const { input, shape } of rows) {
    const o = legacyValidate(input)
    const n = validateV4(input)
    if (o && n) agreeTrue++
    else if (!o && !n) agreeFalse++
    else if (o && !n) bump(regressions, shape, input)
    else bump(newAccepts, shape, input)
  }

  // Strict-mode security spot check (the uppercase-K bypass).
  const strictBypassOld = legacyValidate('8.888.888-K', { strict: true })
  const strictBypassNew = validateV4('8.888.888-K', { strict: true })

  // Non-string inputs (kept out of the string corpus).
  const nonStringRows = [null, undefined, 123456785, {}, [], NaN, true]
  const nonStringDivergence = nonStringRows.filter((v) => legacyValidate(v as unknown) !== validateV4(v as unknown))

  const total = rows.length
  const regrTotal = [...regressions.values()].reduce((a, b) => a + b.count, 0)
  const accTotal = [...newAccepts.values()].reduce((a, b) => a + b.count, 0)

  const fmt = (m: Map<string, { count: number; samples: string[] }>) =>
    [...m.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([shape, e]) => `| \`${shape}\` | ${e.count} | ${e.samples.map((s) => `\`${s}\``).join(', ')} |`)
      .join('\n') || '| _(none)_ | 0 | |'

  const report = `# Differential report — v3.4.0 vs current (5.0.0) \`validate()\`

- Seed: \`0x52555420\` (reproducible)
- Corpus size: **${total.toLocaleString('en-US')}**
- Agree valid (\`true/true\`): **${agreeTrue.toLocaleString('en-US')}**
- Agree invalid (\`false/false\`): **${agreeFalse.toLocaleString('en-US')}**
- ⚠️ Regressions (was \`true\` → now \`false\`): **${regrTotal.toLocaleString('en-US')}**
- New acceptances (was \`false\` → now \`true\`): **${accTotal.toLocaleString('en-US')}**

## ⚠️ Regressions by input shape (potential false negatives for a 3.x dataset)

| Input shape | Count | Samples |
|-------------|------:|---------|
${fmt(regressions)}

## New acceptances by input shape

| Input shape | Count | Samples |
|-------------|------:|---------|
${fmt(newAccepts)}

## Security spot checks

- \`validate('8.888.888-K', { strict: true })\` — v3.4.0: **${strictBypassOld}** (bug: should be false), current: **${strictBypassNew}**
- Non-string inputs with diverging result: **${nonStringDivergence.length}** ${
    nonStringDivergence.length ? `(${nonStringDivergence.map(String).join(', ')})` : '(none — both reject)'
  }
- ReDoS: \`validate('0'.repeat(100000) + 'x')\` on current → **${redosV4Result}** in **${redosV4Ms.toFixed(2)} ms** (the frozen 3.4.0 regex exhibits catastrophic backtracking on this input and is deliberately not run here)

## How to read this

\`generate()\`/canonical inputs land in *Agree valid*. The **Regressions** table
is the actionable part: every shape there is an input format that v3.4.0
accepted and the current src now rejects. Confirm your production dataset uses **none**
of those shapes (or normalize it to compact / compact+hyphen / canonical-dotted)
before upgrading. This harness cannot prove safety on data it never saw — it
enumerates exactly what changed.
`

  writeFileSync(REPORT_PATH, report)
  return {
    total,
    agreeTrue,
    agreeFalse,
    regrTotal,
    accTotal,
    strictBypassOld,
    strictBypassNew,
    nonStringDivergence: nonStringDivergence.length,
    redosV4Result,
    redosV4Ms,
    regressionShapes: [...regressions.keys()],
    newAcceptShapes: [...newAccepts.keys()],
  }
}

/* ──────────────────────────────────────────────────────────────────────────── */

const FULL = process.env.RUN_DIFFERENTIAL === '1'
const CORPUS = Number(process.env.DIFF_CORPUS ?? 1_000_000)

;(FULL ? describe : describe.skip)('differential v3.4.0 vs current (full corpus)', () => {
  jest.setTimeout(120_000)

  // Run inside beforeAll, NOT in the describe body: Jest executes the body of a
  // `describe.skip` block during collection but skips its hooks, so computing the
  // 1M-case corpus here keeps `npm test` from running it (and rewriting the
  // report on disk) when the full suite is gated off.
  let result: ReturnType<typeof runDifferential>
  beforeAll(() => {
    result = runDifferential(CORPUS)
  })

  test('canonical-valid inputs never regress (no false negatives on accepted shapes)', () => {
    // Regressions are only allowed in shapes that the current src *intentionally
    // and documentably* rejects (see CHANGELOG "Changed (Breaking)"):
    //  - non-canonical dot grouping (4.0.0 #2)
    //  - dotted body without the verifier hyphen (4.1.0 fix)
    //  - inputs longer than the 64-char cap (4.0.0 #2)
    //  - leading-zero padding (5.0.0): now non-canonical; `leading-zeros` and the
    //    zero-padded `len-64-padded-valid` row both flip from accept to reject.
    // The every-digit-dotted / internal-spaces / comma-separated shapes were
    // already rejected by 3.4.0 too, so they must NOT appear here.
    const allowed = new Set([
      'noncanonical-grouping',
      'dotted-no-hyphen',
      'len-65-over-cap',
      'leading-zeros',
      'len-64-padded-valid',
    ])
    const unexpected = result.regressionShapes.filter((s) => !allowed.has(s))
    console.log(JSON.stringify(result, null, 2))
    expect(unexpected).toEqual([])
  })

  test('current introduces no surprising new acceptances', () => {
    // The only relaxation is whitespace trimming around otherwise-valid input.
    const allowed = new Set(['surrounding-space'])
    const unexpected = result.newAcceptShapes.filter((s) => !allowed.has(s))
    expect(unexpected).toEqual([])
  })

  test('strict uppercase-K bypass is fixed', () => {
    expect(result.strictBypassOld).toBe(true) // the 3.x bug
    expect(result.strictBypassNew).toBe(false) // fixed in 4.0.0
  })

  test('current is ReDoS-safe on a 100k-char adversarial input', () => {
    expect(result.redosV4Result).toBe(false)
    expect(result.redosV4Ms).toBeLessThan(50)
  })

  test('report written', () => {
    expect(result.total).toBeGreaterThanOrEqual(CORPUS)
  })
})

// Fast smoke check so the file is a valid suite under plain `npm test`.
;(FULL ? describe.skip : describe)('differential (smoke)', () => {
  test('legacy snapshot and v4 disagree exactly on a known non-canonical shape', () => {
    expect(legacyValidate('12.345678-5')).toBe(true)
    expect(validateV4('12.345678-5')).toBe(false)
    expect(legacyValidate('12.345.678-5')).toBe(validateV4('12.345.678-5'))
  })

  /**
   * Mini-corpus run on every CI invocation (no env flag required). This is a
   * 1 000-case version of the full differential — small enough to be cheap
   * (< 100 ms locally) but large enough to make sure that the only divergence
   * shapes between v3.4.0 and the current src are the ones documented in the CHANGELOG.
   *
   * The full 1 M-case report-writing run is still gated behind
   * `RUN_DIFFERENTIAL=1`; this block does NOT write any report.
   */
  test('mini-corpus (1k cases) only diverges on documented shapes', () => {
    const allowedRegressions = new Set(['noncanonical-grouping', 'dotted-no-hyphen', 'len-65-over-cap'])
    const allowedNewAccepts = new Set(['surrounding-space'])

    const regressionShapes = new Set<string>()
    const newAcceptShapes = new Set<string>()
    const rng = mulberry32(0x1234_5678)
    const ri = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1))

    for (let i = 0; i < 250; i++) {
      // Stratum A: known-valid bodies in many shapes.
      const len = rng() < 0.5 ? 7 : 8
      let body = String(ri(0, 9) || 1)
      do {
        body = String(ri(0, 9) || 1)
        for (let j = 1; j < len; j++) body += String(ri(0, 9))
      } while (/^(.)\1*$/.test(body))
      const dv = dvOf(body)

      const head = body.length === 8 ? body.slice(0, 2) : body.slice(0, 1)
      const rest = body.length === 8 ? body.slice(2) : body.slice(1)
      const dotted = `${head}.${rest.slice(0, 3)}.${rest.slice(3)}`

      const rows: Array<{ input: string; shape: string }> = [
        { input: `${body}${dv}`, shape: 'compact' },
        { input: `${body}-${dv}`, shape: 'compact+hyphen' },
        { input: `${dotted}-${dv}`, shape: 'canonical-dotted' },
        { input: `  ${dotted}-${dv}  `, shape: 'surrounding-space' },
        { input: `${body.slice(0, 2)}.${body.slice(2)}-${dv}`, shape: 'noncanonical-grouping' },
        { input: `${dotted}${dv}`, shape: 'dotted-no-hyphen' },
      ]
      for (const { input, shape } of rows) {
        const o = legacyValidate(input)
        const n = validateV4(input)
        if (o && !n) regressionShapes.add(shape)
        else if (!o && n) newAcceptShapes.add(shape)
      }
    }

    // 65-char-padded valid RUT: v3 accepts, v4 rejects (cap).
    {
      const overCap = '0'.repeat(56) + '123456785'
      const o = legacyValidate(overCap)
      const n = validateV4(overCap)
      if (o && !n) regressionShapes.add('len-65-over-cap')
    }

    const unexpectedRegressions = [...regressionShapes].filter((s) => !allowedRegressions.has(s))
    const unexpectedNewAccepts = [...newAcceptShapes].filter((s) => !allowedNewAccepts.has(s))
    expect(unexpectedRegressions).toEqual([])
    expect(unexpectedNewAccepts).toEqual([])
  })

  test('ReDoS on 100k-char adversarial input is below 50 ms on v4', () => {
    // Defense-in-depth — also covered in validate.test.ts. The v3 frozen regex
    // is *deliberately* never fed this input here; we only time the hardened
    // v4 validator.
    const adversarial = '0'.repeat(100_000) + 'x'
    const start = performance.now()
    const result = validateV4(adversarial)
    const elapsed = performance.now() - start
    expect(result).toBe(false)
    expect(elapsed).toBeLessThan(50)
  })

  test('strict uppercase-K bypass remains fixed', () => {
    expect(legacyValidate('8.888.888-K', { strict: true })).toBe(true) // documented v3 bug
    expect(validateV4('8.888.888-K', { strict: true })).toBe(false) // v4 fix
  })
})
