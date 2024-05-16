import { clean } from '../src'

describe('Test Suite: clean', () => {
  test('Removes non-numeric characters except K, and converts to uppercase', () => {
    expect(clean('12.345.678-k')).toBe('12345678K')
  })

  test('Removes leading zeros', () => {
    expect(clean('0000012.345.678-K')).toBe('12345678K')
  })

  test('Throws error with empty string', () => {
    expect(() => clean('')).toThrow()
  })

  test('Keeps the RUT clean if it is already in the correct format', () => {
    expect(clean('123456789')).toBe('123456789')
  })

  test('Removes white spaces', () => {
    expect(clean(' 12 345 6 78 - 9 ')).toBe('123456789')
  })

  test('Removes additional hyphens', () => {
    expect(clean('12-34-56-789')).toBe('123456789')
  })

  test('Throws error with RUTs that are too long or too short', () => {
    expect(() => clean('1.2.34-K')).toThrow()
    expect(() => clean('12.345.6789012-3')).toThrow()
  })

  test('Removes special characters', () => {
    expect(clean('12#34%56&@78K')).toBe('12345678K')
  })

  test('Throws error with RUTs that have the letter K not at the end', () => {
    expect(() => clean('K1234567')).toThrow()
    expect(() => clean('1234K567')).toThrow()
    expect(() => clean('1234567K')).not.toThrow()
  })

  test('Throws error if only invalid characters are included', () => {
    expect(() => clean('####')).toThrow()
  })

  test('clean even if the RUT ends in invalid characters', () => {
    expect(clean('12345678#')).toBe('12345678')
  })
})
