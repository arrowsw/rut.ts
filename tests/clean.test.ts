import { clean } from '../src'

describe('Test Suite: clean', () => {
  describe('with throwOnError: false (safe mode)', () => {
    test('Returns null for empty string instead of throwing', () => {
      expect(clean('', { throwOnError: false })).toBeNull()
    })

    test('Returns null for RUTs that are too short', () => {
      expect(clean('1.2.34-K', { throwOnError: false })).toBeNull()
      expect(clean('123', { throwOnError: false })).toBeNull()
      expect(clean('1234567', { throwOnError: false })).toBeNull()
    })

    test('Returns null for RUTs that are too long', () => {
      expect(clean('12.345.6789012-3', { throwOnError: false })).toBeNull()
      expect(clean('12345678901', { throwOnError: false })).toBeNull()
    })

    test('Returns null for RUTs with K not at the end', () => {
      expect(clean('K1234567', { throwOnError: false })).toBeNull()
      expect(clean('1234K567', { throwOnError: false })).toBeNull()
      expect(clean('KK345678', { throwOnError: false })).toBeNull()
    })

    test('Returns null for non-string inputs', () => {
      expect(clean(123456789 as any, { throwOnError: false })).toBeNull()
      expect(clean(null as any, { throwOnError: false })).toBeNull()
      expect(clean(undefined as any, { throwOnError: false })).toBeNull()
    })

    test('Returns cleaned RUT when valid', () => {
      expect(clean('12.345.678-k', { throwOnError: false })).toBe('12345678K')
      expect(clean('9.068.826-K', { throwOnError: false })).toBe('9068826K')
    })
  })

  describe('basic cleaning', () => {
    test('Removes non-numeric characters except K, and converts to uppercase', () => {
      expect(clean('12.345.678-k')).toBe('12345678K')
      expect(clean('12.345.678-K')).toBe('12345678K')
    })

    test('Removes leading zeros', () => {
      expect(clean('0000012.345.678-K')).toBe('12345678K')
      expect(clean('00009.068.826-K')).toBe('9068826K')
      expect(clean('00000012345678K')).toBe('12345678K')
    })

    test('Keeps the RUT clean if it is already in the correct format', () => {
      expect(clean('123456789')).toBe('123456789')
      expect(clean('12345678K')).toBe('12345678K')
    })

    test('Removes white spaces', () => {
      expect(clean(' 12 345 6 78 - 9 ')).toBe('123456789')
      expect(clean('   12345678K   ')).toBe('12345678K')
    })

    test('Removes additional hyphens', () => {
      expect(clean('12-34-56-789')).toBe('123456789')
      expect(clean('12-345-678-K')).toBe('12345678K')
    })

    test('Removes special characters', () => {
      expect(clean('12#34%56&@78K')).toBe('12345678K')
      expect(clean('12.345.678@#$-K')).toBe('12345678K')
    })

    test('Cleans even if the RUT ends in invalid characters', () => {
      expect(clean('12345678#')).toBe('12345678')
      expect(clean('12345678K###')).toBe('12345678K')
    })
  })

  describe('error cases', () => {
    test('Throws error with empty string', () => {
      expect(() => clean('')).toThrow()
      expect(() => clean('   ')).toThrow()
    })

    test('Throws a generic error without echoing the RUT value', () => {
      expect(() => clean('123')).toThrow('Invalid RUT input')
      expect(() => clean('123')).not.toThrow(/123/)
    })

    test('Throws error with RUTs that are too long or too short', () => {
      expect(() => clean('1.2.34-K')).toThrow()
      expect(() => clean('12.345.6789012-3')).toThrow()
      expect(() => clean('1234567')).toThrow()
      expect(() => clean('12345678901')).toThrow()
    })

    test('Throws error with RUTs that have the letter K not at the end', () => {
      expect(() => clean('K1234567')).toThrow()
      expect(() => clean('1234K567')).toThrow()
      expect(() => clean('12K45678')).toThrow()
      expect(() => clean('1234567K')).not.toThrow()
      expect(() => clean('12345678K')).not.toThrow()
    })

    test('Throws error if only invalid characters are included', () => {
      expect(() => clean('####')).toThrow()
      expect(() => clean('abcdefgh')).toThrow()
      expect(() => clean('--------')).toThrow()
    })

    test('Throws error for multiple K letters', () => {
      expect(() => clean('1234567KK')).toThrow()
      expect(() => clean('KK345678')).toThrow()
    })
  })

  describe('edge cases', () => {
    test('Handles lowercase k correctly', () => {
      expect(clean('12345678k')).toBe('12345678K')
      expect(clean('9068826k')).toBe('9068826K')
    })

    test('Handles minimum length RUT (8 chars)', () => {
      expect(clean('9068826K')).toBe('9068826K')
      expect(clean('10000002')).toBe('10000002')
    })

    test('Handles maximum length RUT (9 chars)', () => {
      expect(clean('999999996')).toBe('999999996')
      expect(clean('189726317')).toBe('189726317')
    })

    test('Handles RUTs with only dots', () => {
      expect(clean('12.345.678.K')).toBe('12345678K')
    })

    test('Handles RUTs with parentheses', () => {
      expect(clean('(12.345.678-K)')).toBe('12345678K')
    })
  })
})
