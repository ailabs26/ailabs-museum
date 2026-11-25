import { getStartupMs, recordStartup } from './startup-timing';

it('không có mốc bundle -> không ghi; có thì ghi đúng một lần', () => {
  expect(recordStartup(500, null)).toBeNull();
  expect(getStartupMs()).toBeNull();
  expect(recordStartup(1500.4, 1000)).toBe(500);
  expect(recordStartup(9000, 1000)).toBe(500);
  expect(getStartupMs()).toBe(500);
});
