### Decompose a RUT

Split a RUT into its body and verifier digit.

```typescript
import { decompose } from 'rut.ts';

const { body, verifier } = decompose('12.345.678-9');
console.log(body); // Output: '12345678'
console.log(verifier); // Output: '9'
```
