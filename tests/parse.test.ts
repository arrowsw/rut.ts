import { parse, validate, InvalidRutError } from '../src'

describe('parse', () => {
  describe('default mode — lenient normalization + Modulo 11 validation', () => {
    test.each([
      ['12.345.678-5', '12345678', '5', '123456785', '12.345.678-5', 'dotted'],
      ['12345678-5', '12345678', '5', '123456785', '12.345.678-5', 'compact + hyphen'],
      ['123456785', '12345678', '5', '123456785', '12.345.678-5', 'compact'],
      ['0012345674', '1234567', '4', '12345674', '1.234.567-4', 'zero-padded fixed-width export'],
      ['  12.345.678-5  ', '12345678', '5', '123456785', '12.345.678-5', 'surrounding whitespace'],
      ['RUT: 12.345.678-5', '12345678', '5', '123456785', '12.345.678-5', 'embedded garbage'],
      ['12345.6785', '12345678', '5', '123456785', '12.345.678-5', 'odd grouping'],
      ['14.625.621-k', '14625621', 'K', '14625621K', '14.625.621-K', 'lowercase verifier'],
    ])('parse(%p) succeeds (%s)', (input, body, verifier, rut, formatted) => {
      expect(parse(input)).toEqual({ success: true, rut, body, verifier, formatted })
    })

    test.each([
      ['12345678-9', 'wrong verifier'],
      ['12.345.678-K', 'wrong verifier (K)'],
      ['1234567', 'body only, no verifier'],
      ['', 'empty string'],
      ['   ', 'whitespace-only'],
      ['nope', 'not RUT-shaped'],
      ['12.345.678-', 'missing verifier'],
    ])('parse(%p) fails (%s)', (input) => {
      const result = parse(input)
      expect(result.success).toBe(false)
      if (result.success) throw new Error('unreachable')
      expect(result.error).toBeInstanceOf(InvalidRutError)
    })

    test.each([[null], [undefined], [12345678], [123456785], [{}], [[]], [true]])(
      'parse(%p) fails (non-string input)',
      (input) => {
        expect(parse(input).success).toBe(false)
      },
    )
  })

  describe("canonicalOnly mode — validate()'s shape contract before the DV check", () => {
    test.each([
      ['12.345.678-5', 'dotted'],
      ['12345678-5', 'compact + hyphen'],
      ['123456785', 'compact'],
      ['  12.345.678-5  ', 'surrounding whitespace is tolerated'],
    ])('parse(%p, { canonicalOnly: true }) succeeds (%s)', (input) => {
      expect(parse(input, { canonicalOnly: true }).success).toBe(true)
    })

    test.each([
      ['0012345674', 'leading-zero padding'],
      ['01234567-4', 'single zero absorbed by an 8-char body slot (7-digit trap)'],
      ['012.345.678-5', 'zero-padded dotted'],
      ['RUT: 12.345.678-5', 'embedded garbage'],
      ['12345.6785', 'non-canonical grouping'],
    ])('parse(%p, { canonicalOnly: true }) fails (%s)', (input) => {
      expect(parse(input, { canonicalOnly: true }).success).toBe(false)
    })

    test.each([
      ['0012345674', 'leading-zero padding'],
      ['RUT: 12.345.678-5', 'embedded garbage'],
      ['12345.6785', 'non-canonical grouping'],
    ])('canonicalOnly rejects %p while the default mode recovers it (%s)', (input) => {
      expect(parse(input).success).toBe(true)
      expect(parse(input, { canonicalOnly: true }).success).toBe(false)
    })
  })

  describe('strict mode — rejects repeated-digit placeholders', () => {
    test('a valid but suspicious placeholder passes by default and fails in strict mode', () => {
      expect(parse('11.111.111-1').success).toBe(true)
      expect(parse('11.111.111-1', { strict: true }).success).toBe(false)
    })

    test('a regular valid RUT passes strict mode', () => {
      expect(parse('12.345.678-5', { strict: true }).success).toBe(true)
    })

    test('strict composes with canonicalOnly', () => {
      expect(parse('011.111.111-1', { strict: true }).success).toBe(false) // placeholder (lenient recovers the zeros)
      expect(parse('011.111.111-1', { strict: true, canonicalOnly: true }).success).toBe(false) // padding rejected first
      expect(parse('12.345.678-5', { strict: true, canonicalOnly: true }).success).toBe(true)
    })
  })

  describe('security & error contract', () => {
    test('64-char cap is enforced before any parsing (whitespace-padded valid input at the boundary)', () => {
      const padded64 = '12.345.678-5'.padStart(64, ' ')
      const padded65 = '12.345.678-5'.padStart(65, ' ')
      expect(padded64).toHaveLength(64)
      expect(parse(padded64).success).toBe(true)
      expect(parse(padded65).success).toBe(false)
    })

    test('never throws, for any input', () => {
      const hostile = [
        null,
        undefined,
        12345678,
        {},
        [],
        '',
        '   ',
        'x'.repeat(100000),
        '0'.repeat(100000) + 'x',
        '12345678-9',
        Symbol('rut'),
      ]
      for (const input of hostile) {
        expect(() => parse(input)).not.toThrow()
        expect(() => parse(input, { strict: true, canonicalOnly: true })).not.toThrow()
      }
    })

    test('the failure error is the constant-message InvalidRutError — no PII leaks', () => {
      const result = parse('leaky-secret-99.999.999-9')
      if (result.success) throw new Error('unreachable')
      expect(result.error).toBeInstanceOf(InvalidRutError)
      expect(result.error.code).toBe('INVALID_RUT')
      expect(result.error.message).toBe('Invalid RUT input')
      expect(result.error.message).not.toContain('leaky-secret')
      expect(result.error.message).not.toContain('99.999.999')
    })
  })

  describe('output contract', () => {
    test('formatted is always the canonical dotted form and passes validate()', () => {
      for (const input of ['0012345674', '123456785', 'RUT: 14.625.621-k']) {
        const result = parse(input)
        if (!result.success) throw new Error(`expected success for ${input}`)
        expect(validate(result.formatted)).toBe(true)
        expect(validate(result.rut)).toBe(true)
        expect(result.rut).toBe(result.body + result.verifier)
      }
    })
  })
})
