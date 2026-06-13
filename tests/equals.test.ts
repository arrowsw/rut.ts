import { equals } from '../src'

describe('equals', () => {
  describe('true — same RUT across different shapes', () => {
    test.each([
      ['12.345.678-5', '123456785', 'dotted vs compact'],
      ['12.345.678-5', '12345678-5', 'dotted vs compact+hyphen'],
      ['123456785', '12345678-5', 'compact vs compact+hyphen'],
      ['12.345.678-5', '  12.345.678-5  ', 'whitespace difference'],
      ['14.625.621-K', '14.625.621-k', 'verifier case difference'],
      ['9.068.826-K', '0009068826K', 'leading zeros difference'],
      ['12.345.678-5', '12.345.678-5', 'identical'],
    ])('equals(%p, %p) === true (%s)', (a, b) => {
      expect(equals(a, b)).toBe(true)
    })
  })

  describe('false — different RUTs', () => {
    test.each([
      ['12.345.678-5', '1.234.567-4', 'different bodies'],
      ['12345678-5', '12345678-9', 'same body, different verifier char'],
      ['12.345.678-5', '98.765.432-1', 'unrelated'],
    ])('equals(%p, %p) === false (%s)', (a, b) => {
      expect(equals(a, b)).toBe(false)
    })
  })

  describe('false — one or both arguments are not clean-able RUTs', () => {
    test.each([
      ['12.345.678-5', 'nope', 'second invalid'],
      ['nope', '12.345.678-5', 'first invalid'],
      ['nope', 'also-nope', 'both invalid'],
      ['', '', 'both empty'],
    ])('equals(%p, %p) === false (%s)', (a, b) => {
      expect(equals(a, b)).toBe(false)
    })

    test.each([
      [123456785, '123456785'],
      ['123456785', null],
      [null, undefined],
      [{}, '12345678-5'],
    ])('equals(%p, %p) === false (non-string)', (a, b) => {
      expect(equals(a as unknown, b as unknown)).toBe(false)
    })
  })

  test('is symmetric', () => {
    expect(equals('12.345.678-5', '123456785')).toBe(equals('123456785', '12.345.678-5'))
  })

  test('comparison ignores the Modulo-11 checksum (normalizes shape only)', () => {
    // Both have an invalid checksum but the same normalized form → equal.
    expect(equals('12.345.678-9', '123456789')).toBe(true)
  })
})
