import { getBody } from '../src'

describe('getBody function', () => {
  describe('basic functionality', () => {
    test('should return the body of a RUT', () => {
      expect(getBody('18.972.631-7')).toBe('18972631')
    })

    test('extracts body from RUT with K verifier', () => {
      expect(getBody('9.068.826-K')).toBe('9068826')
      expect(getBody('14.625.621-k')).toBe('14625621')
    })

    test('extracts body from RUT without dots', () => {
      expect(getBody('18972631-7')).toBe('18972631')
      expect(getBody('9068826K')).toBe('9068826')
    })

    test('extracts body from RUT without hyphen', () => {
      expect(getBody('189726317')).toBe('18972631')
      expect(getBody('12345678K')).toBe('12345678')
    })
  })

  describe('various formats', () => {
    test('handles RUT with leading zeros', () => {
      expect(getBody('009.068.826-K')).toBe('9068826')
      expect(getBody('0018972631-7')).toBe('18972631')
    })

    test('handles RUT with extra characters', () => {
      expect(getBody('  18.972.631-7  ')).toBe('18972631')
      expect(getBody('(18.972.631-7)')).toBe('18972631')
    })

    test('handles RUT with all special characters removed', () => {
      expect(getBody('18#972#631-7')).toBe('18972631')
    })
  })

  describe('length variations', () => {
    test('extracts body from 8-digit RUT', () => {
      expect(getBody('9.068.826-K')).toBe('9068826')
      expect(getBody('1.000.000-2')).toBe('1000000')
    })

    test('extracts body from 9-digit RUT', () => {
      expect(getBody('18.972.631-7')).toBe('18972631')
      expect(getBody('99.999.999-6')).toBe('99999999')
    })
  })

  describe('error cases', () => {
    test('throws error for invalid RUT', () => {
      expect(() => getBody('123')).toThrow()
      expect(() => getBody('invalid')).toThrow()
      expect(() => getBody('')).toThrow()
    })

    test('throws error for too short RUT', () => {
      expect(() => getBody('1234567')).toThrow()
    })

    test('throws error for too long RUT', () => {
      expect(() => getBody('12345678901')).toThrow()
    })
  })

  describe('with throwOnError: false (safe mode)', () => {
    test('returns null for invalid RUT instead of throwing', () => {
      expect(getBody('123', { throwOnError: false })).toBeNull()
      expect(getBody('', { throwOnError: false })).toBeNull()
      expect(getBody('invalid', { throwOnError: false })).toBeNull()
    })

    test('returns null for non-string inputs', () => {
      expect(getBody(123456789 as any, { throwOnError: false })).toBeNull()
      expect(getBody(null as any, { throwOnError: false })).toBeNull()
    })

    test('returns body when valid', () => {
      expect(getBody('18.972.631-7', { throwOnError: false })).toBe('18972631')
      expect(getBody('9.068.826-K', { throwOnError: false })).toBe('9068826')
    })
  })

  describe('edge cases', () => {
    test('extracts body correctly when verifier is 0', () => {
      expect(getBody('18.264.159-0')).toBe('18264159')
    })

    test('handles minimum valid RUT', () => {
      expect(getBody('1.000.000-2')).toBe('1000000')
    })

    test('handles maximum valid RUT', () => {
      expect(getBody('99.999.999-6')).toBe('99999999')
    })

    test('body never contains K', () => {
      const body = getBody('9.068.826-K')
      expect(body).not.toContain('K')
      expect(body).not.toContain('k')
    })
  })
})
