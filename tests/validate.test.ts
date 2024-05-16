import { validate } from '../src'

describe('validate', () => {
  test('should correctly validate RUTs', () => {
    expect(validate('13.611.947-8')).toBeTruthy()
  })

  test('should reject invalid RUTs', () => {
    expect(validate('18.972.631-8')).toBeFalsy()
    expect(validate('invalid')).toBeFalsy()
    expect(validate('1.1.1-1')).toBeFalsy()
  })

  test('should reject suspicious RUTs when strict mode is enabled', () => {
    expect(validate('11.111.111-1', true)).toBeFalsy()
  })

  test('Invalidates RUT with incorrect verification digit', () => {
    expect(validate('23.478.522-K')).toBeFalsy()
  })

  test('Invalidates RUT in incorrect format', () => {
    expect(validate('abcdefghi')).toBeFalsy()
  })

  test('Validates suspicious RUT if strict is false', () => {
    expect(validate('11111111-1')).toBeTruthy()
  })

  test('Invalidates empty RUT', () => {
    expect(validate('')).toBeFalsy()
  })

  test('Invalidates RUT with special characters', () => {
    expect(validate('12#34%56&789K')).toBeFalsy()
  })

  test('Validates RUT with K as verification digit', () => {
    expect(validate('14.625.621-K')).toBeTruthy()
  })

  test('Invalidates RUT with incorrect length', () => {
    expect(() => validate('123')).toThrow()
  })
})
