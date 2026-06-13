import { parseRut, isValidRut } from '../src'

describe('parseRut', () => {
  describe('success — returns the canonical dotted form', () => {
    test.each([
      ['123456785', '12.345.678-5', 'compact'],
      ['12345678-5', '12.345.678-5', 'compact + hyphen'],
      ['12.345.678-5', '12.345.678-5', 'already canonical'],
      ['1234567-4', '1.234.567-4', '7-digit compact'],
      ['  12.345.678-5  ', '12.345.678-5', 'surrounding whitespace'],
      ['0009068826K', '9.068.826-K', 'leading zeros + K'],
      ['14625621k', '14.625.621-K', 'lowercase k normalized to upper'],
    ])('parseRut(%p) → { success: true, rut: %p } (%s)', (input, canonical) => {
      expect(parseRut(input)).toEqual({ success: true, rut: canonical })
    })
  })

  describe('failure — returns { success: false }', () => {
    test.each([
      ['12.345.678-0', 'wrong verifier'],
      ['12.345.6785', 'dotted without hyphen'],
      ['12.345678-5', 'non-canonical grouping'],
      ['nope', 'garbage'],
      ['', 'empty'],
      ['1'.repeat(128), 'over 64-char cap'],
    ])('parseRut(%p) → { success: false } (%s)', (input) => {
      expect(parseRut(input)).toEqual({ success: false })
    })

    test.each([[123456785], [null], [undefined], [{}], [NaN]])(
      'parseRut(%p) → { success: false } (non-string)',
      (value) => {
        expect(parseRut(value as unknown)).toEqual({ success: false })
      },
    )
  })

  describe('strict mode', () => {
    test('rejects suspicious placeholder RUTs', () => {
      expect(parseRut('11.111.111-1', { strict: true })).toEqual({ success: false })
    })

    test('accepts a suspicious RUT when strict is off', () => {
      expect(parseRut('11111111-1')).toEqual({ success: true, rut: '11.111.111-1' })
    })

    test('accepts a normal RUT in strict mode', () => {
      expect(parseRut('12.345.678-5', { strict: true })).toEqual({ success: true, rut: '12.345.678-5' })
    })
  })

  test('the narrowed result can be used directly (safe-parse ergonomics)', () => {
    const result = parseRut('12345678-5')
    if (result.success) {
      expect(result.rut).toBe('12.345.678-5')
    } else {
      throw new Error('expected success')
    }
  })
})

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

  test.each([[123456785], [null], [undefined], [{}]])('returns false for non-string input: %p', (value) => {
    expect(isValidRut(value as unknown)).toBe(false)
  })

  test('honors strict mode', () => {
    expect(isValidRut('11.111.111-1')).toBe(true)
    expect(isValidRut('11.111.111-1', { strict: true })).toBe(false)
  })

  test('agrees with parseRut on success/failure', () => {
    for (const input of ['12.345.678-5', '12345678-5', 'nope', '12.345.678-0', '12.345.6785']) {
      expect(isValidRut(input)).toBe(parseRut(input).success)
    }
  })
})
