import { faker } from '@faker-js/faker';
import { DomainProfile } from '../factory';
import { TEST_USERS, pickRandom } from '../static';

export const genericProfile: DomainProfile = {
  name:        () => faker.commerce.productName(),
  uniqueId:    () => `REC-${faker.string.alphanumeric({ length: 8, casing: 'upper' })}`,
  description: () => faker.lorem.sentence(),
  category:    () => faker.commerce.department(),
  date:        () => {
    const d = new Date();
    d.setDate(d.getDate() + faker.number.int({ min: 7, max: 90 }));
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  },
  status:      () => faker.helpers.arrayElement(['Active', 'Pending', 'Closed', 'In Progress']),
  owner:       () => pickRandom(TEST_USERS),
  notes:       () => faker.lorem.sentences(2),
};
