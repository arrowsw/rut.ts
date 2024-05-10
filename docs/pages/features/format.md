## 🔠 Format a RUT

Convert RUTs into a standardized format, with or without dots.

```typescript
import { format } from 'rut.ts';

const formattedRut = format('123456789');
console.log(formattedRut); // Output: '12.345.678-9'
```

### Posible use cases

- Display RUTs in a consistent format.
- Format RUTs for user interfaces.
- Normalize RUTs before storing them in a database.
