type ValidationPatterns = {
  compact: RegExp
  compactWithHyphen: RegExp
  dotted: RegExp
  invalidRutChars: RegExp
  bodySeparators: RegExp
  bodyDigits: RegExp
}
type VerifierDigit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'K'
type DecomposedRut = { body: string; verifier: VerifierDigit }
type FormatOptions = { incremental?: boolean; dots?: boolean; throwOnError?: boolean }
type SafeOptions = { throwOnError?: boolean }
type ValidateOptions = { strict?: boolean }

// Branded "validated RUT" type. The brand is phantom (erased at runtime); the
// only way to mint a `Rut` is by narrowing with the `isValidRut()` type guard,
// so a `Rut` in the type system always denotes a string that has passed
// `validate()`.
declare const RUT_BRAND: unique symbol
type Rut = string & { readonly [RUT_BRAND]: true }

type GenerateFormat = 'dotted' | 'compact' | 'hyphen'
type GenerateOptions = { bodyLength?: 7 | 8; format?: GenerateFormat; count?: number }

type ParseOptions = { strict?: boolean; canonicalOnly?: boolean }
type EqualsOptions = { requireValid?: boolean }
/**
 * Discriminated union returned by {@link parse}. Narrow on `success`:
 * the `true` branch carries the branded {@link Rut} plus its parts and the
 * canonical dotted rendering; the `false` branch carries the constant-message
 * {@link InvalidRutError} (never the offending input — anti-PII).
 */
type ParseResult =
  | { success: true; rut: Rut; body: string; verifier: VerifierDigit; formatted: string }
  | { success: false; error: InvalidRutError }

const INVALID_RUT_MESSAGE = 'Invalid RUT input'

/**
 * Typed error thrown by the safe helpers in their default (throwing) mode.
 * Catch it with `instanceof InvalidRutError` or by checking `err.code`
 * (`'INVALID_RUT'`) instead of matching on the message text. The message is the
 * constant `Invalid RUT input`, so no RUT value ever leaks into logs or traces.
 */
export class InvalidRutError extends Error {
  readonly code = 'INVALID_RUT' as const
  constructor() {
    super(INVALID_RUT_MESSAGE)
    this.name = 'InvalidRutError'
  }
}

/**
 * @deprecated Since 4.1.0. Prefer catching {@link InvalidRutError}
 * (`err instanceof InvalidRutError` or `err.code === 'INVALID_RUT'`). Retained
 * for v3 compatibility; always returns the constant generic message.
 */
export const getInvalidRutError = (_rut?: unknown): string => INVALID_RUT_MESSAGE

/** Helper to create SafeOptions with explicit throwOnError boolean */
const withThrowOption = (throwOnError?: boolean): { throwOnError: boolean } => ({
  throwOnError: throwOnError ?? true,
})

const MIN_RUT_LENGTH = 8
const MAX_RUT_LENGTH = 9
const MIN_BODY_LENGTH = 7
const MAX_BODY_LENGTH = 8
/**
 * Hard upper bound on accepted input length. This is a SECURITY bound, not a
 * RUT format rule: a real RUT is ~9 significant chars (and ~12 with dots and a
 * hyphen, a bit more with leading zeros or surrounding whitespace). The cap
 * exists so an attacker cannot feed an arbitrarily long string into the
 * validator and burn CPU — oversized input is rejected *before* any regex
 * runs (defense in depth alongside the non-backtracking patterns). 64 is an
 * arbitrary round number, generously above any legitimately-formatted RUT yet
 * small enough that the bounded patterns can never see an attack string.
 * Note: `validate`/`isValidRut`/`isRutLike` reject leading-zero padding outright
 * (a canonical RUT has none — see `parseRutLike`); this cap still bounds the
 * lenient helpers (`clean`/`format`), which normalize zero-padded input up to
 * 64 chars. See CHANGELOG "Changed (Breaking)".
 */
const MAX_RUT_INPUT_LENGTH = 64
const MIN_GENERATED_BODY = 10000000
const MAX_GENERATED_BODY = 99999999
const MIN_GENERATED_BODY_7 = 1000000
const MAX_GENERATED_BODY_7 = 9999999
const UINT32_RANGE = 0x100000000

