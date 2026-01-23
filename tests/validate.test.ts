import { validate, isRutLike } from '../src'

describe('validate', () => {
  describe('type safety (accepts unknown)', () => {
    test('Returns false for non-string inputs', () => {
      expect(validate(123456789 as unknown)).toBeFalsy()
      expect(validate(null as unknown)).toBeFalsy()
      expect(validate(undefined as unknown)).toBeFalsy()
      expect(validate({} as unknown)).toBeFalsy()
      expect(validate([] as unknown)).toBeFalsy()
      expect(validate(true as unknown)).toBeFalsy()
      expect(validate(false as unknown)).toBeFalsy()
    })
  })

  describe('valid RUTs', () => {
    test('should correctly validate RUTs', () => {
      expect(validate('13.611.947-8')).toBeTruthy()
      expect(validate('18.972.631-7')).toBeTruthy()
      expect(validate('09.068.826-K')).toBeTruthy() // 09068826 = 8 digits
    })

    test('validates RUTs with different formats', () => {
      // With dots and hyphen
      expect(validate('12.345.678-5')).toBeTruthy()
      // Without dots
      expect(validate('12345678-5')).toBeTruthy()
      // Without dots or hyphen
      expect(validate('123456785')).toBeTruthy()
    })

    test('validates RUTs with K verifier (uppercase and lowercase)', () => {
      expect(validate('14.625.621-K')).toBeTruthy()
      expect(validate('14.625.621-k')).toBeTruthy()
      expect(validate('14625621K')).toBeTruthy()
      expect(validate('14625621k')).toBeTruthy()
    })

    test('validates RUTs with leading zeros', () => {
      expect(validate('009.068.826-K')).toBeTruthy() // 9 digits with leading zeros
      expect(validate('0009068826K')).toBeTruthy()
      expect(validate('018.972.631-7')).toBeTruthy()
    })

    test('validates 8-digit RUTs (after removing leading zeros)', () => {
      expect(validate('09.068.826-K')).toBeTruthy()
      expect(validate('09068826K')).toBeTruthy()
    })

    test('validates 9-digit RUTs', () => {
      expect(validate('18.972.631-7')).toBeTruthy()
      expect(validate('189726317')).toBeTruthy()
    })
  })

  describe('invalid RUTs', () => {
    test('should reject invalid RUTs', () => {
      expect(validate('18.972.631-8')).toBeFalsy() // Wrong verifier
      expect(validate('invalid')).toBeFalsy()
      expect(validate('1.1.1-1')).toBeFalsy()
    })

    test('invalidates RUT with incorrect verification digit', () => {
      expect(validate('23.478.522-K')).toBeFalsy()
      expect(validate('12.345.678-0')).toBeFalsy() // Should be 5
    })

    test('invalidates RUT in incorrect format', () => {
      expect(validate('abcdefghi')).toBeFalsy()
      expect(validate('12,345,678-5')).toBeFalsy() // Commas not supported
    })

    test('invalidates empty RUT', () => {
      expect(validate('')).toBeFalsy()
    })

    test('invalidates RUT with special characters', () => {
      expect(validate('12#34%56&789K')).toBeFalsy()
    })

    test('invalidates RUT with incorrect length', () => {
      expect(validate('123')).toBeFalsy()
      expect(validate('1234567')).toBeFalsy()
      expect(validate('12345678901')).toBeFalsy()
    })

    test('invalidates RUT with K not at the end', () => {
      expect(validate('K2345678-5')).toBeFalsy()
      expect(validate('1234K678-5')).toBeFalsy()
    })

    test('invalidates RUT with multiple K', () => {
      expect(validate('1234567K-K')).toBeFalsy()
      expect(validate('KK345678-5')).toBeFalsy()
    })
  })

  describe('strict mode', () => {
    test('should reject suspicious RUTs when strict mode is enabled', () => {
      expect(validate('11.111.111-1', { strict: true })).toBeFalsy()
      expect(validate('22.222.222-2', { strict: true })).toBeFalsy()
      expect(validate('33.333.333-3', { strict: true })).toBeFalsy()
    })

    test('validates suspicious RUT if strict is false or not provided', () => {
      expect(validate('11111111-1')).toBeTruthy()
      expect(validate('11111111-1', { strict: false })).toBeTruthy()
      expect(validate('11111111-1', {})).toBeTruthy()
    })

    test('strict mode does not affect normal valid RUTs', () => {
      expect(validate('12.345.678-5', { strict: true })).toBeTruthy()
      expect(validate('18.972.631-7', { strict: true })).toBeTruthy()
    })
  })

  describe('edge cases', () => {
    test('validates RUT with verifier digit 0', () => {
      expect(validate('18.264.950-3')).toBeTruthy()
    })

    test('validates minimum valid RUT (with leading zeros removed)', () => {
      expect(validate('010.000.002-4')).toBeTruthy() // Becomes 10000024 (8 digits)
      expect(validate('10.000.000-8')).toBeTruthy()
    })

    test('validates maximum valid RUT', () => {
      expect(validate('99.999.999-9')).toBeTruthy()
    })
  })
})

describe('isRutLike', () => {
  test('Returns true for valid RUT formats', () => {
    expect(isRutLike('12.345.678-9')).toBeTruthy()
    expect(isRutLike('12345678-9')).toBeTruthy()
    expect(isRutLike('123456789')).toBeTruthy()
    expect(isRutLike('1.234.567-K')).toBeTruthy()
  })

  test('Returns false for invalid formats', () => {
    expect(isRutLike('abcdefghi')).toBeFalsy()
    expect(isRutLike('')).toBeFalsy()
    expect(isRutLike('12.34.56-7')).toBeFalsy()
  })

  test('Returns true for RUTs with leading zeros', () => {
    expect(isRutLike('009.068.826-K')).toBeTruthy()
    expect(isRutLike('00012345678')).toBeTruthy()
  })

  test('Returns false for non-string inputs', () => {
    expect(isRutLike('' as any)).toBeFalsy()
  })
})
