import { faker } from '@faker-js/faker';
import { DomainProfile } from '../factory';

const AGENCIES     = ['EPA', 'USGS', 'FEMA', 'DOT', 'HHS', 'DOD', 'USACE', 'NPS', 'BLM', 'FDA'];
const CASE_TYPES   = ['Compliance Review', 'Field Inspection', 'Permit Application', 'Incident Report', 'Environmental Assessment', 'Grant Request'];
const STATUSES     = ['Open', 'Under Review', 'Pending Approval', 'Approved', 'Closed', 'Escalated'];
const REGIONS      = ['Northeast', 'Southeast', 'Midwest', 'Southwest', 'West', 'Pacific', 'Mountain', 'National'];

/**
 * Government / public sector domain — generates case numbers, agency names, regulatory data.
 *
 * Ideal for: federal/state/local agency MDAs, case management, permit tracking,
 *            environmental monitoring, compliance systems.
 *
 * Example output:
 *   name        → "USGS Case #2025-0847: Field Inspection"
 *   uniqueId    → "CASE-2025-0847"
 *   description → "Midwest Region — Environmental Assessment"
 *   category    → "Environmental Assessment"
 *   date        → "06/25/2025"
 */
export const governmentProfile: DomainProfile = {
  name: () => {
    const agency    = faker.helpers.arrayElement(AGENCIES);
    const caseNum   = faker.string.numeric({ length: 4 });
    const caseType  = faker.helpers.arrayElement(CASE_TYPES);
    return `${agency} Case #${new Date().getFullYear()}-${caseNum}: ${caseType}`;
  },
  uniqueId:    () => `CASE-${new Date().getFullYear()}-${faker.string.numeric({ length: 4 })}`,
  description: () => `${faker.helpers.arrayElement(REGIONS)} Region — ${faker.helpers.arrayElement(CASE_TYPES)}`,
  category:    () => faker.helpers.arrayElement(CASE_TYPES),
  date:        () => {
    const d = faker.date.soon({ days: 45 });
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  },
  status:      () => faker.helpers.arrayElement(STATUSES),
  owner:       () => `${faker.helpers.arrayElement(AGENCIES)} — ${faker.person.fullName()}`,
  notes:       () => `${faker.location.county()}, ${faker.location.state()} — ${faker.lorem.sentence()}`,
  // Government-specific extras
  agency:      () => faker.helpers.arrayElement(AGENCIES),
  region:      () => faker.helpers.arrayElement(REGIONS),
  cfr:         () => `${faker.number.int({ min: 1, max: 50 })} CFR Part ${faker.number.int({ min: 1, max: 999 })}`,
};
