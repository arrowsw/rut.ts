import { z } from 'zod'

import { validate, format, type ValidateOptions } from './index'

/**
 * Optional `rut.ts/zod` integration. Import from the `rut.ts/zod` subpath; it
 * is not part of the core entry, so it adds no weight for consumers who don't
 * use it. `zod` is an optional peer dependency.
 *
 * @example
 * import { z } from 'zod'
 * import { rut, rutSchema } from 'rut.ts/zod'
 *
 * const Form = z.object({ taxId: rut })                 // validates + normalizes
 * Form.parse({ taxId: '123456785' })                    // { taxId: '12.345.678-5' }
 * const Strict = z.object({ taxId: rutSchema({ strict: true }) })
 */

type RutSchemaOptions = ValidateOptions & {
  /** Custom validation error message. Defaults to `"Invalid RUT"`. */
  message?: string
}

/**
 * Builds a Zod schema that validates a Chilean RUT string and transforms it to
 * its canonical dotted form (`12.345.678-5`).
 * @param {RutSchemaOptions} [options] - `strict` to reject placeholder RUTs, and a custom `message`.
 */
export const rutSchema = (options?: RutSchemaOptions) =>
  z
    .string()
    .refine((value) => validate(value, { strict: options?.strict }), options?.message ?? 'Invalid RUT')
    .transform((value) => format(value))

/** Ready-to-use RUT schema (non-strict) that normalizes to the canonical dotted form. */
export const rut = rutSchema()
