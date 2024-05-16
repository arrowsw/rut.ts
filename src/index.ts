type ValidationPatterns = { rutLike: RegExp; suspicious: RegExp; cleaning: RegExp }
type DecomposedRut = { body: string; verifier: string }

export const getInvalidRutError = (rut: string): string => `String "${rut}" is not valid as a RUT input`
export const getInvalidRutBodyError = (rutBody: string): string =>
  `String "${rutBody}" is not valid as a RUT Body input`
const MIN_RUT_LENGTH = 8
const MAX_RUT_LENGTH = 9

const patterns: ValidationPatterns = {
  cleaning: /^0+|[^0-9kK]+/g,
  rutLike: /^0*(\d{1,3}(\.?\d{3})*)-?([\dkK])$/,
  suspicious: /^(\d)\1?\.?(\1{3})\.?(\1{3})-?(\d|k)?$/,
}

const clean = (rut: string): string => {
  const cleanRut = rut.replace(patterns.cleaning, '').toUpperCase()
  if (cleanRut.length < MIN_RUT_LENGTH || cleanRut.length > MAX_RUT_LENGTH) throw new Error(getInvalidRutError(rut))
  if (cleanRut.includes('K') && cleanRut.indexOf('K') !== cleanRut.length - 1) throw new Error(getInvalidRutError(rut))
  return cleanRut
}

const getBody = (rut: string): string => clean(rut).slice(0, -1)
const getVerifier = (rut: string): string => clean(rut).slice(-1)
const decompose = (rut: string): DecomposedRut => ({ body: getBody(rut), verifier: getVerifier(rut) })

const isRutLike = (rut: string): boolean => patterns.rutLike.test(rut)

const isSuspicious = (rut: string): boolean => patterns.suspicious.test(rut)

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

const validate = (rut: string, strict?: boolean): boolean => {
  if (!isRutLike(rut)) return false
  if (strict && isSuspicious(rut)) return false

  const { body, verifier } = decompose(rut)
  const calculatedVerifier = calculateVerifier(body)

  return calculatedVerifier === verifier
}

const format = (rut: string, dots: boolean = true): string => {
  if (rut.length === 0) return ''
  const cleanRut = clean(rut)
  if (dots) {
    let result = cleanRut.slice(-4, -1) + '-' + cleanRut.substring(cleanRut.length - 1)
    for (let i = 4; i < cleanRut.length; i += 3) {
      result = cleanRut.slice(-3 - i, -i) + '.' + result
    }
    return result
  }
  return cleanRut.slice(0, -1) + '-' + cleanRut.substring(cleanRut.length - 1)
}

const generate = (): string => {
  const body = Math.floor(10000003 + Math.random() * 90000000).toString()
  const verifier = calculateVerifier(body)
  return format(body + verifier)
}

export { validate, clean, format, calculateVerifier, getBody, getVerifier, decompose, generate }
