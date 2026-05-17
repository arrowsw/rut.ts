type ValidationPatterns = {
  compact: RegExp
  compactWithHyphen: RegExp
  dotted: RegExp
  invalidRutChars: RegExp
  bodySeparators: RegExp
  bodyDigits: RegExp
}
type DecomposedRut = { body: string; verifier: string }
type FormatOptions = { incremental?: boolean; dots?: boolean; throwOnError?: boolean }
type SafeOptions = { throwOnError?: boolean }
type ValidateOptions = { strict?: boolean }
type VerifierDigit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'K'

export const getInvalidRutError = (_rut?: unknown): string => 'Invalid RUT input'

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
 * Consequence: zero-padded inputs longer than 64 chars are rejected even
 * though older versions normalized them — see CHANGELOG "Changed (Breaking)".
 */
const MAX_RUT_INPUT_LENGTH = 64
const MIN_GENERATED_BODY = 10000000
const MAX_GENERATED_BODY = 99999999
const UINT32_RANGE = 0x100000000

const patterns: ValidationPatterns = {
  compact: /^0*\d{7,8}[\dkK]$/,
  compactWithHyphen: /^0*\d{7,8}-[\dkK]$/,
  dotted: /^0*\d{1,3}\.\d{3}\.\d{3}-?[\dkK]$/,
  invalidRutChars: /[^0-9kK]+/g,
  bodySeparators: /[.\-\s]+/g,
  bodyDigits: /^\d+$/,
}

const fail = <T>(input: unknown, shouldThrow: boolean): T | null => {
  if (shouldThrow) throw new Error(getInvalidRutError(input))
  return null
}

const isBoundedString = (input: unknown): input is string =>
  typeof input === 'string' && input.length > 0 && input.length <= MAX_RUT_INPUT_LENGTH

const normalizeRutValue = (rut: string): string =>
  rut.replace(patterns.invalidRutChars, '').replace(/^0+/, '').toUpperCase()

const isCleanRut = (rut: string): boolean => {
  if (rut.length < MIN_RUT_LENGTH || rut.length > MAX_RUT_LENGTH) return false

  const body = rut.slice(0, -1)
  const verifier = rut.slice(-1)
  return (
    body.length >= MIN_BODY_LENGTH &&
    body.length <= MAX_BODY_LENGTH &&
    patterns.bodyDigits.test(body) &&
    /^[\dK]$/.test(verifier)
  )
}

const parseRutLike = (rut: unknown): DecomposedRut | null => {
  if (!isBoundedString(rut)) return null

  // `isBoundedString` already capped the raw length; trimming can only shrink it,
  // so the only remaining case to reject is a whitespace-only input.
  const input = rut.trim()
  if (input.length === 0) return null

  const hasValidShape =
    patterns.compact.test(input) || patterns.compactWithHyphen.test(input) || patterns.dotted.test(input)
  if (!hasValidShape) return null

  const cleaned = normalizeRutValue(input)
  if (!isCleanRut(cleaned)) return null

  return {
    body: cleaned.slice(0, -1),
    verifier: cleaned.slice(-1),
  }
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

const calculateVerifierForBody = (rutBody: string): VerifierDigit => {
  let sum = 0
  let multiplier = 2

  for (let index = rutBody.length - 1; index >= 0; index -= 1) {
    sum += (rutBody.charCodeAt(index) - 48) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }

  const checkDigit = 11 - (sum % 11)
  return (checkDigit === 11 ? '0' : checkDigit === 10 ? 'K' : checkDigit.toString()) as VerifierDigit
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
  const shouldThrow = options?.throwOnError ?? true
  if (!isBoundedString(rut)) return fail<string>(rut, shouldThrow)

  const cleanRut = normalizeRutValue(rut)
  if (!isCleanRut(cleanRut)) return fail<string>(rut, shouldThrow)

  return cleanRut
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
  const cleaned = clean(rut, withThrowOption(options?.throwOnError))
  return cleaned?.slice(0, -1) ?? null
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
  const cleaned = clean(rut, withThrowOption(options?.throwOnError))
  return (cleaned?.slice(-1) as VerifierDigit) ?? null
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
  const throwOpt = withThrowOption(options?.throwOnError)
  const body = getBody(rut, throwOpt)
  const verifier = getVerifier(rut, throwOpt)

  if (body === null || verifier === null) return null
  return { body, verifier }
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
 * @param {unknown} rut - The RUT string to validate.
 * @param {ValidateOptions} [options] - Validation options.
 * @param {boolean} [options.strict=false] - If true, rejects suspicious RUTs (e.g., 11.111.111-1).
 * @returns {boolean} True if the RUT is valid, false otherwise.
 */
const validate = (rut: unknown, options?: ValidateOptions): boolean => {
  const decomposed = parseRutLike(rut)
  if (!decomposed) return false
  if (options?.strict && isSuspicious(decomposed.body)) return false

  return calculateVerifierForBody(decomposed.body) === decomposed.verifier
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

  const cleanRut = clean(rut, withThrowOption(opts.throwOnError))
  if (cleanRut === null) return null

  const body = cleanRut.slice(0, -1)
  const verifier = cleanRut.slice(-1)
  if (calculateVerifierForBody(body) !== verifier) return fail<string>(rut, opts.throwOnError)

  if (opts.dots) {
    let result = cleanRut.slice(-4, -1) + '-' + cleanRut.substring(cleanRut.length - 1)
    for (let i = 4; i < cleanRut.length; i += 3) {
      result = cleanRut.slice(-3 - i, -i) + '.' + result
    }
    return result
  }
  return cleanRut.slice(0, -1) + '-' + cleanRut.substring(cleanRut.length - 1)
}

/**
 * Generates a random valid RUT string.
 * Uses Web Crypto when available, and falls back to Math.random in older runtimes.
 * @returns {string} A randomly generated, valid RUT string.
 */
const generate = (): string => {
  let body = randomIntInclusive(MIN_GENERATED_BODY, MAX_GENERATED_BODY).toString()
  while (isSuspicious(body)) {
    body = randomIntInclusive(MIN_GENERATED_BODY, MAX_GENERATED_BODY).toString()
  }

  const verifier = calculateVerifierForBody(body)
  return format(body + verifier)
}

export { validate, clean, format, calculateVerifier, getBody, getVerifier, decompose, generate, isRutLike }
export type { DecomposedRut, FormatOptions, SafeOptions, ValidateOptions, VerifierDigit }
