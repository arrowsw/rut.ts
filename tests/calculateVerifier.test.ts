import { calculateVerifier } from '../src'

describe('calculateVerifier', () => {
  describe('correct verifier calculations', () => {
    test('should return the correct verifier digit for a given RUT body', () => {
      expect(calculateVerifier('18264958')).toBe('9')
      expect(calculateVerifier('18722009')).toBe('2')
      expect(calculateVerifier('12345678')).toBe('5')
    })

    test('correctly calculates when verifier is K', () => {
      expect(calculateVerifier('24657622')).toBe('K')
      expect(calculateVerifier('14625621')).toBe('K')
    })

    test('correctly calculates verifier for 8-digit bodies', () => {
      expect(calculateVerifier('18264958')).toBe('9')
      expect(calculateVerifier('10000000')).toBe('8')
      expect(calculateVerifier('18972631')).toBe('7')
    })

    test('handles formatted input (dots and hyphens are removed)', () => {
      expect(calculateVerifier('18.264.958')).toBe('9')
      expect(calculateVerifier('18-264-958')).toBe('9')
    })

    test('handles leading zeros (that result in 8-digit body after cleaning)', () => {
      expect(calculateVerifier('018972631')).toBe('7') // Becomes 18972631 (8 digits)
      expect(calculateVerifier('0018264958')).toBe('9') // Becomes 18264958 (8 digits)
    })
  })

  describe('verifier digit range', () => {
    test('verifier can be any digit from 0-9', () => {
      expect(calculateVerifier('11111111')).toBe('1')
      expect(calculateVerifier('18722009')).toBe('2')
      expect(calculateVerifier('14745562')).toBe('3')
      expect(calculateVerifier('23579222')).toBe('2')
      expect(calculateVerifier('12345678')).toBe('5')
    })

    test('verifier can be K (10)', () => {
      expect(calculateVerifier('24657622')).toBe('K')
      expect(calculateVerifier('14625621')).toBe('K')
    })
  })

  describe('error cases', () => {
    test('throws error with empty string', () => {
      expect(() => calculateVerifier('')).toThrow()
    })

    test('throws error with too short body', () => {
      expect(() => calculateVerifier('123')).toThrow()
      expect(() => calculateVerifier('12345')).toThrow()
    })

    test('throws error with too long body', () => {
      expect(() => calculateVerifier('12345678901')).toThrow()
    })

    test('throws error with non-numeric characters', () => {
      expect(() => calculateVerifier('abcdefgh')).toThrow()
    })
  })

  describe('with throwOnError: false (safe mode)', () => {
    test('returns null for empty string instead of throwing', () => {
      expect(calculateVerifier('', { throwOnError: false })).toBeNull()
    })

    test('returns null for invalid RUT body', () => {
      expect(calculateVerifier('123', { throwOnError: false })).toBeNull()
      expect(calculateVerifier('12345', { throwOnError: false })).toBeNull()
      expect(calculateVerifier('12345678901', { throwOnError: false })).toBeNull()
    })

    test('returns verifier when valid', () => {
      expect(calculateVerifier('12345678', { throwOnError: false })).toBe('5')
      expect(calculateVerifier('24657622', { throwOnError: false })).toBe('K')
    })

    test('handles formatted input in safe mode', () => {
      expect(calculateVerifier('18.264.958', { throwOnError: false })).toBe('9')
    })
  })

  describe('edge cases', () => {
    test('handles leading zeros (resulting in 8-digit body)', () => {
      expect(calculateVerifier('018972631')).toBe('7')
      expect(calculateVerifier('0018264958')).toBe('9')
    })

    test('handles minimum valid body (8 digits)', () => {
      expect(calculateVerifier('10000000')).toBe('8')
      expect(calculateVerifier('10000002')).toBe('4')
    })

    test('handles maximum valid body (8 digits)', () => {
      expect(calculateVerifier('99999999')).toBe('9')
    })

    test('verifier algorithm is deterministic', () => {
      const body = '12345678'
      const verifier1 = calculateVerifier(body)
      const verifier2 = calculateVerifier(body)
      expect(verifier1).toBe(verifier2)
    })
  })
})
