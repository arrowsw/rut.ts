/**
 * Differential harness: frozen baselines vs the current src.
 *
 * Two frozen baselines are compared against the current implementation:
 *
 *  - **v3.4.0 `validate()`** — the last 3.x release, for datasets that predate
 *    the 4.x hardening.
 *  - **v4.1.0 `validate()` + `equals()`** — the release real upgraders of the
 *    5.0.0 major come from. Its regression list is the one that matters most:
 *    leading-zero rejection in the acceptance predicates, and the new
 *    validity-checking `equals` default.
 *
 * Goal: characterize EXACTLY which input shapes change their result between a
 * frozen release and the current src, so a large production dataset can be
 * assessed for impact before upgrading.
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

import { equals as equalsCurrent, validate as validateCurrent } from '../src/index'

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

/* ────────────────────────────────────────────────────────────────────────────
 * FROZEN SNAPSHOT — rut.ts v4.1.0 `validate()` / `equals()` and dependencies.
 * Copied verbatim (behavior-preserving) from the v4.1.0 tag's `src/index.ts`.
 * DO NOT "improve" this code: its job is to reproduce 4.1.0 behavior exactly.
 * Only the non-throwing paths `equals` relies on are frozen (`equals` calls
 * `clean` with `{ throwOnError: false }`, so `fail()` reduces to `null`).
 * ──────────────────────────────────────────────────────────────────────────── */
const v41Patterns = {
  compact: /^0*\d{7,8}[\dkK]$/,
  compactWithHyphen: /^0*\d{7,8}-[\dkK]$/,
  dotted: /^0*\d{1,3}\.\d{3}\.\d{3}-[\dkK]$/,
  invalidRutChars: /[^0-9kK]+/g,
  bodyDigits: /^\d+$/,
}

const V41_MIN_RUT_LENGTH = 8
const V41_MAX_RUT_LENGTH = 9
const V41_MIN_BODY_LENGTH = 7
const V41_MAX_BODY_LENGTH = 8
const V41_MAX_RUT_INPUT_LENGTH = 64

const v41IsBoundedString = (input: unknown): input is string =>
  typeof input === 'string' && input.length > 0 && input.length <= V41_MAX_RUT_INPUT_LENGTH

const v41NormalizeRutValue = (rut: string): string =>
  rut.replace(v41Patterns.invalidRutChars, '').replace(/^0+/, '').toUpperCase()

const v41IsCleanRut = (rut: string): boolean => {
  if (rut.length < V41_MIN_RUT_LENGTH || rut.length > V41_MAX_RUT_LENGTH) return false

  const body = rut.slice(0, -1)
  const verifier = rut.slice(-1)
  return (
    body.length >= V41_MIN_BODY_LENGTH &&
    body.length <= V41_MAX_BODY_LENGTH &&
    v41Patterns.bodyDigits.test(body) &&
    /^[\dK]$/.test(verifier)
  )
}

const v41ParseRutLike = (rut: unknown): { body: string; verifier: string } | null => {
  if (!v41IsBoundedString(rut)) return null

  const input = rut.trim()
  if (input.length === 0) return null

  const hasValidShape =
    v41Patterns.compact.test(input) || v41Patterns.compactWithHyphen.test(input) || v41Patterns.dotted.test(input)
  if (!hasValidShape) return null

  const cleaned = v41NormalizeRutValue(input)
  if (!v41IsCleanRut(cleaned)) return null

  return {
    body: cleaned.slice(0, -1),
    verifier: cleaned.slice(-1),
  }
}

const V41_VERIFIER_BY_CHECK_DIGIT: Record<number, string> = {
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: 'K',
  11: '0',
}

const v41CalculateVerifierForBody = (rutBody: string): string => {
  let sum = 0
  let multiplier = 2

  for (let index = rutBody.length - 1; index >= 0; index -= 1) {
    sum += (rutBody.charCodeAt(index) - 48) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }

  const checkDigit = 11 - (sum % 11)
  return V41_VERIFIER_BY_CHECK_DIGIT[checkDigit]
}

const v41IsSuspicious = (body: string): boolean => {
  const firstDigit = body[0]
  for (let index = 1; index < body.length; index += 1) {
    if (body[index] !== firstDigit) return false
  }
  return true
}

