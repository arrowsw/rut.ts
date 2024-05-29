import { format } from '../src'

describe('format', () => {
  test('should correctly format RUTs with or without dots', () => {
    expect(format('189726317')).toBe('18.972.631-7')
    expect(format('189726317', { dots: false })).toBe('18972631-7')
  })

  test('Correctly formats with dots and hyphen', () => {
    expect(format('123456789')).toBe('12.345.678-9')
  })

  test('Correctly formats without dots', () => {
    expect(format('123456789', { dots: false })).toBe('12345678-9')
  })

  test('Returns empty string if input is empty', () => {
    expect(format('')).toBe('')
  })

  test('Correctly handles RUTs with K as verification digit', () => {
    expect(format('1234567K')).toBe('1.234.567-K')
  })

  test('Correctly formats RUTs with leading zeros', () => {
    expect(format('012345678')).toBe('1.234.567-8')
  })

  test('Correctly handles RUTs with non-numeric characters', () => {
    expect(format('12.345.678-k')).toBe('12.345.678-K')
  })

  test('Correctly handles RUTs with white spaces', () => {
    expect(format(' 123 456 789 ')).toBe('12.345.678-9')
  })
})
