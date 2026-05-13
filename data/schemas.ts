import { z } from 'zod';

/**
 * Base schema every MDA record must satisfy.
 * Validates that generated data is safe to use before it hits any form field.
 */
export const MdaRecordSchema = z.object({
  name:        z.string().min(1).max(100),
  uniqueId:    z.string().min(1).max(100),
  description: z.string().min(1),
  category:    z.string().min(1),
  date:        z.string().regex(/^\d{1,2}\/\d{1,2}\/\d{4}$/, 'Date must be MM/DD/YYYY'),
  status:      z.string().min(1),
  owner:       z.string().min(1),
  notes:       z.string(),
});

export type MdaRecord = z.infer<typeof MdaRecordSchema>;

/** Airline-specific extras */
export const AirlineExtrasSchema = MdaRecordSchema.extend({
  uniqueId: z.string().regex(/^[A-Z0-9]{6}$/, 'Record locator must be 6 uppercase alphanumeric characters'),
});

/** Healthcare-specific extras */
export const HealthcareExtrasSchema = MdaRecordSchema.extend({
  uniqueId:      z.string().regex(/^MRN-\d{8}$/, 'MRN must be MRN-########'),
  certification: z.string().optional(),
  npiNumber:     z.string().regex(/^\d{10}$/, 'NPI must be 10 digits').optional(),
});

/** Government-specific extras */
export const GovernmentExtrasSchema = MdaRecordSchema.extend({
  uniqueId: z.string().regex(/^CASE-\d{4}-\d{4}$/, 'Case ID must be CASE-YYYY-####'),
  agency:   z.string().optional(),
  region:   z.string().optional(),
  cfr:      z.string().optional(),
});

/**
 * Validate a record against the base schema.
 * Throws a ZodError with a clear message if any field is invalid.
 *
 * Usage:
 *   const record = validateRecord(createRecord(profile));
 */
export function validateRecord(data: unknown): MdaRecord {
  return MdaRecordSchema.parse(data);
}

/**
 * Validate without throwing — returns { success, data, error }.
 *
 * Usage:
 *   const result = safeValidateRecord(data);
 *   if (!result.success) console.error(result.error.flatten());
 */
export function safeValidateRecord(data: unknown) {
  return MdaRecordSchema.safeParse(data);
}