const v41Validate = (rut: unknown, options?: { strict?: boolean }): boolean => {
  const decomposed = v41ParseRutLike(rut)
  if (!decomposed) return false
  if (options?.strict && v41IsSuspicious(decomposed.body)) return false

  return v41CalculateVerifierForBody(decomposed.body) === decomposed.verifier
}

// v4.1.0 `clean` in its `{ throwOnError: false }` mode (the only one `equals` uses).
const v41CleanOrNull = (rut: string): string | null => {
  if (!v41IsBoundedString(rut)) return null

  const cleanRut = v41NormalizeRutValue(rut)
  if (!v41IsCleanRut(cleanRut)) return null

  return cleanRut
}

const v41Equals = (a: unknown, b: unknown): boolean => {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const normalizedA = v41CleanOrNull(a)
  return normalizedA !== null && normalizedA === v41CleanOrNull(b)
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
  const redosV4Result = validateCurrent(redosInput)
  const redosV4Ms = performance.now() - redosStart

  // Equals pair corpus (4.1.0 ↔ current), ~5% of the validate corpus. Each row
  // is a PAIR because equals is binary; shapes name the pair's relationship.
  type PairRow = { a: string; b: string; shape: string }
  const pairs: PairRow[] = []
  const pairTarget = Math.max(600, Math.floor(targetSize * 0.05))
  while (pairs.length < pairTarget) {
    const body = randomValidBody()
    const dv = dvOf(body)
    const compact = `${body}${dv}`
    const head = body.length === 8 ? body.slice(0, 2) : body.slice(0, 1)
    const rest = body.length === 8 ? body.slice(2) : body.slice(1)
    const dotted = `${head}.${rest.slice(0, 3)}.${rest.slice(3)}-${dv}`
    let bad = String(randInt(0, 9))
    while (bad === dv) bad = randInt(0, 9) < 1 ? 'K' : String(randInt(0, 9))
    const otherBody = randomValidBody()
    pairs.push(
      { a: dotted, b: compact, shape: 'pair-same-valid-cross-shape' },
      { a: `00${compact}`, b: dotted, shape: 'pair-zero-padded-vs-canonical' },
      { a: `${body}-${bad}`, b: `${body}-${bad}`, shape: 'pair-wrong-dv-identical' },
      { a: `${body}${bad}`, b: `${body}-${bad}`, shape: 'pair-wrong-dv-cross-shape' },
      { a: compact, b: `${otherBody}${dvOf(otherBody)}`, shape: 'pair-different-ruts' },
      { a: 'not-a-rut', b: compact, shape: 'pair-garbage' },
    )
  }

  // ---- classify ----
  let agreeTrue = 0
  let agreeFalse = 0
  const regressions = new Map<string, { count: number; samples: string[] }>() // old=true, new=false
  const newAccepts = new Map<string, { count: number; samples: string[] }>() // old=false, new=true
  let agreeTrue41 = 0
  let agreeFalse41 = 0
  const regressions41 = new Map<string, { count: number; samples: string[] }>()
  const newAccepts41 = new Map<string, { count: number; samples: string[] }>()

  const bump = (m: Map<string, { count: number; samples: string[] }>, shape: string, input: string) => {
    const e = m.get(shape) ?? { count: 0, samples: [] }
    e.count++
    if (e.samples.length < 8) e.samples.push(input.length > 40 ? `${input.slice(0, 37)}…` : input)
    m.set(shape, e)
  }

  for (const { input, shape } of rows) {
    const n = validateCurrent(input)

    const o3 = legacyValidate(input)
    if (o3 && n) agreeTrue++
    else if (!o3 && !n) agreeFalse++
    else if (o3 && !n) bump(regressions, shape, input)
    else bump(newAccepts, shape, input)

    const o41 = v41Validate(input)
    if (o41 && n) agreeTrue41++
    else if (!o41 && !n) agreeFalse41++
    else if (o41 && !n) bump(regressions41, shape, input)
    else bump(newAccepts41, shape, input)
  }

  // equals: default mode vs the 4.1.0 baseline, plus the { requireValid: false }
  // parity guarantee (legacy mode must match 4.1.0 on EVERY pair, no exceptions).
  let equalsAgree = 0
  let legacyParityMismatch = 0
  const equalsDiffs = new Map<string, { count: number; samples: string[] }>()
  for (const { a, b, shape } of pairs) {
    const o = v41Equals(a, b)
    const n = equalsCurrent(a, b)
    if (o === n) equalsAgree++
    else bump(equalsDiffs, shape, `${a} ≟ ${b}`)
    if (equalsCurrent(a, b, { requireValid: false }) !== o) legacyParityMismatch++
  }

  // Strict-mode security spot check (the uppercase-K bypass).
  const strictBypassOld = legacyValidate('8.888.888-K', { strict: true })
  const strictBypassNew = validateCurrent('8.888.888-K', { strict: true })

  // Non-string inputs (kept out of the string corpus).
  const nonStringRows = [null, undefined, 123456785, {}, [], NaN, true]
  const nonStringDivergence = nonStringRows.filter(
    (v) => legacyValidate(v as unknown) !== validateCurrent(v as unknown),
  )

  const total = rows.length
  const regrTotal = [...regressions.values()].reduce((a, b) => a + b.count, 0)
  const accTotal = [...newAccepts.values()].reduce((a, b) => a + b.count, 0)
  const regrTotal41 = [...regressions41.values()].reduce((a, b) => a + b.count, 0)
  const accTotal41 = [...newAccepts41.values()].reduce((a, b) => a + b.count, 0)
  const equalsDiffTotal = [...equalsDiffs.values()].reduce((a, b) => a + b.count, 0)

  const fmt = (m: Map<string, { count: number; samples: string[] }>) =>
    [...m.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([shape, e]) => `| \`${shape}\` | ${e.count} | ${e.samples.map((s) => `\`${s}\``).join(', ')} |`)
      .join('\n') || '| _(none)_ | 0 | |'

  const report = `# Differential report — frozen baselines vs current (5.0.0)

