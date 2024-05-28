## 🧮 Calculate Verifier

Calculate the verifier digit for a given RUT body.

```typescript
import { calculateVerifier } from 'rut.ts';

const verifier = clean('14745562');   
console.log(verifier); // Output: '3'
```

### Posible use cases

- Calculate the verifier digit for a RUT body before validating it.
- Implement custom RUT generation logic by calculating the verifier digit for specific bodies.
- Verify the correctness of a RUT by comparing the calculated verifier digit with the provided one.
