## ✅ Validate a RUT

Check if a RUT is valid, with optional strict mode to detect suspicious patterns.

```typescript
import { validate } from 'rut.ts';

const isValid = validate('12.345.678-9');
console.log(isValid); // Output: true or false
```

### Posible use cases

- Validate user input in forms.
- Check RUTs before storing them in a database.
- Verify RUTs before processing them in a backend service.
