# Schema Validation with Zod

Catch bad test data before it reaches your forms — validate that every Faker-generated record matches the exact shape your MDA fields expect.

---

## Why This Matters

Faker generates data randomly. Without validation, you might get:
- A name that's 200 characters long when your field only accepts 100
- A date in the wrong format (`2025-06-15` instead of `06/15/2025`)
- A category value that doesn't match any dropdown option

Zod catches these issues instantly at data generation time, before the test even opens a browser — saving you from mysterious mid-test failures.

---

## Quick Start

Schemas are pre-built in `data/schemas.ts`. Use `validateRecord` to check any generated record:

```typescript
import { createRecord, resolveProfile } from '../data/factory';
import { validateRecord } from '../data/schemas';

const profile = await resolveProfile('healthcare');
const raw     = createRecord(profile);

// Throws immediately if any field is invalid — clear error message
const record = validateRecord(raw);

// record is now fully typed and guaranteed valid
console.log(record.name);    // string, 1–100 chars
console.log(record.date);    // string matching MM/DD/YYYY
console.log(record.uniqueId); // string, 1–100 chars
```

---

## Domain-Specific Schemas

Each domain has a stricter schema that validates domain-specific field formats:

```typescript
import { AirlineExtrasSchema, HealthcareExtrasSchema, GovernmentExtrasSchema } from '../data/schemas';

// Airline — validates IATA record locator format
const airlineRecord = AirlineExtrasSchema.parse(record);
// uniqueId must match /^[A-Z0-9]{6}$/ — e.g. "XKPL9R"

// Healthcare — validates MRN format
const healthRecord = HealthcareExtrasSchema.parse(record);
// uniqueId must match /^MRN-\d{8}$/ — e.g. "MRN-58291043"

// Government — validates case number format
const govRecord = GovernmentExtrasSchema.parse(record);
// uniqueId must match /^CASE-\d{4}-\d{4}$/ — e.g. "CASE-2025-0847"
```

---

## Safe Validation (No Throw)

When you want to check validity without crashing, use `safeValidateRecord`:

```typescript
import { safeValidateRecord } from '../data/schemas';

const result = safeValidateRecord(record);

if (result.success) {
  // result.data is the typed, validated record
  console.log('Valid:', result.data.name);
} else {
  // result.error contains every field that failed and why
  console.error('Invalid record:', result.error.flatten());
  // Example output:
  // {
  //   fieldErrors: {
  //     date: ['Date must be MM/DD/YYYY'],
  //     name: ['String must contain at most 100 character(s)']
  //   }
  // }
}
```

---

## Writing Your Own Schema

When you add a new entity with specific field constraints, define its schema in `data/schemas.ts`:

```typescript
import { z } from 'zod';

// Example: a patient intake form
export const PatientSchema = z.object({
  name:       z.string().min(2).max(100),
  mrn:        z.string().regex(/^MRN-\d{8}$/, 'Must be MRN-########'),
  department: z.enum(['Cardiology', 'Neurology', 'Oncology', 'Radiology']),
  admitDate:  z.string().regex(/^\d{1,2}\/\d{1,2}\/\d{4}$/, 'Must be MM/DD/YYYY'),
  status:     z.enum(['Active', 'Discharged', 'Pending']),
  phone:      z.string().regex(/^\d{3}-\d{3}-\d{4}$/, 'Must be ###-###-####').optional(),
});

export type PatientRecord = z.infer<typeof PatientSchema>;
```

Then validate before using:
```typescript
const patient = PatientSchema.parse(createRecord(healthcareProfile));
```

---

## Validating API Responses

Zod isn't just for Faker data — use it to validate that your MDA's API returns the shape you expect. If the schema changes in a future release, your tests catch it immediately:

```typescript
import { z } from 'zod';
import { DataverseClient } from '../helpers/dataverse';

const EquipmentResponseSchema = z.object({
  usgs_equipmentid:  z.string().uuid(),
  usgs_name:         z.string(),
  usgs_serialnumber: z.string(),
  statecode:         z.number(), // 0 = active, 1 = inactive
});

const db     = new DataverseClient();
const raw    = await db.read('usgs_equipments', recordId);
const record = EquipmentResponseSchema.parse(raw); // throws if shape changed

expect(record.statecode).toBe(0); // active
```

---

## Zod Cheat Sheet

```typescript
z.string()                    // any string
z.string().min(1).max(100)    // length constraints
z.string().email()            // valid email format
z.string().url()              // valid URL
z.string().uuid()             // valid UUID
z.string().regex(/pattern/)   // custom regex

z.number()                    // any number
z.number().int()              // integers only
z.number().min(0).max(100)    // range

z.enum(['A', 'B', 'C'])       // must be one of these values
z.literal('exact-value')      // must be exactly this

z.boolean()
z.date()

z.object({ field: z.string() })     // object with required field
z.object({ field: z.string().optional() }) // object with optional field

z.array(z.string())           // array of strings
z.array(z.string()).min(1)    // non-empty array

schema.parse(data)            // validate, throw on error
schema.safeParse(data)        // validate, return { success, data | error }
schema.partial()              // make all fields optional
schema.extend({ newField: z.string() }) // add fields to existing schema
```

---

## Tips

- **Validate at the boundary** — validate data when it enters your test, not inside every assertion
- **Use `.optional()` for fields your factory doesn't always generate** — domain-specific extras like `npiNumber` may not exist in all records
- **Zod errors are readable** — when a validation fails, the error message tells you exactly which field and why, without having to dig through a stack trace
- **Type inference is free** — `z.infer<typeof MySchema>` gives you a TypeScript type automatically, no need to define it separately
