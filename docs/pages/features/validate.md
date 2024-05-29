## ✅ Validate a RUT

Check if a RUT is valid.

```typescript
import { validate } from 'rut.ts';

const isValid = validate('12.345.678-9');
console.log(isValid); // Output: true or false
```

Check if a RUT is valid, using the optional strict mode to detect suspicious patterns.

```typescript
import { validate } from 'rut.ts';

const isValid = validate('11.111.111-1', true);
console.log(isValid); // Output: false
```

### Posible use cases

- Validate user input in forms.
- Check RUTs before storing them in a database.
- Verify RUTs before processing them in a backend service.
