type ValidationPatterns = { rutLike: RegExp; suspicious: RegExp; cleaning: RegExp }
type DecomposedRut = { body: string; verifier: string }
type FormatOptions = { incremental?: boolean; dots?: boolean; throwOnError?: boolean }
type SafeOptions = { throwOnError?: boolean }
type ValidateOptions = { strict?: boolean }
type VerifierDigit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'K'

export const getInvalidRutError = (rut: string): string => `String "${rut}" is not valid as a RUT input`

/** Helper to create SafeOptions with explicit throwOnError boolean */
const withThrowOption = (throwOnError?: boolean): { throwOnError: boolean } => ({
  throwOnError: throwOnError ?? true,
})

const MIN_RUT_LENGTH = 8
const MAX_RUT_LENGTH = 9

/** Internal helper to clean RUT without length validation (used for incremental formatting) */
const cleanRaw = (rut: string): string => rut.replace(/^0+|[^0-9kK]+/g, '').toUpperCase()

const patterns: ValidationPatterns = {
  cleaning: /^0+|[^0-9kK]+/g,
  rutLike: /^0*(\d{1,3}(\.?\d{3})*)-?([\dkK])$/,
  suspicious: /^(\d)\1?\.?(\1{3})\.?(\1{3})-?(\d|k)?$/,
}

/**
 * Cleans the input string by removing leading zeros, non-numeric characters, and ensures the RUT is uppercased.
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
  const cleanRut = rut.replace(patterns.cleaning, '').toUpperCase()

  if (cleanRut.length < MIN_RUT_LENGTH || cleanRut.length > MAX_RUT_LENGTH) {
    if (shouldThrow) throw new Error(getInvalidRutError(rut))
    return null
  }

  if (cleanRut.includes('K') && cleanRut.indexOf('K') !== cleanRut.length - 1) {
    if (shouldThrow) throw new Error(getInvalidRutError(rut))
    return null
  }

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
 * @param {string} rut - The string to check.
 * @returns {boolean} True if the string looks like a RUT format, false otherwise.
 */
const isRutLike = (rut: string): boolean => patterns.rutLike.test(rut)

/**
 * Checks if a RUT matches suspicious patterns (e.g., 11.111.111-1, 22.222.222-2).
 * These RUTs are technically valid but often used as placeholder/test data.
 * @param {string} rut - The RUT string to check.
 * @returns {boolean} True if the RUT is suspicious, false otherwise.
 */
const isSuspicious = (rut: string): boolean => patterns.suspicious.test(rut)

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
  
  // Use cleanRaw since we're validating a body (7-8 digits), not a complete RUT (8-9 chars)
  const cleanedRut = cleanRaw(rutBody)

  // Body should be 7-8 digits (not 8-9 like complete RUT)
  if (cleanedRut.length < 7 || cleanedRut.length > 8) {
    if (throwOpt.throwOnError) throw new Error(getInvalidRutError(rutBody))
    return null
  }

  // Body should only contain digits (no K allowed in body)
  if (!/^\d+$/.test(cleanedRut)) {
    if (throwOpt.throwOnError) throw new Error(getInvalidRutError(rutBody))
    return null
  }

  const sum = cleanedRut
    .split('')
    .reverse()
    .reduce((acc, digit, index) => acc + Number(digit) * ((index % 6) + 2), 0)

  const checkDigit = 11 - (sum % 11)
  return (checkDigit === 11 ? '0' : checkDigit === 10 ? 'K' : checkDigit.toString()) as VerifierDigit
}

/**
 * Validates a given RUT string, optionally with strict mode to also check for suspicious patterns.
 * @param {unknown} rut - The RUT string to validate.
 * @param {ValidateOptions} [options] - Validation options.
 * @param {boolean} [options.strict=false] - If true, rejects suspicious RUTs (e.g., 11.111.111-1).
 * @returns {boolean} True if the RUT is valid, false otherwise.
 */
const validate = (rut: unknown, options?: ValidateOptions): boolean => {
  if (typeof rut !== 'string' || rut.length === 0) return false
  if (!isRutLike(rut)) return false
  if (options?.strict && isSuspicious(rut)) return false

  const decomposed = decompose(rut, { throwOnError: false })
  if (!decomposed) return false

  const calculatedVerifier = calculateVerifier(decomposed.body, { throwOnError: false })
  if (!calculatedVerifier) return false

  return calculatedVerifier === decomposed.verifier
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

  if (rut.length === 0) return ''

  // Incremental mode: format progressively without length validation
  if (opts.incremental) {
    const rawClean = cleanRaw(rut)
    if (rawClean.length === 0) return ''

    // For short inputs (< 8 chars), only add dots, no hyphen
    if (rawClean.length < MIN_RUT_LENGTH) {
      if (!opts.dots || rawClean.length <= 3) return rawClean

      // Add dots every 3 digits from right
      let result = rawClean.slice(-3)
      for (let i = 3; i < rawClean.length; i += 3) {
        const start = rawClean.length - 3 - i < 0 ? 0 : rawClean.length - 3 - i
        result = rawClean.slice(start, rawClean.length - i) + '.' + result
      }
      return result
    }

    // For complete RUTs (8+ chars), add hyphen before verifier and dots
    let result = rawClean.slice(-1) // Verifier digit
    result = rawClean.slice(-4, -1) + '-' + result // 3 digits + hyphen + verifier

    for (let i = 4; i < rawClean.length; i += 3) {
      const start = rawClean.length - 3 - i < 0 ? 0 : rawClean.length - 3 - i
      if (opts.dots) {
        result = rawClean.slice(start, rawClean.length - i) + '.' + result
      } else {
        result = rawClean.slice(start, rawClean.length - i) + result
      }
    }

    return result
  }

  // Non-incremental mode: validate length
  const cleanRut = clean(rut, withThrowOption(opts.throwOnError))
  if (cleanRut === null) return null

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
 * @returns {string} A randomly generated, valid RUT string.
 */
const generate = (): string => {
  const body = Math.floor(10000003 + Math.random() * 90000000).toString()
  const verifier = calculateVerifier(body)
  return format(body + verifier)
}

export { validate, clean, format, calculateVerifier, getBody, getVerifier, decompose, generate, isRutLike }
export type { DecomposedRut, FormatOptions, SafeOptions, ValidateOptions, VerifierDigit }
