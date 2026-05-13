import { faker } from '@faker-js/faker';

/**
 * A domain profile is a map of field-name → generator function.
 * Built-in fields (name, uniqueId, description, category, date, status, owner, notes)
 * map directly to the most common MDA form fields.
 * Add any domain-specific extras as additional keys.
 */
export interface DomainProfile {
  name:        () => string;
  uniqueId:    () => string;
  description: () => string;
  category:    () => string;
  date:        () => string;
  status:      () => string;
  owner:       () => string;
  notes:       () => string;
  [key: string]: () => string; // domain-specific extras
}

/**
 * A generated record — all generator functions are resolved to strings.
 */
export type MdaRecord = {
  [K in keyof DomainProfile]: string;
};

/**
 * Generate a single MDA record from a domain profile.
 * Pass overrides to fix specific fields (e.g. force a category).
 */
export function createRecord(
  profile: DomainProfile,
  overrides?: Partial<Record<string, string>>
): MdaRecord {
  const record: Record<string, string> = {};
  for (const [key, generator] of Object.entries(profile)) {
    record[key] = generator();
  }
  return { ...record, ...overrides } as MdaRecord;
}

/**
 * Generate N records from a domain profile.
 */
export function createBatch(
  profile: DomainProfile,
  count: number,
  overrides?: Partial<Record<string, string>>
): MdaRecord[] {
  return Array.from({ length: count }, () => createRecord(profile, overrides));
}

/**
 * Set Faker's seed for reproducible data.
 * Same seed → same sequence of records every run.
 */
export function seedFaker(seed: number): void {
  faker.seed(seed);
}

/**
 * Resolve the active domain profile from FAKER_DOMAIN env var or a string argument.
 * Falls back to 'generic' when unrecognized.
 */
export async function resolveProfile(domain?: string): Promise<DomainProfile> {
  const name = (domain ?? process.env.FAKER_DOMAIN ?? 'generic').toLowerCase();

  switch (name) {
    case 'airline':    return (await import('./domains/airline')).airlineProfile;
    case 'healthcare': return (await import('./domains/healthcare')).healthcareProfile;
    case 'government': return (await import('./domains/government')).governmentProfile;
    default:           return (await import('./domains/generic')).genericProfile;
  }
}
