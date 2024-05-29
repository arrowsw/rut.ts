## 🔠 Format a RUT

Convert RUTs into a standardized format, with dots.

```typescript
import { format } from 'rut.ts';

const formattedRut = format('123456789');
console.log(formattedRut); // Output: '12.345.678-9'
```

Convert RUTs into a standardized format, without dots.

```typescript
import { format } from 'rut.ts';

const formattedRut = format('123456789', { dots: false });
console.log(formattedRut); // Output: '12345678-9'
```

Convert RUTs into a standardized format, with or without dots (in this case, with dots), but let do it incrementally without throwing an error before the entire string is passed as a value.

```typescript
import { format } from 'rut.ts';

const formattedRut = format('123456789', { incremental: true });
console.log(formattedRut); // Output: '12.345.678-9'
```

### Posible use cases

- Display RUTs in a consistent format.
- Format RUTs for user interfaces.
- Normalize RUTs before storing them in a database.
- Format RUT as the user is typing it.
