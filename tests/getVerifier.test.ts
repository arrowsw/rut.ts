import { getVerifier } from '../src'

describe('getVerifier function', () => {
  test('should return the body of a RUT', () => {
    expect(getVerifier('23.579.222-2')).toBe('2')
  })
})