- Seed: \`0x52555420\` (reproducible)
- Corpus size: **${total.toLocaleString('en-US')}** validate inputs, **${pairs.length.toLocaleString('en-US')}** equals pairs

## v3.4.0 → current — \`validate()\`

- Agree valid (\`true/true\`): **${agreeTrue.toLocaleString('en-US')}**
- Agree invalid (\`false/false\`): **${agreeFalse.toLocaleString('en-US')}**
- ⚠️ Regressions (was \`true\` → now \`false\`): **${regrTotal.toLocaleString('en-US')}**
- New acceptances (was \`false\` → now \`true\`): **${accTotal.toLocaleString('en-US')}**

### ⚠️ Regressions by input shape (potential false negatives for a 3.x dataset)

| Input shape | Count | Samples |
|-------------|------:|---------|
${fmt(regressions)}

### New acceptances by input shape

| Input shape | Count | Samples |
|-------------|------:|---------|
${fmt(newAccepts)}

## v4.1.0 → current — \`validate()\` (the migration most upgraders make)

- Agree valid (\`true/true\`): **${agreeTrue41.toLocaleString('en-US')}**
- Agree invalid (\`false/false\`): **${agreeFalse41.toLocaleString('en-US')}**
- ⚠️ Regressions (was \`true\` → now \`false\`): **${regrTotal41.toLocaleString('en-US')}**
- New acceptances (was \`false\` → now \`true\`): **${accTotal41.toLocaleString('en-US')}** (must be 0)

### ⚠️ Regressions by input shape (potential false negatives for a 4.x dataset)

| Input shape | Count | Samples |
|-------------|------:|---------|
${fmt(regressions41)}

Both shapes are the same documented 5.0.0 change: leading-zero padding is no
longer accepted by the predicates. Ingest legacy data through the documented
recipe — \`const rut = clean(raw, { throwOnError: false })\` and then
\`validate(rut)\` — which normalizes first and never accepts a wrong verifier.

## v4.1.0 → current — \`equals()\` default mode

- Pairs compared: **${pairs.length.toLocaleString('en-US')}** — agree: **${equalsAgree.toLocaleString('en-US')}**
- ⚠️ Divergences (4.1.0 and current disagree): **${equalsDiffTotal.toLocaleString('en-US')}**

| Pair shape | Count | Samples |
|------------|------:|---------|
${fmt(equalsDiffs)}

Every divergence is the documented 5.0.0 \`equals\` change: the default now
requires a valid Modulo 11 verifier, so wrong-DV pairs stop comparing equal.
Legacy parity: \`equals(a, b, { requireValid: false })\` matched v4.1.0 on
**${(pairs.length - legacyParityMismatch).toLocaleString('en-US')} / ${pairs.length.toLocaleString('en-US')}** pairs (must be all).

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
    regrTotal41,
    regressionShapes41: [...regressions41.keys()],
    newAcceptShapes41: [...newAccepts41.keys()],
    equalsPairTotal: pairs.length,
    equalsAgree,
    equalsDiffShapes: [...equalsDiffs.keys()],
    legacyParityMismatch,
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

  test('4.1.0 → current: validate regressions are exactly the documented leading-zero shapes', () => {
    // The ONLY 5.0.0 predicate change is leading-zero rejection; both allowed
    // shapes are zero-padded renderings of otherwise-valid RUTs. Anything else
    // here is an undocumented regression for 4.x upgraders.
    const allowed = new Set(['leading-zeros', 'len-64-padded-valid'])
    expect(result.regressionShapes41.filter((s) => !allowed.has(s))).toEqual([])
    expect(result.newAcceptShapes41).toEqual([]) // 5.0.0 accepts nothing 4.1.0 rejected
  })

  test('4.1.0 → current: equals only diverges on wrong-DV pairs (the requireValid default)', () => {
    const allowed = new Set(['pair-wrong-dv-identical', 'pair-wrong-dv-cross-shape'])
    expect(result.equalsDiffShapes.filter((s) => !allowed.has(s))).toEqual([])
  })

  test('4.1.0 → current: { requireValid: false } is 4.1.0-compatible on every pair', () => {
    expect(result.legacyParityMismatch).toBe(0)
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
    expect(validateCurrent('12.345678-5')).toBe(false)
    expect(legacyValidate('12.345.678-5')).toBe(validateCurrent('12.345.678-5'))
  })

  test('4.1.0 snapshot: leading-zero predicates and the equals default are the only divergences', () => {
    // validate: the zero-padded family flips from accept to reject…
    expect(v41Validate('0012345674')).toBe(true)
    expect(validateCurrent('0012345674')).toBe(false)
    // …while canonical shapes agree.
    expect(v41Validate('12.345.678-5')).toBe(validateCurrent('12.345.678-5'))
    expect(v41Validate('12345678-9')).toBe(validateCurrent('12345678-9'))

    // equals: a wrong-DV pair flips under the validity-checking default…
    expect(v41Equals('12345678-9', '12345678-9')).toBe(true)
    expect(equalsCurrent('12345678-9', '12345678-9')).toBe(false)
    // …legacy mode restores 4.1.0 behavior exactly…
    expect(equalsCurrent('12345678-9', '12345678-9', { requireValid: false })).toBe(true)
    // …and zero-padded-vs-canonical stays equal in BOTH versions (coherence rule).
    expect(v41Equals('012345678-5', '12.345.678-5')).toBe(true)
    expect(equalsCurrent('012345678-5', '12.345.678-5')).toBe(true)
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
        const n = validateCurrent(input)
        if (o && !n) regressionShapes.add(shape)
        else if (!o && n) newAcceptShapes.add(shape)
      }
    }

    // 65-char-padded valid RUT: v3 accepts, v4 rejects (cap).
    {
      const overCap = '0'.repeat(56) + '123456785'
      const o = legacyValidate(overCap)
      const n = validateCurrent(overCap)
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
    const result = validateCurrent(adversarial)
    const elapsed = performance.now() - start
    expect(result).toBe(false)
    expect(elapsed).toBeLessThan(50)
  })

  test('strict uppercase-K bypass remains fixed', () => {
    expect(legacyValidate('8.888.888-K', { strict: true })).toBe(true) // documented v3 bug
    expect(validateCurrent('8.888.888-K', { strict: true })).toBe(false) // v4 fix
  })
})
