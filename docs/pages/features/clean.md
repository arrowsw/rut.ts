### Clean a RUT

Remove extraneous characters and leading zeros from RUT strings.

```typescript
import { clean } from 'rut.ts';

const cleanedRut = clean('12.345.678-9');   
console.log(cleanedRut); // Output: '123456789'
```
