import { calculateVerifier } from '../src'

describe('calculateVerifier', () => {
  test('should return the correct verifier digit for a given RUT body', () => {
    expect(calculateVerifier('18264958')).toBe('9')
    expect(calculateVerifier('18722009')).toBe('2')
  })
  test('Correctly calculates the verification digit', () => {
    expect(calculateVerifier('12345678')).toBe('5')
  })

  test('Correctly calculates the verification digit when it is K', () => {
    expect(calculateVerifier('24657622')).toBe('K')
  })

  test('Throws error with empty string', () => {
    expect(() => calculateVerifier('')).toThrow()
  })
})
