import { faker } from '@faker-js/faker';
import { DomainProfile } from '../factory';
import { TEST_USERS, pickRandom } from '../static';

/**
 * Airline domain — uses faker.airline for flights, airports, seat classes, and record locators.
 *
 * Ideal for: aviation MRO systems, flight ops MDAs, crew scheduling, safety reporting.
 *
 * Example output:
 *   name        → "American Airlines Flight AA3847"
 *   uniqueId    → "XKPL9R"  (IATA-style record locator)
 *   description → "JFK → LAX"
 *   category    → "widebody"
 *   date        → "06/15/2025"
 */
export const airlineProfile: DomainProfile = {
  name: () => {
    const airline = faker.airline.airline();
    const flight  = faker.airline.flightNumber({ addLeadingZeros: true });
    return `${airline.name} Flight ${airline.iataCode}${flight}`;
  },
  uniqueId:    () => faker.airline.recordLocator(),
  description: () => `${faker.airline.airport().iataCode} → ${faker.airline.airport().iataCode}`,
  category:    () => faker.airline.aircraftType(),
  date:        () => {
    const d = faker.date.soon({ days: 60 });
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  },
  status:      () => faker.helpers.arrayElement(['Scheduled', 'Boarding', 'Departed', 'Landed', 'Cancelled', 'Delayed']),
  owner:       () => pickRandom(TEST_USERS),
  notes:       () => `Seat ${faker.airline.seat()} — ${faker.airline.aircraftType()} aircraft`,
};
