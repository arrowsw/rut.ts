import { generate, validate } from '../src'

export const createArray = (length: number) => new Array(length).fill(0)

describe('generateAndValidateRUTs function', () => {
  test('should generate 999 valid RUTs', () => {
    // Crear un array de 999 elementos y transformar cada uno
    const results = createArray(999).map(() => {
      const generatedRUT = generate()
      const isValid = validate(generatedRUT)
      return { generated: generatedRUT, isValid }
    })

    // Verificar que cada RUT generado es válido
    results.forEach((result) => {
      expect(result.isValid).toBeTruthy()
    })
  })
})
