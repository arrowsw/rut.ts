import { calculateVerifier, clean, getBody, getVerifier } from '../src'

/**
 * `getVerifier` is `clean(rut)?.slice(-1)`. Parsing edge cases are covered
 * by `clean.test.ts`. This file covers what is unique to `getVerifier`:
 *
 * 1. it returns a single character of type VerifierDigit ('0'..'9' | 'K')
 * 2. lowercase k is normalized to uppercase K
 * 3. the full 0..9, K image is reachable via real RUTs
 * 4. safe-mode null contract
 * 5. generic error message
 */
describe('getVerifier', () => {
  describe('basic extraction', () => {
    test.each([
      ['23.579.222-2', '2'],
      ['18.972.631-7', '7'],
      ['9.068.826-K', 'K'],
      ['14.625.621-K', 'K'],
      ['18972631-7', '7'],
      ['189726317', '7'],
      ['009.068.826-K', 'K'],
      ['  18.972.631-7  ', '7'],
      ['(18.972.631-7)', '7'],
      ['18#972#631-7', '7'],
    ])('getVerifier(%p) === %p', (input, expected) => {
      expect(getVerifier(input)).toBe(expected)
    })
  })

  describe('case normalization', () => {
    test.each([
      ['9.068.826-k', 'K'],
      ['14.625.621-k', 'K'],
      ['9068826k', 'K'],
      ['9.068.826-K', 'K'],
    ])('lowercase k is uppercased: %p → %p', (input, expected) => {
      expect(getVerifier(input)).toBe(expected)
    })
  })

  describe('full image (every possible verifier output)', () => {
    // For each of the 11 possible outputs, take the smallest 8-digit body
    // whose Modulo-11 verifier is that output, and verify that getVerifier
    // returns it on the compact body+DV string.
    const cases: Array<[string, string]> = [
      ['10000004', '0'],
      ['10000009', '1'],
      ['10000003', '2'],
      ['10000008', '3'],
      ['10000002', '4'],
      ['10000007', '5'],
      ['10000001', '6'],
      ['10000006', '7'],
      ['10000000', '8'],
      ['10000005', '9'],
      ['10000013', 'K'],
    ]
    test.each(cases)('extracts verifier %2$p from compact RUT (body %1$s)', (body, dv) => {
      expect(getVerifier(body + dv)).toBe(dv)
    })
  })

  test('return value is always exactly one character', () => {
    for (const rut of ['18.972.631-7', '9.068.826-K', '14.625.621-k', '99.999.999-9']) {
      expect(getVerifier(rut)).toHaveLength(1)
    }
  })

  describe('safe mode (throwOnError: false)', () => {
    test.each([
      ['', 'empty'],
      ['123', 'too short'],
      ['invalid', 'non-numeric'],
    ])('returns null for invalid input: %p (%s)', (input, _label) => {
      expect(getVerifier(input, { throwOnError: false })).toBeNull()
    })

    test.each([[123456789], [null], [undefined], [{}]])('returns null for non-string input: %p', (value) => {
      expect(getVerifier(value as unknown as string, { throwOnError: false })).toBeNull()
    })

    test('returns the verifier for valid input', () => {
      expect(getVerifier('23.579.222-2', { throwOnError: false })).toBe('2')
      expect(getVerifier('9.068.826-K', { throwOnError: false })).toBe('K')
    })
  })

  describe('error mode (default)', () => {
    test('throws a generic error with no PII echoed', () => {
      expect(() => getVerifier('secret-rut')).toThrow('Invalid RUT input')
      expect(() => getVerifier('secret-rut')).not.toThrow(/secret/)
    })

    test.each([['1234567'], ['12345678901']])('throws for out-of-range length: %p', (input) => {
      expect(() => getVerifier(input)).toThrow('Invalid RUT input')
    })
  })

  describe('consistency with clean and getBody (property)', () => {
    test.each(['18.972.631-7', '9.068.826-K', '14.625.621-k', '009.068.826-K'])(
      'clean(%p).endsWith(getVerifier(%p))',
      (rut) => {
        const c = clean(rut)
        const v = getVerifier(rut)
        expect(c.endsWith(v)).toBe(true)
        // And the digit value must match what calculateVerifier computes for the body.
        expect(calculateVerifier(getBody(rut))).toBe(v)
      },
    )
  })
})
