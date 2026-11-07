import { runInNewContext } from 'node:vm'

import { InvalidRutError, clean, format, getBody, getVerifier, decompose, calculateVerifier, mask } from '../src'

type RutModule = typeof import('../src')

// The registry key of the brand. Frozen: every version has to use this exact
// string, so it is asserted literally rather than imported.
const BRAND = Symbol.for('rut.ts/InvalidRutError')

// A second, independent evaluation of the library: its own `InvalidRutError`
// class, exactly like the ESM and CommonJS builds loaded side by side, or two
// installed versions. (The built files are checked in `dist.smoke.test.ts`.)
const loadSecondCopy = async (): Promise<RutModule> => {
  let copy: RutModule | undefined
  await jest.isolateModulesAsync(async () => {
    copy = await import('../src')
  })
  return copy!
}

const thrownBy = (fn: () => unknown): unknown => {
  try {
    fn()
  } catch (err) {
    return err
  }
  throw new Error('expected a throw')
}

describe('InvalidRutError', () => {
  describe('shape', () => {
    test('is an Error subclass with a stable code, name and generic message', () => {
      const err = new InvalidRutError()
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(InvalidRutError)
      expect(err.code).toBe('INVALID_RUT')
      expect(err.name).toBe('InvalidRutError')
      expect(err.message).toBe('Invalid RUT input')
    })

    test('can be matched structurally without string matching (the documented contract)', () => {
      const err = new InvalidRutError()
      // The whole point: consumers branch on instanceof / code, never on text.
      expect(err instanceof InvalidRutError).toBe(true)
      expect(err.code === 'INVALID_RUT').toBe(true)
    })
  })

  describe('thrown by every safe helper in default (throwing) mode', () => {
    const throwers: Array<[string, () => unknown]> = [
      ['clean', () => clean('not-a-rut')],
      ['format', () => format('not-a-rut')],
      ['getBody', () => getBody('not-a-rut')],
      ['getVerifier', () => getVerifier('not-a-rut')],
      ['decompose', () => decompose('not-a-rut')],
      ['calculateVerifier', () => calculateVerifier('xx')],
      ['mask', () => mask('not-a-rut')],
      ['format (wrong verifier)', () => format('12.345.678-9')],
    ]

    test.each(throwers)('%s throws an InvalidRutError', (_label, fn) => {
      expect(fn).toThrow(InvalidRutError)
    })

    test.each(throwers)('%s thrown error carries code INVALID_RUT and never echoes the input', (_label, fn) => {
      try {
        fn()
        throw new Error('expected a throw')
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidRutError)
        expect((err as InvalidRutError).code).toBe('INVALID_RUT')
        expect((err as Error).message).toBe('Invalid RUT input')
        expect((err as Error).message).not.toMatch(/not-a-rut|12345678/)
      }
    })
  })

  describe('instanceof across copies of the library', () => {
    let second: RutModule

    beforeAll(async () => {
      second = await loadSecondCopy()
    })

    test('the second copy really is a different class', () => {
      expect(second.InvalidRutError).not.toBe(InvalidRutError)
      const err = thrownBy(() => second.clean('not-a-rut'))
      // The plain prototype check says false: the brand does the work.
      expect(Function.prototype[Symbol.hasInstance].call(InvalidRutError, err)).toBe(false)
    })

    test('an error thrown by the other copy is instanceof this class, and vice versa', () => {
      expect(thrownBy(() => second.clean('not-a-rut')) instanceof InvalidRutError).toBe(true)
      expect(thrownBy(() => clean('not-a-rut')) instanceof second.InvalidRutError).toBe(true)
      expect(() => second.format('12.345.678-9')).toThrow(InvalidRutError)
    })

    test('err.code keeps working across copies too', () => {
      expect((thrownBy(() => second.mask('not-a-rut')) as { code?: unknown }).code).toBe('INVALID_RUT')
    })

    test('the same copy still matches, as before', () => {
      expect(new InvalidRutError() instanceof InvalidRutError).toBe(true)
      expect(thrownBy(() => decompose('not-a-rut')) instanceof InvalidRutError).toBe(true)
      expect(new InvalidRutError() instanceof Error).toBe(true)
    })

    test('an error built in another realm matches too', () => {
      // `instanceof Error` is false across realms; the brand is shared through
      // the global symbol registry, so the check still holds.
      const foreign = runInNewContext(
        `const e = new Error('Invalid RUT input');
         Object.defineProperty(e, Symbol.for('rut.ts/InvalidRutError'), { value: true });
         e`,
      )
      expect(foreign instanceof Error).toBe(false)
      expect(foreign instanceof InvalidRutError).toBe(true)
    })
  })

  describe('what does not count as an InvalidRutError', () => {
    test.each<[string, unknown]>([
      ['a plain Error', new Error('Invalid RUT input')],
      [
        'an Error with the same name and code',
        Object.assign(new Error('Invalid RUT input'), {
          name: 'InvalidRutError',
          code: 'INVALID_RUT',
        }),
      ],
      ['a plain object with the same code', { code: 'INVALID_RUT', name: 'InvalidRutError' }],
      ['a spread copy of a real one', { ...new InvalidRutError() }],
      ['an Error with the fields of a real one copied in', Object.assign(new Error(), new InvalidRutError())],
      ['an empty object', {}],
      ['a string', 'Invalid RUT input'],
      ['a number', 42],
      ['null', null],
      ['undefined', undefined],
      ['a brand that is not exactly true', { [BRAND]: 'yes' }],
    ])('%s', (_label, value) => {
      expect(value instanceof InvalidRutError).toBe(false)
    })

    test('a structured clone keeps neither the brand nor the code (unchanged)', () => {
      const clone = structuredClone(new InvalidRutError()) as Error & { code?: unknown }
      expect(clone instanceof InvalidRutError).toBe(false)
      expect(clone.code).toBeUndefined()
    })
  })

  describe('the brand', () => {
    test('uses the frozen registry key rut.ts/InvalidRutError', () => {
      const symbols = Object.getOwnPropertySymbols(new InvalidRutError())
      expect(symbols.map((s) => Symbol.keyFor(s))).toEqual(['rut.ts/InvalidRutError'])
    })

    test('is a non-enumerable, read-only own property', () => {
      expect(Object.getOwnPropertyDescriptor(new InvalidRutError(), BRAND)).toEqual({
        value: true,
        writable: false,
        enumerable: false,
        configurable: false,
      })
    })

    test('stays out of Object.keys, JSON, for...in and Object.prototype.toString', () => {
      const err = new InvalidRutError()
      expect(Object.keys(err)).toEqual(['code', 'name'])
      expect(JSON.stringify(err)).toBe('{"code":"INVALID_RUT","name":"InvalidRutError"}')
      const keys: string[] = []
      for (const key in err) keys.push(key)
      expect(keys).toEqual(['code', 'name'])
      expect(Object.prototype.toString.call(err)).toBe('[object Error]')
    })

    test('documented limit: it is not a security check, anyone can set it', () => {
      // Same as today's `Object.create(InvalidRutError.prototype)`. instanceof
      // was never proof of origin; it answers "is this the library's error?".
      expect({ [BRAND]: true } instanceof InvalidRutError).toBe(true)
      expect(Object.create(InvalidRutError.prototype) instanceof InvalidRutError).toBe(true)
    })
  })

  describe('subclasses', () => {
    class AppRutError extends InvalidRutError {}

    test('a subclass instance is an InvalidRutError and an instance of the subclass', () => {
      const err = new AppRutError()
      expect(err instanceof InvalidRutError).toBe(true)
      expect(err instanceof AppRutError).toBe(true)
      expect(err.code).toBe('INVALID_RUT')
    })

    test('the brand does not make a base error look like a subclass', async () => {
      const second = await loadSecondCopy()
      expect(new InvalidRutError() instanceof AppRutError).toBe(false)
      expect(thrownBy(() => second.clean('not-a-rut')) instanceof AppRutError).toBe(false)
      expect({ [BRAND]: true } instanceof AppRutError).toBe(false)
    })
  })
})
