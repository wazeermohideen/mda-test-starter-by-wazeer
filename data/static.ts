import { qaConfig } from './qa-config';

export const TEST_USERS = qaConfig.users.map(user => user.name);

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
