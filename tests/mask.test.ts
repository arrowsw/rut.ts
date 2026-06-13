import { mask, InvalidRutError } from '../src'

describe('mask', () => {
  describe('masks the middle groups, keeps the head and verifier', () => {
    test.each([
      ['12.345.678-5', '12.***.***-5', '8-digit body'],
      ['1.234.567-4', '1.***.***-4', '7-digit body'],
      ['123456785', '12.***.***-5', 'compact input'],
      ['12345678-5', '12.***.***-5', 'compact + hyphen input'],
      ['14.625.621-k', '14.***.***-K', 'lowercase k normalized'],
      ['0009068826K', '9.***.***-K', 'leading zeros stripped'],
    ])('mask(%p) === %p (%s)', (input, expected) => {
      expect(mask(input)).toBe(expected)
    })
  })

  test('does not require a correct Modulo-11 verifier (masks structure, not validity)', () => {
    // mask is a display/logging helper: it normalizes shape via clean(), which
    // does not check the checksum. A wrong verifier is still masked.
    expect(mask('12.345.678-9')).toBe('12.***.***-9')
  })

  test('never reveals the masked body digits', () => {
    const masked = mask('12.345.678-5')
    expect(masked).not.toMatch(/345|678/)
    expect(masked).toBe('12.***.***-5')
  })

  describe('safe mode (throwOnError: false)', () => {
    test.each([
      ['', 'empty'],
      ['123', 'too short'],
      ['invalid', 'non-numeric'],
      ['1'.repeat(128), 'over 64-char cap'],
    ])('returns null for invalid input: %p (%s)', (input) => {
      expect(mask(input, { throwOnError: false })).toBeNull()
    })
  })

  describe('error mode (default)', () => {
    test('throws InvalidRutError with no PII echoed', () => {
      expect(() => mask('not-a-rut')).toThrow(InvalidRutError)
      expect(() => mask('not-a-rut')).toThrow('Invalid RUT input')
      expect(() => mask('not-a-rut')).not.toThrow(/not-a-rut/)
    })
  })
})
