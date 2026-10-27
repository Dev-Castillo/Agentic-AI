'use strict';

/**
 * Default clock. Inject a different object with a `now()` method
 * (returning epoch milliseconds) to control time in tests.
 */
const systemClock = {
  now: () => Date.now(),
};

module.exports = { systemClock };
