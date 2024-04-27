<div align="center">
  <img src="https://user-images.githubusercontent.com/12705403/158434864-7f13401a-b973-4267-b035-d9882cf6c545.png" alt="Rut.ts logo" width="100%">
  <h1>Rut.ts: Handle chilean RUT values with ease</h1>
</div>

## Features

- **Validation**: Check if a RUT is valid, with optional strict mode to detect suspicious patterns.
- **Cleaning**: Remove extraneous characters and leading zeros from RUT strings.
- **Formatting**: Convert RUTs into a standardized format, with or without dots.
- **Decomposition**: Split a RUT into its body and verifier digit.
- **Generation**: Generate valid random RUT numbers.

## Installation

Using [pnpm](https://pnpm.io/):

    $ pnpm install rut.ts

Using [npm](https://www.npmjs.com/):

    $ npm install rut.ts


Using [yarn](https://yarnpkg.com/):

    $ yarn add rut.ts


## Usage

Below are examples demonstrating how to use the various functions provided by this library.

### Validate a RUT

```typescript
import { validate } from 'rut.ts';

const isValid = validate('12.345.678-9');
console.log(isValid); // Output: true or false
```

### Clean a RUT

```typescript
import { clean } from 'rut.ts';

const cleanedRut = clean('12.345.678-9');   
console.log(cleanedRut); // Output: '123456789'
```

### Format a RUT

```typescript
import { format } from 'rut.ts';

const formattedRut = format('123456789');
console.log(formattedRut); // Output: '12.345.678-9'
```
### Decompose a RUT

```typescript
import { decompose } from 'rut.ts';

const { body, verifier } = decompose('12.345.678-9');
console.log(body); // Output: '12345678'
console.log(verifier); // Output: '9'
```

### Generate a random RUT

```typescript
import { generate } from 'rut.ts';

const randomRut = generate();
console.log(randomRut); // Output: '12.345.678-9'
```

## Contributing

Contributions to this library are welcome. Please feel free to submit pull requests or create issues for bugs and feature requests.
