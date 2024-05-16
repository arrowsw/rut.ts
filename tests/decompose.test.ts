import { decompose } from '../src'

describe('decompose function', () => {
  test('should return the body and verifier of a RUT', () => {
    expect(decompose('18.972.631-7')).toEqual({ body: '18972631', verifier: '7' })
  })
})
