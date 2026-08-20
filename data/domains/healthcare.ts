import { faker } from '@faker-js/faker';
import { DomainProfile } from '../factory';
import { TEST_USERS, pickRandom } from '../static';

const DEPARTMENTS  = ['Cardiology', 'Neurology', 'Orthopedics', 'Oncology', 'Radiology', 'Emergency', 'Pathology', 'Pediatrics'];
const CONDITIONS   = ['Routine checkup', 'Post-operative follow-up', 'Chronic disease management', 'Diagnostic evaluation', 'Preventive care', 'Lab review'];
const STATUSES     = ['Active', 'Discharged', 'Pending Consult', 'In Treatment', 'Closed'];
const CERT_TYPES   = ['CLIA', 'CAP', 'ISO 15189', 'FDA 510(k)', 'NVLAP'];

/**
 * Healthcare / science domain — combines faker.science, faker.person, and clinical terminology.
 *
 * Ideal for: USGS, HHS, CDC, NIH, hospital MDA systems, lab management, patient registries.
 *
 * Example output:
 *   name        → "Patient: James Harrington"
 *   uniqueId    → "MRN-58291043"
 *   description → "Cardiology — Routine checkup"
 *   category    → "Cardiology"
 *   date        → "06/20/2025"
 */
export const healthcareProfile: DomainProfile = {
  name:        () => `Patient: ${faker.person.fullName()}`,
  uniqueId:    () => `MRN-${faker.string.numeric(8)}`,
  description: () => `${faker.helpers.arrayElement(DEPARTMENTS)} — ${faker.helpers.arrayElement(CONDITIONS)}`,
  category:    () => faker.helpers.arrayElement(DEPARTMENTS),
  date:        () => {
    const d = faker.date.soon({ days: 30 });
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  },
  status:      () => faker.helpers.arrayElement(STATUSES),
  owner:       () => pickRandom(TEST_USERS),
  notes:       () => {
    const element = faker.science.chemicalElement();
    const unit    = faker.science.unit();
    return `Reference compound: ${element.name} (${element.symbol}). Units: ${unit.name} (${unit.symbol}).`;
  },
  // Healthcare-specific extras — access via record.extras in tests
  certification: () => faker.helpers.arrayElement(CERT_TYPES),
  npiNumber:     () => faker.string.numeric(10),
};
