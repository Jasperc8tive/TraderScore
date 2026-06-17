/**
 * Clock abstraction.
 *
 * Domain code depends on a Clock rather than calling `new Date()` directly, so
 * time-sensitive logic (OTP expiry, session validity, score recency) is
 * deterministically testable. SystemClock is the production implementation.
 */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** A fixed clock for tests. */
export class FixedClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return this.current;
  }
  set(date: Date): void {
    this.current = date;
  }
}
