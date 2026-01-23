<div align="center">
  <img src="https://user-images.githubusercontent.com/12705403/158434864-7f13401a-b973-4267-b035-d9882cf6c545.png" alt="Rut.ts logo" width="100%">
  <h1>Rut.ts: Handle chilean RUT values with ease using TypeScript.</h1>
</div>

## What is a RUT?

The **RUT** (Rol Único Tributario) is the unique Chilean identification number used for:
- Tax purposes
- Legal identification
- Government services
- Banking and financial transactions

**Format**: `XX.XXX.XXX-Y` where:
- `X` = Body (7-8 digits)
- `Y` = Verifier digit (0-9 or K)

**Example**: `12.345.678-5`

The verifier digit is calculated using the [Modulo 11 algorithm](https://en.wikipedia.org/wiki/Rol_%C3%9Anico_Tributario) to validate the RUT's authenticity.

---

## Features

- **Validation**: Check if a RUT is valid, with optional strict mode to detect suspicious patterns.
- **Cleaning**: Remove extraneous characters and leading zeros from RUT strings.
- **Formatting**: Convert RUTs into a standardized format, with or without dots.
- **Incremental Formatting**: Format RUTs progressively as the user types (ideal for form inputs).
- **Decomposition**: Split a RUT into its body and verifier digit.
- **Generation**: Generate valid random RUT numbers.
- **Calculate Verifier**: Calculate the verifier digit for a given RUT body.
- **Format Detection**: Check if a string looks like a RUT format with `isRutLike`.
- **Safe Mode**: All functions support `throwOnError: false` to return `null` instead of throwing errors.

## Installation

Using [bun](https://bun.sh/):

    $ bun add rut.ts

Using [npm](https://www.npmjs.com/):

    $ npm install rut.ts

Using [pnpm](https://pnpm.io/):

    $ pnpm install rut.ts


## Quick Examples

```typescript
import { validate, format, clean, isRutLike, decompose } from 'rut.ts'

// Validation
validate('12.345.678-5')                      // true
validate('12.345.678-0')                      // false (wrong verifier)
validate('11.111.111-1', { strict: true })    // false (strict mode rejects suspicious RUTs)

// Formatting
format('123456785')                // '12.345.678-5'
format('123456785', { dots: false }) // '12345678-5'

// Incremental formatting (for form inputs)
format('1234', { incremental: true })     // '1.234'
format('12345678', { incremental: true }) // '1.234.567-8' (8 chars = complete)
format('123456785', { incremental: true }) // '12.345.678-5' (9 chars = complete)

// Cleaning
clean('12.345.678-5')              // '123456785'

// Decomposition
const { body, verifier } = decompose('12.345.678-5')
console.log(body)      // '12345678'
console.log(verifier)  // '5'

// Format detection (without full validation)
isRutLike('12.345.678-5')          // true
isRutLike('not-a-rut')             // false

// Safe mode (returns null instead of throwing)
clean('invalid', { throwOnError: false })  // null
format('abc', { throwOnError: false })     // null
```

## Incremental Formatting

The `incremental` option in `format()` allows you to format RUTs progressively as the user types. This is useful for real-time formatting in form inputs.

```typescript
// Example: React input handler
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const formatted = format(e.target.value, { incremental: true })
  setRut(formatted)
}
```

> **Note**: Incremental formatting will format the input progressively even for incomplete RUTs. The formatted output may not represent a valid RUT until the input is complete. Always use `validate()` to verify the final RUT before processing.

### When to use incremental mode

**✅ Use incremental when:**
- Formatting user input in real-time as they type
- Providing immediate visual feedback in form fields
- Improving UX with progressive formatting

**❌ Don't use incremental when:**
- Formatting already complete/stored RUTs (use default `format()`)
- Validating RUTs (use `validate()` instead)
- Processing final form submission values

## Usage

Please refer to [the documentation](https://rutts-arrowsw.vercel.app/) for more detailed examples.


## TypeScript Types

The library exports the following types:

```typescript
import type { DecomposedRut, FormatOptions, SafeOptions, ValidateOptions, VerifierDigit } from 'rut.ts'

// VerifierDigit: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'K'
// DecomposedRut: { body: string; verifier: string }
// FormatOptions: { incremental?: boolean; dots?: boolean; throwOnError?: boolean }
// ValidateOptions: { strict?: boolean }
// SafeOptions: { throwOnError?: boolean }
```


## Contributing

Contributions to this library are welcome. Please feel free to submit pull requests or create issues for bugs and feature requests.
