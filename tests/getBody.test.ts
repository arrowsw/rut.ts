import { calculateVerifier, clean, getBody, getVerifier } from '../src'

/**
 * `getBody` is `clean(rut)?.slice(0, -1)`. The matrix of parsing edge cases
 * lives in `clean.test.ts`. This file covers what is unique to `getBody`:
 *
 * 1. it returns the body (everything except the last char of clean output)
 * 2. it never returns a K in the result (K is always the verifier)
 * 3. safe-mode null contract
 * 4. generic error message
 * 5. consistency with clean() and getVerifier()
 */
describe('getBody', () => {
  describe('basic extraction', () => {
    test.each([
      ['18.972.631-7', '18972631'],
      ['9.068.826-K', '9068826'],
      ['14.625.621-k', '14625621'],
      ['189726317', '18972631'], // compact
      ['9068826K', '9068826'], // compact
      ['009.068.826-K', '9068826'], // leading zeros
      ['  18.972.631-7  ', '18972631'], // surrounding whitespace
      ['(18.972.631-7)', '18972631'], // permissive char strip
      ['18#972#631-7', '18972631'], // special chars stripped
      ['18.264.159-0', '18264159'], // verifier 0
      ['1.000.000-2', '1000000'], // minimum-length body
    ])('getBody(%p) === %p', (input, expected) => {
      expect(getBody(input)).toBe(expected)
    })
  })

  test('the returned body never contains K (K is always the verifier)', () => {
    for (const rut of ['9.068.826-K', '14.625.621-k', '9068826K', '14625621K']) {
      const body = getBody(rut)
      expect(body).not.toContain('K')
      expect(body).not.toContain('k')
    }
  })

  describe('safe mode (throwOnError: false)', () => {
    test.each([
      ['', 'empty'],
      ['123', 'too short'],
      ['invalid', 'non-numeric'],
    ])('returns null for invalid input: %p (%s)', (input, _label) => {
      expect(getBody(input, { throwOnError: false })).toBeNull()
    })

    test.each([[123456789], [null], [undefined], [{}]])('returns null for non-string input: %p', (value) => {
      expect(getBody(value as unknown as string, { throwOnError: false })).toBeNull()
    })

    test('returns the body for valid input', () => {
      expect(getBody('18.972.631-7', { throwOnError: false })).toBe('18972631')
      expect(getBody('9.068.826-K', { throwOnError: false })).toBe('9068826')
    })
  })

  describe('error mode (default)', () => {
    test('throws a generic error with no PII echoed', () => {
      expect(() => getBody('secret-rut')).toThrow('Invalid RUT input')
      expect(() => getBody('secret-rut')).not.toThrow(/secret/)
    })

    test.each([['1234567'], ['12345678901']])('throws for out-of-range length: %p', (input) => {
      expect(() => getBody(input)).toThrow('Invalid RUT input')
    })
  })

  describe('consistency with clean and getVerifier (property)', () => {
    test.each(['18.972.631-7', '9.068.826-K', '14.625.621-k', '009.068.826-K', ' 18972631-7 '])(
      'getBody(%p) + getVerifier(%p) === clean(%p)',
      (rut) => {
        expect(getBody(rut) + getVerifier(rut)).toBe(clean(rut))
      },
    )

    test('calculateVerifier(getBody(x)) reproduces the canonical verifier of x for valid x', () => {
      for (const rut of ['18.972.631-7', '9.068.826-K', '12.345.678-5', '99.999.999-9']) {
        expect(calculateVerifier(getBody(rut))).toBe(getVerifier(rut))
      }
    })
  })
})
