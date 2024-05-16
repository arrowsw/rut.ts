import { getBody } from '../src'

describe('getBody function', () => {
  test('should return the body of a RUT', () => {
    expect(getBody('18.972.631-7')).toBe('18972631')
  })
})
