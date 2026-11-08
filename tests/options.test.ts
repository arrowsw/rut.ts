import {
  calculateVerifier,
  clean,
  decompose,
  equals,
  format,
  generate,
  getBody,
  getVerifier,
  InvalidRutError,
  mask,
  validate,
} from '../src'

// Options are read only from the caller's own object. If another bug in the app
// pollutes `Object.prototype`, an options object such as `{}` must not inherit a
// value that switches a check off (or changes the result's shape).
describe('options ignore inherited values', () => {
  const polluted = {
    throwOnError: false,
    requireValid: false,
    incremental: true,
    dots: false,
    strict: true,
    count: 3,
    bodyLength: 7,
    format: 'compact',
  }
  const proto = Object.prototype as Record<string, unknown>

  beforeEach(() => {
    for (const [key, value] of Object.entries(polluted)) proto[key] = value
  })

  afterEach(() => {
    for (const key of Object.keys(polluted)) delete proto[key]
  })

  test('the pollution is in place for every test', () => {
    expect(({} as Record<string, unknown>).throwOnError).toBe(false)
  })

  test('safe helpers still throw with {} as options', () => {
    for (const call of [
      () => clean('not-a-rut', {}),
      () => getBody('not-a-rut', {}),
      () => getVerifier('not-a-rut', {}),
      () => decompose('not-a-rut', {}),
      () => calculateVerifier('12', {}),
      () => mask('not-a-rut', {}),
      () => format('12.345.678-4', {}),
    ]) {
      expect(call).toThrow(InvalidRutError)
    }
  })

  test('format({}) checks Modulo 11 and keeps its dots', () => {
    expect(() => format('12.345.678-4', {})).toThrow('Invalid RUT input')
    expect(format('123456785', {})).toBe('12.345.678-5')
  })

  test('equals(a, b, {}) still requires a valid RUT', () => {
    expect(equals('12345678-9', '12345678-9', {})).toBe(false)
  })

  test('validate(rut, {}) is not made strict', () => {
    expect(validate('11.111.111-1', {})).toBe(true)
  })

  test('generate({}) returns one dotted 8-digit RUT, not an array', () => {
    const rut = generate({})
    expect(typeof rut).toBe('string')
    expect(rut).toMatch(/^\d{2}\.\d{3}\.\d{3}-[\dK]$/)
  })

  test("the caller's own options still apply", () => {
    expect(clean('not-a-rut', { throwOnError: false })).toBeNull()
    expect(equals('12345678-9', '12345678-9', { requireValid: false })).toBe(true)
    expect(format('123456785', { dots: false })).toBe('12345678-5')
    expect(format('1234', { incremental: true })).toBe('1.234')
    expect(validate('11.111.111-1', { strict: true })).toBe(false)
    expect(generate({ count: 2, bodyLength: 7, format: 'compact' })).toHaveLength(2)
  })

  test('a null-prototype options object works', () => {
    const options = Object.assign(Object.create(null), { throwOnError: false })
    expect(clean('not-a-rut', options)).toBeNull()
  })
})
