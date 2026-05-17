import { format } from '../src'

describe('format', () => {
  describe('with throwOnError: false (safe mode)', () => {
    test('Returns null for invalid RUT instead of throwing', () => {
      expect(format('123', { throwOnError: false })).toBeNull()
    })

    test('Returns formatted RUT when valid', () => {
      expect(format('189726317', { throwOnError: false })).toBe('18.972.631-7')
    })

    test('Supports other options combined with throwOnError', () => {
      expect(format('189726317', { dots: false, throwOnError: false })).toBe('18972631-7')
    })

    test('Returns null for RUTs that are too short', () => {
      expect(format('1234567', { throwOnError: false })).toBeNull()
    })

    test('Returns null for RUTs that are too long', () => {
      expect(format('12345678901', { throwOnError: false })).toBeNull()
    })

    test('Returns null for RUTs with an incorrect verifier', () => {
      expect(format('123456789', { throwOnError: false })).toBeNull()
    })

    test('Returns null for non-string inputs', () => {
      expect(format(123456785 as any, { throwOnError: false })).toBeNull()
      expect(format(null as any, { throwOnError: false })).toBeNull()
    })
  })

  describe('incremental mode (progressive formatting)', () => {
    test('Formats partial RUTs progressively (without hyphen until 8+ chars)', () => {
      expect(format('1', { incremental: true })).toBe('1')
      expect(format('12', { incremental: true })).toBe('12')
      expect(format('123', { incremental: true })).toBe('123')
      expect(format('1234', { incremental: true })).toBe('1.234')
      expect(format('12345', { incremental: true })).toBe('12.345')
      expect(format('123456', { incremental: true })).toBe('123.456')
      expect(format('1234567', { incremental: true })).toBe('1.234.567')
    })

    test('Adds hyphen when RUT is complete (8+ chars)', () => {
      // With 8 chars: 7 body + 1 verifier
      expect(format('12345678', { incremental: true })).toBe('1.234.567-8')
      // With 9 chars: 8 body + 1 verifier
      expect(format('123456789', { incremental: true })).toBe('12.345.678-9')
    })

    test('Formats complete RUTs without dots', () => {
      expect(format('1234', { incremental: true, dots: false })).toBe('1234')
      expect(format('12345678', { incremental: true, dots: false })).toBe('1234567-8')
      expect(format('123456789', { incremental: true, dots: false })).toBe('12345678-9')
    })

    test('Handles RUT with K verifier', () => {
      expect(format('1234567K', { incremental: true })).toBe('1.234.567-K')
      expect(format('1234567k', { incremental: true })).toBe('1.234.567-K')
      expect(format('12345678K', { incremental: true })).toBe('12.345.678-K')
    })

    test('Returns empty string for empty input', () => {
      expect(format('', { incremental: true })).toBe('')
    })

    test('Cleans input while formatting incrementally', () => {
      expect(format('12.345', { incremental: true })).toBe('12.345')
      expect(format('12-345-678', { incremental: true })).toBe('1.234.567-8')
    })

    test('Removes leading zeros in incremental mode', () => {
      expect(format('00001234', { incremental: true })).toBe('1.234')
      expect(format('00012345678', { incremental: true })).toBe('1.234.567-8')
    })

    test('Caps very long inputs to the maximum RUT length', () => {
      expect(format('12345678901234', { incremental: true })).toBe('12.345.678-9')
    })

    test('Caps to 9 significant chars and drops a trailing K beyond the cap', () => {
      // A trailing K is preserved only while the value still fits in 9 chars...
      expect(format('123456785K', { incremental: true })).toBe('12.345.678-5')
      expect(format('12.345.678-K', { incremental: true })).toBe('12.345.678-K')
      // ...but once normalization yields >9 significant chars, the cap to
      // MAX_RUT_LENGTH (9) keeps the first 9 digits and the K is dropped.
      // This only affects live-typing display; final values must still be
      // checked with `validate()`.
      expect(format('1234567890K', { incremental: true })).toBe('12.345.678-9')
      expect(format('12345678901234K', { incremental: true })).toBe('12.345.678-9')
    })

    test('Handles special characters in incremental mode', () => {
      expect(format('12#34#56#78', { incremental: true })).toBe('1.234.567-8')
    })
  })

  describe('standard formatting', () => {
    test('should correctly format RUTs with or without dots', () => {
      expect(format('189726317')).toBe('18.972.631-7')
      expect(format('189726317', { dots: false })).toBe('18972631-7')
    })

    test('Correctly formats with dots and hyphen', () => {
      expect(format('123456785')).toBe('12.345.678-5')
    })

    test('Correctly formats without dots', () => {
      expect(format('123456785', { dots: false })).toBe('12345678-5')
    })

    test('Returns empty string if input is empty', () => {
      expect(format('')).toBe('')
    })

    test('Correctly handles RUTs with K as verification digit', () => {
      expect(format('14625621k')).toBe('14.625.621-K')
      expect(format('09068826K')).toBe('9.068.826-K')
    })

    test('Correctly formats RUTs with leading zeros', () => {
      expect(format('0012345674')).toBe('1.234.567-4')
      expect(format('009068826K')).toBe('9.068.826-K')
    })

    test('Correctly handles RUTs with non-numeric characters', () => {
      expect(format('14.625.621-k')).toBe('14.625.621-K')
      expect(format('12#345#678#5')).toBe('12.345.678-5')
    })

    test('Correctly handles RUTs with white spaces', () => {
      expect(format(' 123 456 785 ')).toBe('12.345.678-5')
    })

    test('Throws for RUTs with an incorrect verifier', () => {
      expect(() => format('123456789')).toThrow()
    })
  })

  describe('edge cases', () => {
    test('Formats 8-character RUTs (7 body + 1 verifier)', () => {
      expect(format('09068826K')).toBe('9.068.826-K')
      expect(format('12345674')).toBe('1.234.567-4')
    })

    test('Formats 9-character RUTs (8 body + 1 verifier)', () => {
      expect(format('189726317')).toBe('18.972.631-7')
      expect(format('123456785')).toBe('12.345.678-5')
    })

    test('Formats with verifier 0', () => {
      expect(format('10000130')).toBe('1.000.013-0')
    })

    test('Already formatted RUTs remain unchanged', () => {
      expect(format('18.972.631-7')).toBe('18.972.631-7')
      expect(format('9.068.826-K')).toBe('9.068.826-K')
    })

    test('Handles RUT with only hyphens as separators', () => {
      expect(format('12-345-678-5')).toBe('12.345.678-5')
    })
  })

  describe('error cases', () => {
    test('Throws error for too short RUT', () => {
      expect(() => format('1234567')).toThrow()
      expect(() => format('123')).toThrow()
    })

    test('Throws error for too long RUT', () => {
      expect(() => format('12345678901')).toThrow()
    })

    test('Throws error for RUT with K not at the end', () => {
      expect(() => format('K234567-8')).toThrow()
      expect(() => format('1234K678-9')).toThrow()
    })
  })
})
