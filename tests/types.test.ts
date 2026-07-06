import { expectTypeOf } from 'expect-type'

import {
  calculateVerifier,
  clean,
  decompose,
  equals,
  format,
  generate,
  getBody,
  getVerifier,
  InvalidRutError,
  isRutLike,
  isValidRut,
  mask,
  validate,
} from '../src'
import type {
  DecomposedRut,
  EqualsOptions,
  FormatOptions,
  Rut,
  SafeOptions,
  ValidateOptions,
  VerifierDigit,
} from '../src'

/**
 * Type-level regression tests for the v4 overload contract.
 *
 * The library overloads every safe-mode helper so that:
 *
 *   fn(input)                              → non-nullable result (may throw)
 *   fn(input, { throwOnError: false })     → nullable result (returns null)
 *   fn(input, { throwOnError: true  })     → non-nullable result (may throw)
 *   fn(input, options?: SafeOptions)       → nullable (the catch-all fallback)
 *
 * Without these tests, a future refactor of the overload signatures could
 * silently widen a return type to `T | null` (or narrow it) without any
 * runtime failure, breaking downstream type ergonomics.
 *
 * The assertions are wrapped in functions that ts-jest type-checks at compile
 * time but never invokes — so the same `expectTypeOf(fn(arg))` form works
 * regardless of whether `arg` would be a valid RUT at runtime.
 */

