import { clean, decompose, getBody, getVerifier } from '../src'

/**
 * `decompose` is a thin composition: `{ body: getBody(rut), verifier: getVerifier(rut) }`.
 * Heavy parsing edge cases live in `clean.test.ts` / `getBody.test.ts` /
 * `getVerifier.test.ts`. This file covers only what is unique to `decompose`:
 *
 * 1. the returned object shape
 * 2. safe-mode null contract
 * 3. generic error message (no PII echoing)
 * 4. consistency with the underlying getBody / getVerifier wrappers
 */
describe('decompose', () => {
  describe('returned shape', () => {
    test.each([
      ['18.972.631-7', { body: '18972631', verifier: '7' }],
      ['9.068.826-K', { body: '9068826', verifier: 'K' }],
      ['14.625.621-k', { body: '14625621', verifier: 'K' }],
      ['18.264.159-0', { body: '18264159', verifier: '0' }],
    ])('decompose(%p) === %j', (rut, expected) => {
      expect(decompose(rut)).toEqual(expected)
    })
  })

  describe('safe mode (throwOnError: false)', () => {
    test.each([
      ['', 'empty'],
      ['123', 'too short'],
      ['invalid', 'non-numeric'],
    ])('returns null for invalid input: %p (%s)', (input, _label) => {
      expect(decompose(input, { throwOnError: false })).toBeNull()
    })

    test.each([[123456789], [null], [undefined], [{}]])('returns null for non-string input: %p', (value) => {
      expect(decompose(value as unknown as string, { throwOnError: false })).toBeNull()
    })

    test('returns the decomposed shape for valid input', () => {
      expect(decompose('18.972.631-7', { throwOnError: false })).toEqual({ body: '18972631', verifier: '7' })
    })
  })

  describe('error mode (default)', () => {
    test('throws a generic error with no PII echoed', () => {
      expect(() => decompose('not-a-rut')).toThrow('Invalid RUT input')
      expect(() => decompose('not-a-rut')).not.toThrow(/not-a-rut/)
    })

    test.each([[''], ['123'], ['12345678901']])('throws for invalid input: %p', (input) => {
      expect(() => decompose(input)).toThrow('Invalid RUT input')
    })
  })

  describe('consistency with getBody / getVerifier / clean (property)', () => {
    // If `decompose` ever drifts from its composition, this catches it.
    test.each(['18.972.631-7', '9.068.826-K', '14.625.621-k', '  18.972.631-7  ', '009.068.826-K'])(
      'decompose(%p).body === getBody(%p) and verifier === getVerifier(%p)',
      (rut) => {
        const d = decompose(rut)
        expect(d.body).toBe(getBody(rut))
        expect(d.verifier).toBe(getVerifier(rut))
        expect(d.body + d.verifier).toBe(clean(rut))
      },
    )
  })
})