const patterns: ValidationPatterns = {
  // No leading-zero allowance (`0*`) here on purpose: a canonical RUT body has
  // none, and `parseRutLike` rejects any leading zero explicitly (see the guard
  // there). Dropping `0*` documents that intent at the grammar level — though
  // the guard, not these patterns, is what actually closes the gap.
  compact: /^\d{7,8}[\dkK]$/,
  compactWithHyphen: /^\d{7,8}-[\dkK]$/,
  dotted: /^\d{1,3}\.\d{3}\.\d{3}-[\dkK]$/,
  invalidRutChars: /[^0-9kK]+/g,
  bodySeparators: /[.\-\s]+/g,
  bodyDigits: /^\d+$/,
}

// `_input` is the offending value. It is deliberately never read: keeping it in
// the signature documents that callers hand it over and `fail` refuses to echo
// it into the thrown error (the anti-PII guarantee).
const fail = <T>(_input: unknown, shouldThrow: boolean): T | null => {
  if (shouldThrow) throw new InvalidRutError()
  return null
}

const isBoundedString = (input: unknown): input is string =>
  typeof input === 'string' && input.length > 0 && input.length <= MAX_RUT_INPUT_LENGTH

const normalizeRutValue = (rut: string): string =>
  rut.replace(patterns.invalidRutChars, '').replace(/^0+/, '').toUpperCase()

const isVerifierDigit = (value: string): value is VerifierDigit => /^[\dK]$/.test(value)

// Validates a normalized compact string and splits it into the shared internal
// shape. This is the single point where the verifier is narrowed to
// `VerifierDigit`, so every caller receives a typed `DecomposedRut` and never
// needs a defensive re-narrowing branch of its own. The overall length bound
// (8–9 chars) already implies the body bound (7–8 digits), so only the total
// length, the body digits and the verifier character are checked.
const splitCleanRut = (cleaned: string): DecomposedRut | null => {
  if (cleaned.length < MIN_RUT_LENGTH || cleaned.length > MAX_RUT_LENGTH) return null

  const body = cleaned.slice(0, -1)
  const verifier = cleaned.slice(-1)
  if (!patterns.bodyDigits.test(body)) return null

  return isVerifierDigit(verifier) ? { body, verifier } : null
}

// Lenient core: normalization-first parsing shared by the recovery helpers
// (`clean`/`decompose`/`getBody`/`getVerifier`/`mask`/`format`). Strips
// separators, embedded garbage, leading zeros and case before splitting; it
// deliberately does NOT check the Modulo 11 verifier — these helpers recover
// RUT-shaped values from messy input, they don't assert validity.
const parseLenient = (rut: unknown): DecomposedRut | null => {
  if (!isBoundedString(rut)) return null
  return splitCleanRut(normalizeRutValue(rut))
}

// Canonical core: shape-contract parsing shared by the acceptance predicates
// (`validate`/`isValidRut`/`isRutLike`). Same regex budget as before the
// `splitCleanRut` extraction — the verifier character test simply moved from
// `isCleanRut` into the splitter, where it also narrows the type.
const parseRutLike = (rut: unknown): DecomposedRut | null => {
  if (!isBoundedString(rut)) return null

  // `isBoundedString` already capped the raw length; trimming can only shrink it,
  // so the only remaining case to reject is a whitespace-only input.
  const input = rut.trim()
  if (input.length === 0) return null

  const hasValidShape =
    patterns.compact.test(input) || patterns.compactWithHyphen.test(input) || patterns.dotted.test(input)
  if (!hasValidShape) return null

  // Reject non-canonical leading-zero padding. A real RUT body is never written
  // with leading zeros (`12.345.678-5`, never `012.345.678-5`); padding only
  // ever appears as a fixed-width storage artifact. Crucially it forms an
  // *unbounded* family of distinct strings for one RUT (`12345678` =
  // `012345678` = `0012345678` = …), a canonicalization hazard: a zero-padded
  // variant must not slip past a strict uniqueness/identity gate. The lenient
  // normalizers (`clean`/`format`/`equals`) still accept and strip these — only
  // the acceptance predicates (`validate`/`isValidRut`/`isRutLike`, all routed
  // through here) refuse them. Inspecting the trimmed first character is exact:
  // every accepted shape begins with the body's most-significant digit, so a
  // leading '0' can only be padding. (This guard — not the `0*` removal in
  // `patterns` — is load-bearing: a single zero on a 7-digit body, e.g.
  // `01234567-4`, is absorbed by `\d{7,8}` and then stripped by
  // `normalizeRutValue`, so the pattern alone would let it through.)
  if (input[0] === '0') return null

  return splitCleanRut(normalizeRutValue(input))
}

