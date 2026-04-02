export const installCode = `npm install rut.ts`
export const exampleCode = `import { validate, format } from 'rut.ts'
// Validate any RUT format
validate('12.345.678-5') // → true
// Format with dots and hyphen
format('123456785') // → '12.345.678-5'
// Incremental formatting
format('1234', { incremental: true })
// → '1.234'`
