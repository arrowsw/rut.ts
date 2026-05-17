import { format } from '../src'

describe('format', () => {
  describe('standard formatting (non-incremental)', () => {
    test.each([
      ['189726317', { dots: true }, '18.972.631-7'],
      ['189726317', { dots: false }, '18972631-7'],
      ['123456785', { dots: true }, '12.345.678-5'],
      ['123456785', { dots: false }, '12345678-5'],
      ['14625621k', undefined, '14.625.621-K'],
      ['09068826K', undefined, '9.068.826-K'],
      ['0012345674', undefined, '1.234.567-4'],
      ['009068826K', undefined, '9.068.826-K'],
      ['14.625.621-k', undefined, '14.625.621-K'],
      ['12#345#678#5', undefined, '12.345.678-5'],
      [' 123 456 785 ', undefined, '12.345.678-5'],
      ['12-345-678-5', undefined, '12.345.678-5'],
      ['18.972.631-7', undefined, '18.972.631-7'], // idempotent on canonical input
      ['9.068.826-K', undefined, '9.068.826-K'],
      ['10000130', undefined, '1.000.013-0'], // verifier 0 boundary
    ])('format(%p, %p) === %p', (rut, options, expected) => {
      expect(format(rut, options)).toBe(expected)
    })

    test('format is idempotent on its own output', () => {
      for (const input of ['18.972.631-7', '14.625.621-K', '9.068.826-K']) {
        const once = format(input)
        expect(format(once)).toBe(once)
      }
    })

    test('returns empty string for empty input (does not throw)', () => {
      expect(format('')).toBe('')
    })
  })

  describe('verifier validation (v4 breaking change #1)', () => {
    // v3 silently "repaired" an incorrect verifier; v4 rejects.
    test('throws on numeric wrong verifier (default mode)', () => {
      expect(() => format('123456789')).toThrow('Invalid RUT input')
    })

    test('throws on K-verifier mismatch (default mode)', () => {
      // body 1234567 has DV 4, not K — v3 used to "repair" this; v4 rejects.
      expect(() => format('1234567K')).toThrow('Invalid RUT input')
      // body 12345678 has DV 5, not K.
      expect(() => format('12345678K')).toThrow('Invalid RUT input')
    })

    test('returns null in safe mode for any wrong verifier', () => {
      expect(format('123456789', { throwOnError: false })).toBeNull()
      expect(format('1234567K', { throwOnError: false })).toBeNull()
      expect(format('12345678K', { throwOnError: false })).toBeNull()
    })

    test('does not echo the input in the error message (PII protection)', () => {
      expect(() => format('123456789')).not.toThrow(/123/)
    })
  })

  describe('safe mode (throwOnError: false)', () => {
    test.each([
      ['', '', 'empty string short-circuits to ""'],
      ['189726317', '18.972.631-7', 'valid RUT formats normally'],
    ])('format(%p, { throwOnError: false }) === %p (%s)', (input, expected, _label) => {
      expect(format(input, { throwOnError: false })).toBe(expected)
    })

    test('supports throwOnError combined with other options', () => {
      expect(format('189726317', { dots: false, throwOnError: false })).toBe('18972631-7')
    })

    test.each([
      ['123', 'too short'],
      ['1234567', '7 chars'],
      ['12345678901', '11 chars'],
      ['123456789', 'wrong verifier'],
      ['K234567-8', 'K at the start'],
      ['1234K678-9', 'K in the middle'],
    ])('returns null for invalid input: %p (%s)', (input, _label) => {
      expect(format(input, { throwOnError: false })).toBeNull()
    })

    test.each([
      [123456785, 'number'],
      [null, 'null'],
      [undefined, 'undefined'],
      [{}, 'object'],
      [Symbol('rut'), 'symbol'],
    ])('returns null for non-string input: %p (%s)', (value, _label) => {
      expect(format(value as unknown as string, { throwOnError: false })).toBeNull()
    })
  })

  describe('error mode (default)', () => {
    test.each([['1234567'], ['123'], ['12345678901'], ['K234567-8'], ['1234K678-9']])(
      'throws for invalid input: %p',
      (input) => {
        expect(() => format(input)).toThrow('Invalid RUT input')
      },
    )
  })

  describe('security — MAX_RUT_INPUT_LENGTH (64) cap', () => {
    test('accepts input padded to exactly 64 chars in non-incremental mode', () => {
      const padded = '0'.repeat(55) + '123456785' // length 64, valid DV
      expect(padded.length).toBe(64)
      expect(format(padded)).toBe('12.345.678-5')
    })

    test('rejects input at 65 chars (over the cap)', () => {
      const overCap = '0'.repeat(56) + '123456785'
      expect(overCap.length).toBe(65)
      expect(format(overCap, { throwOnError: false })).toBeNull()
      expect(() => format(overCap)).toThrow('Invalid RUT input')
    })
  })

  describe('incremental mode — progressive formatting', () => {
    test.each([
      ['1', '1'],
      ['12', '12'],
      ['123', '123'],
      ['1234', '1.234'],
      ['12345', '12.345'],
      ['123456', '123.456'],
      ['1234567', '1.234.567'],
      // hyphen appears at 8+ chars (complete)
      ['12345678', '1.234.567-8'],
      ['123456789', '12.345.678-9'],
    ])('format(%p, { incremental: true }) === %p (length sweep 1..9)', (input, expected) => {
      expect(format(input, { incremental: true })).toBe(expected)
    })

    test.each([
      ['1234', '1234'],
      ['12345678', '1234567-8'],
      ['123456789', '12345678-9'],
    ])('with dots:false, format(%p, incremental) === %p', (input, expected) => {
      expect(format(input, { incremental: true, dots: false })).toBe(expected)
    })

    test.each([
      ['1234567K', '1.234.567-K'],
      ['1234567k', '1.234.567-K'],
      ['12345678K', '12.345.678-K'],
    ])('K verifier (case-insensitive) in incremental: %p → %p', (input, expected) => {
      expect(format(input, { incremental: true })).toBe(expected)
    })

    test.each([
      ['', ''],
      ['   ', ''], // whitespace-only normalizes to empty
      ['00000000', ''], // all zeros strip to empty
      ['00001234', '1.234'],
      ['00012345678', '1.234.567-8'],
    ])('strips leading zeros / empty edge cases: %p → %p', (input, expected) => {
      expect(format(input, { incremental: true })).toBe(expected)
    })

    test.each([
      ['12.345', '12.345'],
      ['12-345-678', '1.234.567-8'],
      ['12#34#56#78', '1.234.567-8'],
    ])('cleans input while formatting incrementally: %p → %p', (input, expected) => {
      expect(format(input, { incremental: true })).toBe(expected)
    })

    test('caps very long inputs to the maximum RUT length (v4 breaking change #7)', () => {
      expect(format('12345678901234', { incremental: true })).toBe('12.345.678-9')
    })

    test('caps to 9 significant chars and drops a trailing K beyond the cap', () => {
      // A trailing K is preserved only while the value still fits in 9 chars.
      expect(format('123456785K', { incremental: true })).toBe('12.345.678-5')
      expect(format('12.345.678-K', { incremental: true })).toBe('12.345.678-K')
      // ...but once normalization yields >9 significant chars, the cap to
      // MAX_RUT_LENGTH (9) keeps the first 9 digits and the K is dropped.
      // This only affects live-typing display; final values must still be
      // checked with `validate()`.
      expect(format('1234567890K', { incremental: true })).toBe('12.345.678-9')
      expect(format('12345678901234K', { incremental: true })).toBe('12.345.678-9')
    })

    test('silently drops a K that is not the trailing character', () => {
      // Locks in observed behavior so a refactor cannot silently regress it.
      // These inputs would never come from a normal typing flow, but a paste
      // could produce them — the renderer keeps only digits + trailing K.
      expect(format('K12345678', { incremental: true })).toBe('1.234.567-8')
      expect(format('1234K5678', { incremental: true })).toBe('1.234.567-8')
      expect(format('KK345678', { incremental: true })).toBe('345.678')
    })

    test('incremental mode never throws regardless of throwOnError', () => {
      // Documented contract: throwOnError is ignored in incremental mode.
      expect(() => format('@@@@', { incremental: true, throwOnError: true })).not.toThrow()
      expect(() => format('00000000', { incremental: true, throwOnError: true })).not.toThrow()
      expect(() => format('K@K@K@', { incremental: true, throwOnError: true })).not.toThrow()
    })
  })
})
