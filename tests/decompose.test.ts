import { decompose } from '../src'

describe('decompose function', () => {
  describe('basic decomposition', () => {
    test('should return the body and verifier of a RUT', () => {
      expect(decompose('18.972.631-7')).toEqual({ body: '18972631', verifier: '7' })
    })

    test('decomposes RUT with K verifier', () => {
      expect(decompose('9.068.826-K')).toEqual({ body: '9068826', verifier: 'K' })
      expect(decompose('14.625.621-k')).toEqual({ body: '14625621', verifier: 'K' })
    })

    test('decomposes RUT without dots', () => {
      expect(decompose('18972631-7')).toEqual({ body: '18972631', verifier: '7' })
      expect(decompose('9068826K')).toEqual({ body: '9068826', verifier: 'K' })
    })

    test('decomposes RUT without hyphen', () => {
      expect(decompose('189726317')).toEqual({ body: '18972631', verifier: '7' })
      expect(decompose('12345678K')).toEqual({ body: '12345678', verifier: 'K' })
    })
  })

  describe('various formats', () => {
    test('handles RUT with leading zeros', () => {
      expect(decompose('009.068.826-K')).toEqual({ body: '9068826', verifier: 'K' })
      expect(decompose('0018972631-7')).toEqual({ body: '18972631', verifier: '7' })
    })

    test('handles RUT with extra characters', () => {
      expect(decompose('  18.972.631-7  ')).toEqual({ body: '18972631', verifier: '7' })
      expect(decompose('(18.972.631-7)')).toEqual({ body: '18972631', verifier: '7' })
    })
  })

  describe('verifier types', () => {
    test('decomposes RUT with numeric verifier', () => {
      expect(decompose('18.972.631-7')).toEqual({ body: '18972631', verifier: '7' })
      expect(decompose('18.264.159-0')).toEqual({ body: '18264159', verifier: '0' })
    })

    test('decomposes RUT with K verifier (uppercase and lowercase)', () => {
      expect(decompose('9.068.826-K')).toEqual({ body: '9068826', verifier: 'K' })
      expect(decompose('9.068.826-k')).toEqual({ body: '9068826', verifier: 'K' })
    })
  })

  describe('length variations', () => {
    test('decomposes 8-digit RUTs', () => {
      expect(decompose('9.068.826-K')).toEqual({ body: '9068826', verifier: 'K' })
    })

    test('decomposes 9-digit RUTs', () => {
      expect(decompose('18.972.631-7')).toEqual({ body: '18972631', verifier: '7' })
    })
  })

  describe('error cases', () => {
    test('throws error for invalid RUT', () => {
      expect(() => decompose('123')).toThrow()
      expect(() => decompose('invalid')).toThrow()
      expect(() => decompose('')).toThrow()
    })

    test('throws error for too short RUT', () => {
      expect(() => decompose('1234567')).toThrow()
      expect(() => decompose('1.234.567')).toThrow()
    })

    test('throws error for too long RUT', () => {
      expect(() => decompose('12345678901')).toThrow()
    })
  })

  describe('with throwOnError: false (safe mode)', () => {
    test('returns null for invalid RUT instead of throwing', () => {
      expect(decompose('123', { throwOnError: false })).toBeNull()
      expect(decompose('', { throwOnError: false })).toBeNull()
      expect(decompose('invalid', { throwOnError: false })).toBeNull()
    })

    test('returns null for non-string inputs', () => {
      expect(decompose(123456789 as any, { throwOnError: false })).toBeNull()
      expect(decompose(null as any, { throwOnError: false })).toBeNull()
    })

    test('returns decomposed RUT when valid', () => {
      expect(decompose('18.972.631-7', { throwOnError: false })).toEqual({ body: '18972631', verifier: '7' })
      expect(decompose('9.068.826-K', { throwOnError: false })).toEqual({ body: '9068826', verifier: 'K' })
    })
  })

  describe('edge cases', () => {
    test('preserves verifier 0', () => {
      expect(decompose('18.264.159-0')).toEqual({ body: '18264159', verifier: '0' })
    })

    test('handles minimum valid RUT', () => {
      expect(decompose('1.000.000-2')).toEqual({ body: '1000000', verifier: '2' })
    })

    test('handles maximum valid RUT', () => {
      expect(decompose('99.999.999-6')).toEqual({ body: '99999999', verifier: '6' })
    })
  })
})
