import { validate, clean, format, calculateVerifier, getBody, decompose, generate, getVerifier } from '../src'

describe('RUT validation library tests', () => {
  describe('clean function', () => {
    test('should remove all non-numeric and non-K characters, and leading zeros', () => {
      expect(clean('18.972.631-7')).toBe('189726317')
      expect(clean('12.345.678-k')).toBe('12345678K')
      expect(clean('0000012.345.678-K')).toBe('12345678K')
    })

    test('should throw an error for invalid inputs', () => {
      expect(() => clean('invalid')).toThrow()
    })
  })

  describe('validate function', () => {
    test('should correctly validate RUTs', () => {
      expect(validate('9.015.074-K')).toBeTruthy()
      expect(validate('18.264.958-9')).toBeTruthy()
    })

    test('should reject invalid RUTs', () => {
      expect(validate('18.972.631-8')).toBeFalsy()
      expect(validate('invalid')).toBeFalsy()
      expect(validate('1.1.1-1')).toBeFalsy()
    })

    test('should reject suspicious RUTs when strict mode is enabled', () => {
      expect(validate('11.111.111-1', true)).toBeFalsy()
    })
  })

  describe('format function', () => {
    test('should correctly format RUTs with or without dots', () => {
      expect(format('189726317')).toBe('18.972.631-7')
      expect(format('189726317', false)).toBe('18972631-7')
    })
  })

  describe('calculateVerifier function', () => {
    test('should return the correct verifier digit for a given RUT body', () => {
      expect(calculateVerifier('18264958')).toBe('9')
      expect(calculateVerifier('18722009')).toBe('2')
    })
  })

  describe('getBody function', () => {
    test('should return the body of a RUT', () => {
      expect(getBody('18.972.631-7')).toBe('18972631')
    })
  })

  describe('getVerifier function', () => {
    test('should return the body of a RUT', () => {
      expect(getVerifier('23.579.222-2')).toBe('2')
    })
  })

  describe('decompose function', () => {
    test('should return the body and verifier of a RUT', () => {
      const result = decompose('18.972.631-7')
      expect(result).toEqual({ body: '18972631', verifier: '7' })
    })
  })

  describe('generate function', () => {
    test('should generate a valid RUT', () => {
      const generatedRUT = generate()
      expect(validate(generatedRUT)).toBeTruthy()
    })
  })
})
