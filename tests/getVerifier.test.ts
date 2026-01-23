import { getVerifier } from '../src'

describe('getVerifier function', () => {
  describe('basic functionality', () => {
    test('should return the verifier of a RUT', () => {
      expect(getVerifier('23.579.222-2')).toBe('2')
      expect(getVerifier('18.972.631-7')).toBe('7')
    })

    test('extracts K verifier (uppercase)', () => {
      expect(getVerifier('9.068.826-K')).toBe('K')
      expect(getVerifier('14.625.621-K')).toBe('K')
    })

    test('extracts k verifier and converts to uppercase', () => {
      expect(getVerifier('9.068.826-k')).toBe('K')
      expect(getVerifier('14.625.621-k')).toBe('K')
    })

    test('extracts verifier from RUT without dots', () => {
      expect(getVerifier('18972631-7')).toBe('7')
      expect(getVerifier('9068826K')).toBe('K')
    })

    test('extracts verifier from RUT without hyphen', () => {
      expect(getVerifier('189726317')).toBe('7')
      expect(getVerifier('12345678K')).toBe('K')
    })
  })

  describe('various formats', () => {
    test('handles RUT with leading zeros', () => {
      expect(getVerifier('009.068.826-K')).toBe('K')
      expect(getVerifier('0018972631-7')).toBe('7')
    })

    test('handles RUT with extra characters', () => {
      expect(getVerifier('  18.972.631-7  ')).toBe('7')
      expect(getVerifier('(18.972.631-7)')).toBe('7')
    })

    test('handles RUT with special characters', () => {
      expect(getVerifier('18#972#631-7')).toBe('7')
    })
  })

  describe('verifier digit variations', () => {
    test('extracts verifier digit 0', () => {
      expect(getVerifier('18.264.159-0')).toBe('0')
    })

    test('extracts all numeric verifiers (0-9)', () => {
      expect(getVerifier('18.264.159-0')).toBe('0')
      expect(getVerifier('11.111.111-1')).toBe('1')
      expect(getVerifier('23.579.222-2')).toBe('2')
      expect(getVerifier('18.972.631-7')).toBe('7')
      expect(getVerifier('18.264.958-9')).toBe('9')
    })

    test('extracts K verifier', () => {
      expect(getVerifier('9.068.826-K')).toBe('K')
    })
  })

  describe('length variations', () => {
    test('extracts verifier from 8-digit RUT', () => {
      expect(getVerifier('9.068.826-K')).toBe('K')
      expect(getVerifier('1.000.000-2')).toBe('2')
    })

    test('extracts verifier from 9-digit RUT', () => {
      expect(getVerifier('18.972.631-7')).toBe('7')
      expect(getVerifier('99.999.999-6')).toBe('6')
    })
  })

  describe('error cases', () => {
    test('throws error for invalid RUT', () => {
      expect(() => getVerifier('123')).toThrow()
      expect(() => getVerifier('invalid')).toThrow()
      expect(() => getVerifier('')).toThrow()
    })

    test('throws error for too short RUT', () => {
      expect(() => getVerifier('1234567')).toThrow()
    })

    test('throws error for too long RUT', () => {
      expect(() => getVerifier('12345678901')).toThrow()
    })
  })

  describe('with throwOnError: false (safe mode)', () => {
    test('returns null for invalid RUT instead of throwing', () => {
      expect(getVerifier('123', { throwOnError: false })).toBeNull()
      expect(getVerifier('', { throwOnError: false })).toBeNull()
      expect(getVerifier('invalid', { throwOnError: false })).toBeNull()
    })

    test('returns verifier when valid', () => {
      expect(getVerifier('23.579.222-2', { throwOnError: false })).toBe('2')
      expect(getVerifier('9.068.826-K', { throwOnError: false })).toBe('K')
    })
  })

  describe('edge cases', () => {
    test('verifier is always a single character', () => {
      expect(getVerifier('18.972.631-7')).toHaveLength(1)
      expect(getVerifier('9.068.826-K')).toHaveLength(1)
    })

    test('handles minimum valid RUT', () => {
      expect(getVerifier('1.000.000-2')).toBe('2')
    })

    test('handles maximum valid RUT', () => {
      expect(getVerifier('99.999.999-6')).toBe('6')
    })

    test('verifier is always uppercase for K', () => {
      expect(getVerifier('9.068.826-k')).toBe('K')
      expect(getVerifier('9068826k')).toBe('K')
      expect(getVerifier('9.068.826-K')).toBe('K')
    })
  })
})
