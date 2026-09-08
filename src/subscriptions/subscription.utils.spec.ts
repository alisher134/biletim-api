import {
  addMonths,
  getRemainingDays,
  getRemainingSeconds,
  isSubscriptionActive,
} from "./subscription.utils";

describe("subscription.utils", () => {
  it("adds months to a date", () => {
    const start = new Date("2026-01-15T12:00:00.000Z");
    const result = addMonths(start, 3);

    expect(result.getMonth()).toBe(3);
    expect(result.getDate()).toBe(15);
  });

  it("calculates remaining seconds and days", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = new Date("2026-01-03T12:00:00.000Z");

    expect(getRemainingSeconds(expiresAt, now)).toBe(216000);
    expect(getRemainingDays(expiresAt, now)).toBe(3);
  });

  it("returns zero remaining time after expiry", () => {
    const now = new Date("2026-02-01T00:00:00.000Z");
    const expiresAt = new Date("2026-01-01T00:00:00.000Z");

    expect(getRemainingSeconds(expiresAt, now)).toBe(0);
    expect(getRemainingDays(expiresAt, now)).toBe(0);
  });

  it("checks active subscription status", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const future = new Date("2026-02-01T00:00:00.000Z");
    const past = new Date("2025-12-01T00:00:00.000Z");

    expect(isSubscriptionActive(future, "ACTIVE", now)).toBe(true);
    expect(isSubscriptionActive(past, "ACTIVE", now)).toBe(false);
    expect(isSubscriptionActive(future, "CANCELLED", now)).toBe(false);
  });
});
