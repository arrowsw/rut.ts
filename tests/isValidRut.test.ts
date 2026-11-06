import { isValidRut, validate } from '../src'

describe('isValidRut', () => {
  test.each([
    ['12.345.678-5', 'canonical dotted'],
    ['12345678-5', 'compact + hyphen'],
    ['123456785', 'compact'],
    ['14.625.621-k', 'lowercase k'],
    ['  12.345.678-5  ', 'surrounding whitespace'],
  ])('returns true for valid RUT: %p (%s)', (rut) => {
    expect(isValidRut(rut)).toBe(true)
  })

  test.each([
    ['12.345.678-0', 'wrong verifier'],
    ['12.345.6785', 'dotted without hyphen'],
    ['nope', 'garbage'],
    ['', 'empty'],
  ])('returns false for invalid RUT: %p (%s)', (rut) => {
    expect(isValidRut(rut)).toBe(false)
  })

  // A body shorter than 7 digits is never branded as a `Rut`, even when its
  // Modulo 11 digit is correct (it is, for every input here).
  test.each([['999999-K'], ['999.999-K'], ['999999K'], ['100000-4'], ['1-9']])(
    'returns false for a body shorter than 7 digits: %p',
    (rut) => {
      expect(isValidRut(rut)).toBe(false)
      expect(isValidRut(rut, { strict: true })).toBe(false)
    },
  )

  test.each([[123456785], [null], [undefined], [{}]])('returns false for non-string input: %p', (value) => {
    expect(isValidRut(value as unknown)).toBe(false)
  })

  test('honors strict mode', () => {
    expect(isValidRut('11.111.111-1')).toBe(true)
    expect(isValidRut('11.111.111-1', { strict: true })).toBe(false)
  })

  test('agrees with validate (it is the narrowing form of the same check)', () => {
    for (const input of ['12.345.678-5', '12345678-5', 'nope', '12.345.678-0', '12.345.6785']) {
      expect(isValidRut(input)).toBe(validate(input))
    }
  })
})
