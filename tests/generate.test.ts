import { generate, validate, format, decompose } from '../src'

export const createArray = (length: number) => new Array(length).fill(0)

describe('generate function', () => {
  describe('basic generation', () => {
    test('generates a valid RUT', () => {
      const rut = generate()
      expect(validate(rut)).toBeTruthy()
    })

    test('generates a formatted RUT with dots and hyphen', () => {
      const rut = generate()
      expect(rut).toMatch(/^\d{1,2}\.\d{3}\.\d{3}-[\dK]$/)
    })

    test('generates RUT with correct structure', () => {
      const rut = generate()
      const decomposed = decompose(rut)
      expect(decomposed.body).toHaveLength(8) // Body is always 8 digits
      expect(decomposed.verifier).toHaveLength(1) // Verifier is always 1 char
    })
  })

  describe('validation of generated RUTs', () => {
    test('should generate 999 valid RUTs', () => {
      const results = createArray(999).map(() => {
        const generatedRUT = generate()
        const isValid = validate(generatedRUT)
        return { generated: generatedRUT, isValid }
      })

      results.forEach((result) => {
        expect(result.isValid).toBeTruthy()
      })
    })

    test('all generated RUTs pass strict validation', () => {
      const ruts = createArray(50).map(() => generate())
      ruts.forEach((rut) => {
        expect(validate(rut, { strict: true })).toBeTruthy()
      })
    })
  })

  describe('verifier digit variety', () => {
    test('generated RUTs can have different verifiers', () => {
      const ruts = createArray(100).map(() => generate())
      const verifiers = ruts.map((rut) => decompose(rut).verifier)
      const uniqueVerifiers = new Set(verifiers)

      // Should generate RUTs with at least 2 different verifiers in 100 attempts
      expect(uniqueVerifiers.size).toBeGreaterThan(1)
    })

    test('generated RUTs can have K as verifier', () => {
      // Generate many RUTs and check if at least one has K
      const ruts = createArray(200).map(() => generate())
      const hasK = ruts.some((rut) => decompose(rut).verifier === 'K')

      // Probability of getting at least one K in 200 RUTs is very high
      // (roughly 1/11 chance per RUT)
      expect(hasK).toBeTruthy()
    })
  })

  describe('format consistency', () => {
    test('generated RUTs are consistently formatted', () => {
      const ruts = createArray(10).map(() => generate())
      ruts.forEach((rut) => {
        // Check it's properly formatted
        expect(rut).toMatch(/^\d{1,2}\.\d{3}\.\d{3}-[\dK]$/)

        // Check it can be reformatted to same value
        const reformatted = format(rut)
        expect(reformatted).toBe(rut)
      })
    })
  })

  describe('randomness', () => {
    test('generates different RUTs', () => {
      const rut1 = generate()
      const rut2 = generate()
      const rut3 = generate()

      // Very unlikely to generate same RUT twice in a row
      expect(rut1).not.toBe(rut2)
      expect(rut2).not.toBe(rut3)
    })

    test('generates RUTs in realistic range', () => {
      const ruts = createArray(20).map(() => generate())
      ruts.forEach((rut) => {
        const { body } = decompose(rut)
        const bodyNum = parseInt(body, 10)

        // Generated RUTs should be in the range 10000000-99999999
        expect(bodyNum).toBeGreaterThanOrEqual(10000000)
        expect(bodyNum).toBeLessThanOrEqual(99999999)
      })
    })
  })

  describe('generated RUT properties', () => {
    test('generated RUT has valid length', () => {
      const rut = generate()
      // Format: XX.XXX.XXX-Y (13 chars) or X.XXX.XXX-Y (12 chars)
      expect(rut.length).toBeGreaterThanOrEqual(12)
      expect(rut.length).toBeLessThanOrEqual(13)
    })

    test('generated RUT body is always 8 digits', () => {
      const ruts = createArray(50).map(() => generate())
      ruts.forEach((rut) => {
        const { body } = decompose(rut)
        expect(body).toHaveLength(8)
        expect(/^\d{8}$/.test(body)).toBeTruthy()
      })
    })
  })
})
