type ValidationPatterns = { rutLike: RegExp; suspicious: RegExp; cleaning: RegExp }
type DecomposedRut = { body: string; verifier: string }
type FormatOptions = { incremental?: boolean; dots?: boolean }

export const getInvalidRutError = (rut: string): string => `String "${rut}" is not valid as a RUT input`

const MIN_RUT_LENGTH = 8
const MAX_RUT_LENGTH = 9

const patterns: ValidationPatterns = {
  cleaning: /^0+|[^0-9kK]+/g,
  rutLike: /^0*(\d{1,3}(\.?\d{3})*)-?([\dkK])$/,
  suspicious: /^(\d)\1?\.?(\1{3})\.?(\1{3})-?(\d|k)?$/,
}

/**
 * Cleans the input string by removing leading zeros, non-numeric characters, and ensures the RUT is uppercased. Throws an error if the cleaned RUT is not within the valid length range or if 'K' is not in the correct position.
 * @param {string} rut - The RUT string to clean.
 * @returns {string} The cleaned RUT string.
 * @throws {Error} If the RUT is not valid.
 */
const clean = (rut: string): string => {
  const cleanRut = rut.replace(patterns.cleaning, '').toUpperCase()
  if (cleanRut.length < MIN_RUT_LENGTH || cleanRut.length > MAX_RUT_LENGTH) throw new Error(getInvalidRutError(rut))
  if (cleanRut.includes('K') && cleanRut.indexOf('K') !== cleanRut.length - 1) throw new Error(getInvalidRutError(rut))
  return cleanRut
}

/**
 * Extracts the body (part before the verifier digit) from a given RUT string.
 * This function first cleans the input RUT string to ensure it is in a valid format before slicing.
 * @param {string} rut - The RUT string from which to extract the body.
 * @returns {string} The body of the RUT.
 * @throws {Error} If the cleaned RUT is not valid.
 */
const getBody = (rut: string): string => clean(rut).slice(0, -1)

/**
 * Extracts the verifier digit (the last character) from a given RUT string.
 * This function cleans the input RUT string to ensure it is in a valid format before extracting the verifier digit.
 * @param {string} rut - The RUT string from which to extract the verifier digit.
 * @returns {string} The verifier digit of the RUT.
 * @throws {Error} If the cleaned RUT is not valid.
 */
const getVerifier = (rut: string): string => clean(rut).slice(-1)

/**
 * Decomposes the given RUT into its body and verifier parts.
 * @param {string} rut - The RUT string to decompose.
 * @returns {DecomposedRut} An object containing the body and verifier of the RUT.
 */
const decompose = (rut: string): DecomposedRut => ({ body: getBody(rut), verifier: getVerifier(rut) })

const isRutLike = (rut: string): boolean => patterns.rutLike.test(rut)

const isSuspicious = (rut: string): boolean => patterns.suspicious.test(rut)

/**
 * Calculates the verifier digit for a given RUT body.
 * @param {string} rutBody - The body of the RUT for which to calculate the verifier.
 * @returns {string} The calculated verifier digit.
 * @throws {Error} If the RUT body, after being cleaned, is empty.
 */
const calculateVerifier = (rutBody: string): string => {
  const cleanedRut = clean(rutBody)
  if (cleanedRut.length === 0) throw new Error(getInvalidRutError(rutBody))

  const sum = cleanedRut
    .split('')
    .reverse()
    .reduce((acc, digit, index) => acc + Number(digit) * ((index % 6) + 2), 0)

  const checkDigit = 11 - (sum % 11)
  return checkDigit === 11 ? '0' : checkDigit === 10 ? 'K' : checkDigit.toString()
}

/**
 * Validates a given RUT string, optionally with strict mode to also check for suspicious patterns.
 * @param {string} rut - The RUT string to validate.
 * @param {boolean} [strict=false] - Whether to use strict mode for validation.
 * @returns {boolean} True if the RUT is valid, false otherwise.
 */
const validate = (rut: string, strict?: boolean): boolean => {
  if (!isRutLike(rut)) return false
  if (strict && isSuspicious(rut)) return false

  const { body, verifier } = decompose(rut)
  const calculatedVerifier = calculateVerifier(body)

  return calculatedVerifier === verifier
}

/**
 * Formats a given RUT string, with options for incremental formatting and dot separators.
 * @param {string} rut - The RUT string to format.
 * @param options {FormatOptions} - The formatting options.
 * @param {boolean} options.incremental - Whether to format the RUT incrementally.
 * @param {boolean} options.dots - Whether to include dot separators in the formatted RUT.
 * @returns {string} The formatted RUT string.
 */
const format = (rut: string, options?: FormatOptions): string => {
  const opts = { incremental: options?.incremental ?? false, dots: options?.dots ?? true }
  if (rut.length === 0) return ''
  if (rut.length <= 6 && !opts.dots) return rut
  const cleanRut = clean(rut)

  if (opts.incremental) {
    let result = cleanRut.slice(-1) // Start with verifier part
    if (cleanRut.length > 1) {
      result = cleanRut.slice(-4, -1) + '-' + result // Add separator for verifier
    }

    for (let i = 4; i < cleanRut.length; i += 3) {
      const start = cleanRut.length - 3 - i < 0 ? 0 : cleanRut.length - 3 - i
      if (opts.dots) {
        result = cleanRut.slice(start, cleanRut.length - i) + '.' + result // Add dots for the body
      } else {
        result = cleanRut.slice(start, cleanRut.length - i) + result // No dots for the body
      }
    }

    return result
  }

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

export { validate, clean, format, calculateVerifier, getBody, getVerifier, decompose, generate }