const _typecheck = () => {
  // ── clean ──────────────────────────────────────────────────────────────
  expectTypeOf(clean('x')).toEqualTypeOf<string>()
  expectTypeOf(clean('x', { throwOnError: false })).toEqualTypeOf<string | null>()
  expectTypeOf(clean('x', { throwOnError: true })).toEqualTypeOf<string>()
  // The catch-all (options?: SafeOptions) signature is necessarily nullable.
  const safeOpts: SafeOptions | undefined = undefined
  expectTypeOf(clean('x', safeOpts)).toEqualTypeOf<string | null>()

  // ── getBody ────────────────────────────────────────────────────────────
  expectTypeOf(getBody('x')).toEqualTypeOf<string>()
  expectTypeOf(getBody('x', { throwOnError: false })).toEqualTypeOf<string | null>()
  expectTypeOf(getBody('x', { throwOnError: true })).toEqualTypeOf<string>()

  // ── getVerifier (returns the narrow VerifierDigit union) ───────────────
  expectTypeOf(getVerifier('x')).toEqualTypeOf<VerifierDigit>()
  expectTypeOf(getVerifier('x', { throwOnError: false })).toEqualTypeOf<VerifierDigit | null>()
  expectTypeOf(getVerifier('x', { throwOnError: true })).toEqualTypeOf<VerifierDigit>()

  // ── decompose (returns the DecomposedRut shape) ────────────────────────
  expectTypeOf(decompose('x')).toEqualTypeOf<DecomposedRut>()
  expectTypeOf(decompose('x', { throwOnError: false })).toEqualTypeOf<DecomposedRut | null>()
  expectTypeOf(decompose('x', { throwOnError: true })).toEqualTypeOf<DecomposedRut>()

  // ── calculateVerifier ──────────────────────────────────────────────────
  expectTypeOf(calculateVerifier('x')).toEqualTypeOf<VerifierDigit>()
  expectTypeOf(calculateVerifier('x', { throwOnError: false })).toEqualTypeOf<VerifierDigit | null>()
  expectTypeOf(calculateVerifier('x', { throwOnError: true })).toEqualTypeOf<VerifierDigit>()

  // ── format (incremental mode still returns string) ─────────────────────
  expectTypeOf(format('x')).toEqualTypeOf<string>()
  expectTypeOf(format('x', { dots: false })).toEqualTypeOf<string>()
  expectTypeOf(format('x', { incremental: true })).toEqualTypeOf<string>()
  expectTypeOf(format('x', { incremental: true, dots: false })).toEqualTypeOf<string>()
  expectTypeOf(format('x', { throwOnError: false })).toEqualTypeOf<string | null>()
  expectTypeOf(format('x', { throwOnError: true })).toEqualTypeOf<string>()
  expectTypeOf(format('x', { incremental: true, throwOnError: false })).toEqualTypeOf<string | null>()

  // ── validate / isRutLike (predicates over unknown) ─────────────────────
  expectTypeOf(validate('x')).toEqualTypeOf<boolean>()
  expectTypeOf(validate('x', { strict: true })).toEqualTypeOf<boolean>()
  expectTypeOf(validate(123 as unknown)).toEqualTypeOf<boolean>()
  expectTypeOf(isRutLike('x')).toEqualTypeOf<boolean>()
  expectTypeOf(isRutLike(null as unknown)).toEqualTypeOf<boolean>()

  // ── generate (count → array overload) ──────────────────────────────────
  expectTypeOf(generate()).toEqualTypeOf<string>()
  expectTypeOf(generate({ format: 'compact' })).toEqualTypeOf<string>()
  expectTypeOf(generate({ bodyLength: 7 })).toEqualTypeOf<string>()
  expectTypeOf(generate({ count: 3 })).toEqualTypeOf<string[]>()
  expectTypeOf(generate({ count: 3, format: 'hyphen', bodyLength: 7 })).toEqualTypeOf<string[]>()

  // ── isValidRut (type guard narrows unknown → Rut) ──────────────────────
  expectTypeOf(isValidRut('x')).toEqualTypeOf<boolean>()
  const maybeRut: unknown = '12.345.678-5'
  if (isValidRut(maybeRut)) {
    expectTypeOf(maybeRut).toEqualTypeOf<Rut>()
  }
  // A branded Rut is still a string.
  expectTypeOf<Rut>().toExtend<string>()

  // ── mask (same throwOnError overloads as clean) ────────────────────────
  expectTypeOf(mask('x')).toEqualTypeOf<string>()
  expectTypeOf(mask('x', { throwOnError: false })).toEqualTypeOf<string | null>()
  expectTypeOf(mask('x', { throwOnError: true })).toEqualTypeOf<string>()

  // ── equals (predicate over unknown, with options) ──────────────────────
  expectTypeOf(equals('a', 'b')).toEqualTypeOf<boolean>()
  expectTypeOf(equals(1 as unknown, 2 as unknown)).toEqualTypeOf<boolean>()
  expectTypeOf(equals('a', 'b', { requireValid: false })).toEqualTypeOf<boolean>()
  expectTypeOf<EqualsOptions>().toMatchObjectType<{ requireValid?: boolean }>()

  // ── InvalidRutError (typed Error subclass with a literal code) ─────────
  expectTypeOf(new InvalidRutError()).toExtend<Error>()
  expectTypeOf(new InvalidRutError().code).toEqualTypeOf<'INVALID_RUT'>()
  expectTypeOf(new InvalidRutError().message).toEqualTypeOf<string>()

  // ── exported option types stay object-shaped ───────────────────────────
  expectTypeOf<FormatOptions>().toMatchObjectType<{
    incremental?: boolean
    dots?: boolean
    throwOnError?: boolean
  }>()
  expectTypeOf<ValidateOptions>().toMatchObjectType<{ strict?: boolean }>()
  expectTypeOf<SafeOptions>().toMatchObjectType<{ throwOnError?: boolean }>()
  expectTypeOf<DecomposedRut>().toMatchObjectType<{ body: string; verifier: VerifierDigit }>()

  // ── VerifierDigit is the closed union ──────────────────────────────────
  expectTypeOf<VerifierDigit>().toEqualTypeOf<'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'K'>()
}

describe('type-level overloads', () => {
  // Single runtime test whose only job is to keep this file as a valid Jest
  // suite. The real assertions are above and are checked at compile time by
  // ts-jest. If any overload signature regresses, the file fails to compile
  // — which surfaces as a Jest "suite failed to run" error.
  test('overload assertions compile (see _typecheck above)', () => {
    expect(typeof _typecheck).toBe('function')
  })
})