/** Internal helper to clean RUT without complete-RUT validation (used for incremental formatting) */
const cleanRaw = (rut: string): string => {
  const cleaned = normalizeRutValue(rut.slice(0, MAX_RUT_INPUT_LENGTH))
  const digits = cleaned.replace(/K/g, '')
  return (cleaned.endsWith('K') ? `${digits}K` : digits).slice(0, MAX_RUT_LENGTH)
}

const normalizeRutBody = (rutBody: unknown): string | null => {
  if (!isBoundedString(rutBody)) return null

  const cleanedRut = rutBody.replace(patterns.bodySeparators, '').replace(/^0+/, '')
  if (cleanedRut.length < MIN_BODY_LENGTH || cleanedRut.length > MAX_BODY_LENGTH) return null
  if (!patterns.bodyDigits.test(cleanedRut)) return null

  return cleanedRut
}

// `11 - (sum % 11)` is always in 1..11. This typed table maps every possible
// check digit to its verifier character, so the result is `VerifierDigit`
// without an `as` assertion (keeps genuine 100% type coverage).
const VERIFIER_BY_CHECK_DIGIT: Record<number, VerifierDigit> = {
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

const calculateVerifierForBody = (rutBody: string): VerifierDigit => {
  let sum = 0
  let multiplier = 2

  for (let index = rutBody.length - 1; index >= 0; index -= 1) {
    sum += (rutBody.charCodeAt(index) - 48) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }

  const checkDigit = 11 - (sum % 11)
  return VERIFIER_BY_CHECK_DIGIT[checkDigit]
}

const isSuspicious = (body: string): boolean => {
  const firstDigit = body[0]
  for (let index = 1; index < body.length; index += 1) {
    if (body[index] !== firstDigit) return false
  }
  return true
}

const randomIntInclusive = (min: number, max: number): number => {
  const range = max - min + 1
  const cryptoSource = globalThis.crypto

  if (cryptoSource?.getRandomValues) {
    const maxUnbiased = Math.floor(UINT32_RANGE / range) * range
    const buffer = new Uint32Array(1)
    let value = 0

    do {
      cryptoSource.getRandomValues(buffer)
      value = buffer[0]
    } while (value >= maxUnbiased)

    return min + (value % range)
  }

  return min + Math.floor(Math.random() * range)
}

/**
 * Cleans the input string by removing leading zeros, non-numeric characters, and ensures the RUT is uppercased.
 * This is a permissive normalization helper and does not validate the verifier digit.
 * @param {string} rut - The RUT string to clean.
 * @param {SafeOptions} [options] - Configuration options.
 * @param {boolean} [options.throwOnError=true] - If true (default), throws an error for invalid RUTs. If false, returns null.
 * @returns {string | null} The cleaned RUT string, or null if invalid and throwOnError is false.
 * @throws {Error} If the RUT is not valid and throwOnError is true.
 */
function clean(rut: string): string
function clean(rut: string, options: { throwOnError: false }): string | null
function clean(rut: string, options: { throwOnError: true }): string
function clean(rut: string, options?: SafeOptions): string | null
function clean(rut: string, options?: SafeOptions): string | null {
  const parsed = parseLenient(rut)
  return parsed ? parsed.body + parsed.verifier : fail<string>(rut, options?.throwOnError ?? true)
}

/**
 * Extracts the body (part before the verifier digit) from a given RUT string.
 * This function first cleans the input RUT string to ensure it is in a valid format before slicing.
 * @param {string} rut - The RUT string from which to extract the body.
 * @param {SafeOptions} [options] - Configuration options.
 * @param {boolean} [options.throwOnError=true] - If true (default), throws an error for invalid RUTs. If false, returns null.
 * @returns {string | null} The body of the RUT, or null if invalid and throwOnError is false.
 * @throws {Error} If the cleaned RUT is not valid and throwOnError is true.
 */
function getBody(rut: string): string
function getBody(rut: string, options: { throwOnError: false }): string | null
function getBody(rut: string, options: { throwOnError: true }): string
function getBody(rut: string, options?: SafeOptions): string | null
function getBody(rut: string, options?: SafeOptions): string | null {
  const parsed = parseLenient(rut)
  return parsed ? parsed.body : fail<string>(rut, options?.throwOnError ?? true)
}

/**
 * Extracts the verifier digit (the last character) from a given RUT string.
 * This function cleans the input RUT string to ensure it is in a valid format before extracting the verifier digit.
 * @param {string} rut - The RUT string from which to extract the verifier digit.
 * @param {SafeOptions} [options] - Configuration options.
 * @param {boolean} [options.throwOnError=true] - If true (default), throws an error for invalid RUTs. If false, returns null.
 * @returns {string | null} The verifier digit of the RUT, or null if invalid and throwOnError is false.
 * @throws {Error} If the cleaned RUT is not valid and throwOnError is true.
 */
function getVerifier(rut: string): VerifierDigit
function getVerifier(rut: string, options: { throwOnError: false }): VerifierDigit | null
function getVerifier(rut: string, options: { throwOnError: true }): VerifierDigit
function getVerifier(rut: string, options?: SafeOptions): VerifierDigit | null
function getVerifier(rut: string, options?: SafeOptions): VerifierDigit | null {
  const parsed = parseLenient(rut)
  return parsed ? parsed.verifier : fail<VerifierDigit>(rut, options?.throwOnError ?? true)
}

/**
 * Decomposes the given RUT into its body and verifier parts.
 * @param {string} rut - The RUT string to decompose.
 * @param {SafeOptions} [options] - Configuration options.
 * @param {boolean} [options.throwOnError=true] - If true (default), throws an error for invalid RUTs. If false, returns null.
 * @returns {DecomposedRut | null} An object containing the body and verifier of the RUT, or null if invalid and throwOnError is false.
 * @throws {Error} If the RUT is not valid and throwOnError is true.
 */
function decompose(rut: string): DecomposedRut
function decompose(rut: string, options: { throwOnError: false }): DecomposedRut | null
function decompose(rut: string, options: { throwOnError: true }): DecomposedRut
function decompose(rut: string, options?: SafeOptions): DecomposedRut | null
function decompose(rut: string, options?: SafeOptions): DecomposedRut | null {
  // `parseLenient` already returns the typed `{ body, verifier }` shape — the
  // old defensive re-narrowing branch is gone by construction.
  const parsed = parseLenient(rut)
  return parsed ?? fail<DecomposedRut>(rut, options?.throwOnError ?? true)
}

/**
 * Checks if a string has a valid RUT format (without validating the verifier digit).
 * Useful for quick format validation in UI before full validation.
 * @param {unknown} rut - The value to check.
 * @returns {boolean} True if the string looks like a RUT format, false otherwise.
 */
const isRutLike = (rut: unknown): boolean => parseRutLike(rut) !== null

/**
 * Calculates the verifier digit for a given RUT body.
 * @param {string} rutBody - The body of the RUT for which to calculate the verifier.
 * @param {SafeOptions} [options] - Configuration options.
 * @param {boolean} [options.throwOnError=true] - If true (default), throws an error for invalid RUTs. If false, returns null.
 * @returns {string | null} The calculated verifier digit, or null if invalid and throwOnError is false.
 * @throws {Error} If the RUT body is invalid and throwOnError is true.
 */
function calculateVerifier(rutBody: string): VerifierDigit
function calculateVerifier(rutBody: string, options: { throwOnError: false }): VerifierDigit | null
function calculateVerifier(rutBody: string, options: { throwOnError: true }): VerifierDigit
function calculateVerifier(rutBody: string, options?: SafeOptions): VerifierDigit | null
function calculateVerifier(rutBody: string, options?: SafeOptions): VerifierDigit | null {
  const throwOpt = withThrowOption(options?.throwOnError)
  const cleanedRut = normalizeRutBody(rutBody)

  if (cleanedRut === null) return fail<VerifierDigit>(rutBody, throwOpt.throwOnError)
  return calculateVerifierForBody(cleanedRut)
}

/**
 * Validates a given RUT string, optionally with strict mode to also check for suspicious patterns.
 *
 * Accepts the three canonical shapes — compact (`123456785`), compact + hyphen
 * (`12345678-5`) and dotted (`12.345.678-5`) — with optional surrounding
 * whitespace and a case-insensitive `k`/`K` verifier. Non-canonical input is
 * rejected, **including leading-zero padding** (`012.345.678-5`): a real RUT
 * carries no leading zeros, so normalize zero-padded values with `clean()`
 * first if you need to accept them.
 * @param {unknown} rut - The RUT string to validate.
 * @param {ValidateOptions} [options] - Validation options.
 * @param {boolean} [options.strict=false] - If true, additionally rejects suspicious repeated-digit placeholders (e.g., 11.111.111-1).
 * @returns {boolean} True if the RUT is valid, false otherwise.
 */
const validate = (rut: unknown, options?: ValidateOptions): boolean => {
  const decomposed = parseRutLike(rut)
  if (!decomposed) return false
  if (options?.strict && isSuspicious(decomposed.body)) return false

  return calculateVerifierForBody(decomposed.body) === decomposed.verifier
}

// Renders an already-parsed RUT in a canonical presentation — dotted
// (`12.345.678-5`) or hyphen-only (`12345678-5`). Pure string assembly:
// callers own any validity check.
const formatDecomposed = ({ body, verifier }: DecomposedRut, dots: boolean): string => {
  if (!dots) return `${body}-${verifier}`

  const compact = body + verifier
  let result = compact.slice(-4, -1) + '-' + verifier
  for (let i = 4; i < compact.length; i += 3) {
    result = compact.slice(-3 - i, -i) + '.' + result
  }
  return result
}

/**
 * Formats a given RUT string, with options for incremental formatting and dot separators.
 *
 * **Note on incremental mode**: When `incremental: true`, the function formats the RUT progressively
 * as the user types, even for incomplete RUTs. This is useful for real-time formatting in form inputs,
 * but the formatted output may not represent a valid RUT until the input is complete.
 * Always use `validate()` to verify the final RUT.
 *
 * @param {string} rut - The RUT string to format.
 * @param {FormatOptions} [options] - The formatting options.
 * @param {boolean} [options.incremental=false] - Whether to format the RUT incrementally (for real-time input formatting).
 * @param {boolean} [options.dots=true] - Whether to include dot separators in the formatted RUT.
 * @param {boolean} [options.throwOnError=true] - If true (default), throws an error for invalid RUTs. If false, returns null. Ignored in incremental mode.
 * @returns {string | null} The formatted RUT string, or null if invalid and throwOnError is false.
 * @throws {Error} If the RUT is invalid and throwOnError is true (only in non-incremental mode).
 */
function format(rut: string, options?: Omit<FormatOptions, 'throwOnError'>): string
function format(rut: string, options: FormatOptions & { throwOnError: false }): string | null
function format(rut: string, options: FormatOptions & { throwOnError: true }): string
function format(rut: string, options?: FormatOptions): string | null
function format(rut: string, options?: FormatOptions): string | null {
  const opts = {
    incremental: options?.incremental ?? false,
    dots: options?.dots ?? true,
    throwOnError: options?.throwOnError ?? true,
  }

  if (typeof rut !== 'string') return fail<string>(rut, opts.throwOnError)
  if (rut.length === 0) return ''

  if (opts.incremental) {
    const rawClean = cleanRaw(rut)
    if (rawClean.length === 0) return ''

    if (rawClean.length < MIN_RUT_LENGTH) {
      if (!opts.dots || rawClean.length <= 3) return rawClean

      let result = rawClean.slice(-3)
      for (let i = 3; i < rawClean.length; i += 3) {
        const start = rawClean.length - 3 - i < 0 ? 0 : rawClean.length - 3 - i
        result = rawClean.slice(start, rawClean.length - i) + '.' + result
      }
      return result
    }

    let result = rawClean.slice(-4, -1) + '-' + rawClean.slice(-1)
    for (let i = 4; i < rawClean.length; i += 3) {
      const start = rawClean.length - 3 - i < 0 ? 0 : rawClean.length - 3 - i
      result = opts.dots
        ? rawClean.slice(start, rawClean.length - i) + '.' + result
        : rawClean.slice(start, rawClean.length - i) + result
    }

    return result
  }

  const parsed = parseLenient(rut)
  if (parsed === null) return fail<string>(rut, opts.throwOnError)
  if (calculateVerifierForBody(parsed.body) !== parsed.verifier) return fail<string>(rut, opts.throwOnError)

  return formatDecomposed(parsed, opts.dots)
}

const generateOne = (bodyLength: 7 | 8, outputFormat: GenerateFormat): string => {
  const [min, max] =
    bodyLength === 7 ? [MIN_GENERATED_BODY_7, MAX_GENERATED_BODY_7] : [MIN_GENERATED_BODY, MAX_GENERATED_BODY]

  let body = randomIntInclusive(min, max).toString()
  while (isSuspicious(body)) {
    body = randomIntInclusive(min, max).toString()
  }

  const compact = body + calculateVerifierForBody(body)
  if (outputFormat === 'compact') return compact
  if (outputFormat === 'hyphen') return format(compact, { dots: false })
  return format(compact)
}

/**
 * Generates random valid RUT string(s).
 * Uses Web Crypto when available, and falls back to Math.random in older runtimes.
 * @param {GenerateOptions} [options] - Generation options.
 * @param {7 | 8} [options.bodyLength=8] - Number of body digits to generate.
 * @param {'dotted' | 'compact' | 'hyphen'} [options.format='dotted'] - Output shape:
 *   `'dotted'` → `12.345.678-5`, `'hyphen'` → `12345678-5`, `'compact'` → `123456785`.
 * @param {number} [options.count] - When provided, returns an array of that many RUTs instead of one.
 * @returns {string | string[]} A valid RUT, or an array of them when `count` is given.
 */
function generate(options: GenerateOptions & { count: number }): string[]
function generate(options?: Omit<GenerateOptions, 'count'>): string
function generate(options?: GenerateOptions): string | string[] {
  const bodyLength = options?.bodyLength ?? 8
  const outputFormat = options?.format ?? 'dotted'

  if (options?.count === undefined) return generateOne(bodyLength, outputFormat)
  return Array.from({ length: options.count }, () => generateOne(bodyLength, outputFormat))
}

/**
 * Type guard: narrows `rut` to the branded {@link Rut} type when it is a valid RUT.
 * Lets the type system propagate "this string was validated".
 * @param {unknown} rut - The value to check.
 * @param {ValidateOptions} [options] - Validation options (e.g. `{ strict: true }`).
 * @returns {boolean} True (and narrows to `Rut`) if valid, false otherwise.
 */
const isValidRut = (rut: unknown, options?: ValidateOptions): rut is Rut => validate(rut, options)

// The one place a `Rut` is minted outside the `isValidRut` narrowing. Only
// `parse()` may call this, and only after the compact string has survived the
// same shape split and Modulo 11 check that `validate()` runs — so the brand
// stays truthful by construction.
const mintRut = (compact: string): Rut => compact as Rut

/**
 * Parses arbitrary input into a validated RUT. This is the recommended entry
 * point for data ingestion: it **never throws** and returns a discriminated
 * union ({@link ParseResult}) instead.
 *
 * The default mode is **lenient + validating**: input is normalized like
 * `clean()` (zero-padded fixed-width exports, odd grouping, embedded garbage
 * and lowercase `k` are all recovered) and the Modulo 11 verifier is then
 * required to match. `parse('0012345674')` therefore succeeds with
 * `formatted: '1.234.567-4'` — the blessed path for dirty/legacy data that
 * `validate()` deliberately rejects.
 *
 * On success the result carries the branded {@link Rut} (compact form), the
 * `body` / `verifier` parts, and `formatted` — the canonical dotted rendering
 * (`12.345.678-5`), which always passes `validate()`.
 *
 * @param {unknown} input - The value to parse.
 * @param {ParseOptions} [options] - Parsing options.
 * @param {boolean} [options.canonicalOnly=false] - Apply `validate()`'s shape
 *   contract before the verifier check: only the three canonical shapes are
 *   accepted and leading-zero padding is rejected.
 * @param {boolean} [options.strict=false] - Additionally reject suspicious
 *   repeated-digit placeholders (e.g. `11.111.111-1`), like `validate()`'s
 *   strict mode.
 * @returns {ParseResult} `{ success: true, rut, body, verifier, formatted }`
 *   or `{ success: false, error }`.
 */
const parse = (input: unknown, options?: ParseOptions): ParseResult => {
  const parsed = options?.canonicalOnly ? parseRutLike(input) : parseLenient(input)
  if (parsed === null) return { success: false, error: new InvalidRutError() }
  if (options?.strict && isSuspicious(parsed.body)) return { success: false, error: new InvalidRutError() }
  if (calculateVerifierForBody(parsed.body) !== parsed.verifier) return { success: false, error: new InvalidRutError() }

  return {
    success: true,
    rut: mintRut(parsed.body + parsed.verifier),
    body: parsed.body,
    verifier: parsed.verifier,
    formatted: formatDecomposed(parsed, true),
  }
}

/**
 * Masks a RUT for safe logging/display, keeping only the leading group and the
 * verifier: `12.345.678-5` → `12.***.***-5`. Useful alongside the library's
 * anti-PII posture. Validates the shape (not the Modulo 11 verifier) first.
 * @param {string} rut - The RUT string to mask.
 * @param {SafeOptions} [options] - Configuration options.
 * @param {boolean} [options.throwOnError=true] - If true (default), throws for invalid RUTs. If false, returns null.
 * @returns {string | null} The masked RUT, or null if invalid and throwOnError is false.
 * @throws {InvalidRutError} If the RUT is not valid and throwOnError is true.
 */
function mask(rut: string): string
function mask(rut: string, options: { throwOnError: false }): string | null
function mask(rut: string, options: { throwOnError: true }): string
function mask(rut: string, options?: SafeOptions): string | null
function mask(rut: string, options?: SafeOptions): string | null {
  const parsed = parseLenient(rut)
  if (parsed === null) return fail<string>(rut, options?.throwOnError ?? true)

  const head = parsed.body.slice(0, parsed.body.length - 6) // 1 digit for a 7-digit body, 2 for an 8-digit body
  return `${head}.***.***-${parsed.verifier}`
}

/**
 * Answers "are these the same RUT?" — both arguments must normalize to the same
 * value **and**, by default, that value must be a valid RUT (Modulo 11 checked).
 *
 * Shapes are irrelevant: dots, hyphens, leading-zero padding, surrounding
 * garbage and verifier case are all stripped before comparing, so
 * `equals('12.345.678-5', '123456785')` → `true` and
 * `equals('012345678-5', '12.345.678-5')` → `true`.
 *
 * **Coherence rule (intended asymmetry with `validate`):** validity is checked
 * against the *normalized* value, not against `validate()`'s canonical shape
 * contract — `equals('012345678-5', '12.345.678-5')` is `true` even though
 * `validate('012345678-5')` is `false`. `equals` is a normalization operation
 * by definition; the default `requireValid` adds exactly one thing: the
 * verifier check. Two strings that normalize identically but carry a wrong
 * verifier are **not** "the same RUT" because they are not RUTs:
 * `equals('12345678-9', '12345678-9')` → `false`.
 *
 * Pass `{ requireValid: false }` for the pure normalization comparison
 * (pre-5.0.0 behavior): useful when deduplicating dirty datasets, where the
 * same typo in two rows is still the same entity.
 *
 * Returns `false` if either argument is not a string or cannot be normalized to
 * a RUT-shaped value.
 * @param {unknown} a - First RUT.
 * @param {unknown} b - Second RUT.
 * @param {EqualsOptions} [options] - Comparison options.
 * @param {boolean} [options.requireValid=true] - If true (default), both
 *   arguments must also be a valid RUT after normalization.
 * @returns {boolean} True if both normalize to the same (by default valid) RUT.
 */
const equals = (a: unknown, b: unknown, options?: EqualsOptions): boolean => {
  const parsedA = parseLenient(a)
  if (parsedA === null) return false

  const parsedB = parseLenient(b)
  if (parsedB === null || parsedA.body !== parsedB.body || parsedA.verifier !== parsedB.verifier) return false

  if (options?.requireValid === false) return true
  return calculateVerifierForBody(parsedA.body) === parsedA.verifier
}

export {
  validate,
  parse,
  clean,
  format,
  calculateVerifier,
  getBody,
  getVerifier,
  decompose,
  generate,
  isRutLike,
  isValidRut,
  mask,
  equals,
}
export type {
  DecomposedRut,
  FormatOptions,
  SafeOptions,
  ValidateOptions,
  ParseOptions,
  ParseResult,
  EqualsOptions,
  VerifierDigit,
  Rut,
  GenerateOptions,
  GenerateFormat,
}
