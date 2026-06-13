import { z } from 'zod'

import { rut, rutSchema } from '../src/zod'

/**
 * Tests for the optional `rut.ts/zod` subpath. The source imports `zod` (an
 * optional peer dependency, present here as a devDependency) and the core.
 */
describe('rut.ts/zod', () => {
  describe('rut (ready-to-use schema)', () => {
    test.each([
      ['123456785', '12.345.678-5'],
      ['12345678-5', '12.345.678-5'],
      ['12.345.678-5', '12.345.678-5'],
      ['  1234567-4  ', '1.234.567-4'],
    ])('parses %p and normalizes to %p', (input, expected) => {
      expect(rut.parse(input)).toBe(expected)
    })

    test.each([
      ['12.345.678-0', 'wrong verifier'],
      ['12.345.6785', 'dotted without hyphen'],
      ['nope', 'garbage'],
      ['', 'empty'],
    ])('rejects %p (%s)', (input) => {
      expect(rut.safeParse(input).success).toBe(false)
    })

    test('accepts suspicious placeholder RUTs (non-strict default)', () => {
      expect(rut.safeParse('11111111-1').success).toBe(true)
    })

    test('integrates inside a z.object and transforms the field', () => {
      const Form = z.object({ taxId: rut })
      expect(Form.parse({ taxId: '123456785' })).toEqual({ taxId: '12.345.678-5' })
    })
  })

  describe('rutSchema (factory)', () => {
    test('strict mode rejects suspicious RUTs', () => {
      expect(rutSchema({ strict: true }).safeParse('11111111-1').success).toBe(false)
      expect(rutSchema({ strict: true }).safeParse('12.345.678-5').success).toBe(true)
    })

    test('uses the default error message', () => {
      const result = rutSchema().safeParse('nope')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid RUT')
      }
    })

    test('surfaces a custom error message on failure', () => {
      const result = rutSchema({ message: 'RUT inválido' }).safeParse('nope')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('RUT inválido')
      }
    })

    test('the factory result behaves like the ready schema', () => {
      expect(rutSchema().parse('123456785')).toBe('12.345.678-5')
    })
  })
})
