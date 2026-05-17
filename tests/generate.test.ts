import { generate, validate, format, decompose } from '../src'

const createArray = (length: number) => new Array(length).fill(0)

describe('generate', () => {
  describe('shape and structure', () => {
    test('emits a single canonical formatted RUT', () => {
      const rut = generate()
      expect(rut).toMatch(/^\d{1,2}\.\d{3}\.\d{3}-[\dK]$/)
      expect(rut.length).toBeGreaterThanOrEqual(12)
      expect(rut.length).toBeLessThanOrEqual(13)
    })

    test('body is always 8 digits (per MIN_GENERATED_BODY..MAX_GENERATED_BODY)', () => {
      for (const rut of createArray(50).map(() => generate())) {
        const { body, verifier } = decompose(rut)
        expect(body).toHaveLength(8)
        expect(verifier).toHaveLength(1)
        expect(/^\d{8}$/.test(body)).toBe(true)
        const n = parseInt(body, 10)
        expect(n).toBeGreaterThanOrEqual(10_000_000)
        expect(n).toBeLessThanOrEqual(99_999_999)
      }
    })
  })

  describe('validity (Monte Carlo)', () => {
    test('999 generated RUTs all pass validate (regression for v4-fixed range bug)', () => {
      for (const rut of createArray(999).map(() => generate())) {
        expect(validate(rut)).toBe(true)
      }
    })

    test('100 generated RUTs all pass strict validate (regression for v4-fixed suspicious body)', () => {
      // v3 could emit all-same-digit bodies (e.g. 11.111.111-1) which strict
      // mode rejects. v4 retries until a non-suspicious body is drawn.
      for (const rut of createArray(100).map(() => generate())) {
        expect(validate(rut, { strict: true })).toBe(true)
        const { body } = decompose(rut)
        expect(/^(\d)\1*$/.test(body)).toBe(false)
      }
    })

    test('round-trips through format() unchanged (consistent canonical form)', () => {
      for (const rut of createArray(20).map(() => generate())) {
        expect(format(rut)).toBe(rut)
      }
    })
  })

  describe('randomness', () => {
    test('does not emit the same RUT twice consecutively', () => {
      const [a, b, c] = [generate(), generate(), generate()]
      expect(a).not.toBe(b)
      expect(b).not.toBe(c)
    })

    test('verifier distribution covers more than one digit value', () => {
      // P(all 200 share the same verifier) ≈ 11 × (1/11)^200 ≈ 10^-208 → effectively zero.
      const verifiers = new Set(createArray(200).map(() => decompose(generate()).verifier))
      expect(verifiers.size).toBeGreaterThan(1)
    })

    test('verifier K appears within a reasonable sample (≈1/11 per draw)', () => {
      // P(no K in 200) ≈ (10/11)^200 ≈ 5×10^-9. Stable in practice.
      const hasK = createArray(200)
        .map(() => generate())
        .some((rut) => decompose(rut).verifier === 'K')
      expect(hasK).toBe(true)
    })
  })

  describe('CSPRNG fallback branch (Math.random when Web Crypto unavailable)', () => {
    // The v4 generator uses Web Crypto with unbiased rejection sampling when
    // `globalThis.crypto.getRandomValues` is available, and falls back to
    // `Math.random()` on older runtimes. Under Node test runs the crypto path
    // is always taken; this block shadows `globalThis.crypto` so the fallback
    // branch is exercised explicitly.
    let originalCryptoDescriptor: PropertyDescriptor | undefined

    beforeAll(() => {
      originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
      // Use `undefined` so the `cryptoSource?.getRandomValues` short-circuit
      // selects the Math.random branch deterministically.
      Object.defineProperty(globalThis, 'crypto', {
        value: undefined,
        configurable: true,
        writable: true,
      })
    })

    afterAll(() => {
      if (originalCryptoDescriptor) {
        Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor)
      } else {
        // Restore by deletion if the property did not exist before.
        delete (globalThis as unknown as { crypto?: unknown }).crypto
      }
    })

    test('falls back to Math.random and still produces valid RUTs', () => {
      expect(globalThis.crypto).toBeUndefined()
      for (const rut of createArray(100).map(() => generate())) {
        expect(validate(rut, { strict: true })).toBe(true)
      }
    })
  })
})
