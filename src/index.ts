type ValidationPatterns = { rutLike: RegExp; suspicious: RegExp; cleaning: RegExp }
type DecomposedRut = { body: string; verifier: string }

const getInvalidRutError = (rut: string): string => `String "${rut}" is not valid as a RUT input`

const patterns: ValidationPatterns = {
  cleaning: /^0+|[^0-9kK]+/g,
  rutLike: /^0*(\d{1,3}(\.?\d{3})*)-?([\dkK])$/,
  suspicious: /^(\d)\1?\.?(\1{3})\.?(\1{3})-?(\d|kK)?$/gi,
}

const clean = (rut: string): string => {
  const cleanRut = rut.toUpperCase().replace(patterns.cleaning, '')
  if (cleanRut.length < 8 || cleanRut.length > 9) throw new Error(getInvalidRutError(rut))
  return cleanRut
}

const isRutLike = (rut: string): boolean => patterns.rutLike.test(rut)

const isSuspicious = (rut: string): boolean => patterns.suspicious.test(rut)

const validate = (rut: string, strict?: boolean): boolean => {
  if (!isRutLike(rut)) return false
  if (strict && isSuspicious(rut)) return false

  const r = clean(rut)

  let t = parseInt(r.slice(0, -1), 10)
  let m = 0
  let s = 1

  while (t > 0) {
    s = (s + (t % 10) * (9 - (m++ % 6))) % 11
    t = Math.floor(t / 10)
  }

  const v = s > 0 ? '' + (s - 1) : 'K'
  return v === r.slice(-1)
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

const calculateVerifier = (rut: string): string => {
  const r = Array.from(clean(rut), Number)

  if (r.length === 0 || r.includes(NaN)) throw new Error(getInvalidRutError(rut))

  const modulus = 11
  const initialValue = 0
  const sum = r
    .reverse()
    .reduce((accumulator, currentValue, index) => accumulator + currentValue * ((index % 6) + 2), initialValue)

  const verifierDigit = modulus - (sum % modulus)

  if (verifierDigit === 10) return 'K'
  if (verifierDigit === 11) return '0'

  return `${verifierDigit}`
}

const getBody = (rut: string): string => clean(rut).slice(0, -1)
const getVerifier = (rut: string): string => clean(rut).slice(-1)
const decompose = (rut: string): DecomposedRut => ({ body: getBody(rut), verifier: getVerifier(rut) })

const generate = (): string => {
  const body = Math.floor(Math.random() * (24999999 - 1000000 + 1) + 1000000).toString()
  const verifier = calculateVerifier(body)
  return format(body + verifier)
}

export { validate, clean, format, calculateVerifier, getBody, getVerifier, decompose, generate }
