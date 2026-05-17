import { calculateVerifier, decompose, format, generate, getBody, getVerifier, validate } from '../src'

describe('calculateVerifier', () => {
  describe('full Modulo-11 image (every possible output)', () => {
    // Smallest 8-digit body producing each of the 11 possible verifier outputs.
    // Computed from the canonical algorithm and pinned here so any future
    // refactor of the Modulo-11 hot path is caught immediately.
    test.each([
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
    ])('calculateVerifier(%p) === %p', (body, expected) => {
      expect(calculateVerifier(body)).toBe(expected)
    })
  })

  describe('input normalization', () => {
    test.each([
      ['18264958', '9', '8-digit body'],
      ['18722009', '2', '8-digit body'],
      ['12345678', '5', '8-digit body'],
      ['18972631', '7', '8-digit body'],
      ['24657622', 'K', '8-digit body, K output'],
      ['14625621', 'K', '8-digit body, K output'],
      ['18.264.958', '9', 'formatted with dots'],
      ['18-264-958', '9', 'with extra hyphens'],
      ['018972631', '7', 'leading-zero strip → 8-digit'],
      ['0018264958', '9', 'leading-zero strip → 8-digit'],
      ['10000000', '8', 'minimum 8-digit body'],
      ['99999999', '9', 'maximum 8-digit body'],
    ])('calculateVerifier(%p) === %p (%s)', (body, expected, _label) => {
      expect(calculateVerifier(body)).toBe(expected)
    })
  })

  describe('error mode', () => {
    test.each([[''], ['123'], ['12345'], ['12345678901'], ['abcdefgh'], ['12abc345678'], ['12#345#678']])(
      'throws for invalid input: %p',
      (input) => {
        expect(() => calculateVerifier(input)).toThrow('Invalid RUT input')
      },
    )

    test('throws when leading-zero strip leaves a body that is too short', () => {
      expect(() => calculateVerifier('0000000')).toThrow('Invalid RUT input')
      expect(() => calculateVerifier('000000')).toThrow('Invalid RUT input')
    })
  })

  describe('safe mode (throwOnError: false)', () => {
    test.each([
      [''],
      ['123'],
      ['12345'],
      ['12345678901'],
      ['12abc345678'],
      ['0000000'], // leading-zero strip leaves nothing — covers the body-length floor
    ])('returns null for invalid input: %p', (input) => {
      expect(calculateVerifier(input, { throwOnError: false })).toBeNull()
    })

    test.each([[12345678], [null], [undefined], [{}], [Symbol('rut')]])(
      'returns null for non-string input: %p',
      (value) => {
        expect(calculateVerifier(value as unknown as string, { throwOnError: false })).toBeNull()
      },
    )

    test.each([
      ['12345678', '5'],
      ['24657622', 'K'],
      ['18.264.958', '9'],
    ])('returns verifier for valid input: %p → %p', (body, expected) => {
      expect(calculateVerifier(body, { throwOnError: false })).toBe(expected)
    })
  })

  describe('cross-function consistency (property)', () => {
    // Strongest oracle: the math of `calculateVerifier` must agree with the
    // verifier carried inside any RUT that `generate()` produced. This catches
    // any divergence between the hot-path Modulo-11 sum and the rest of the
    // library without needing to enumerate inputs by hand.
    test('agrees with decompose+validate on 200 generated RUTs', () => {
      for (let i = 0; i < 200; i++) {
        const rut = generate()
        const { body, verifier } = decompose(rut)
        expect(calculateVerifier(body)).toBe(verifier)
        // Also verify that a body+computed-verifier still passes validate.
        expect(validate(body + calculateVerifier(body))).toBe(true)
      }
    })

    test('agrees with getBody + getVerifier on canonical inputs', () => {
      for (const rut of ['18.972.631-7', '9.068.826-K', '14.625.621-k', '99.999.999-9']) {
        const body = getBody(rut)
        const verifier = getVerifier(rut)
        expect(calculateVerifier(body)).toBe(verifier)
        // And the round-trip through format produces canonical form.
        expect(format(body + verifier)).toBe(format(rut))
      }
    })
  })
})
