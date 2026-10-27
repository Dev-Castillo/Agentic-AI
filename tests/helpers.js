'use strict';

const { createApp } = require('../src/app');
const { InMemoryUserStore } = require('../src/stores/inMemoryUserStore');
const { InMemoryResetTokenStore } = require('../src/stores/inMemoryResetTokenStore');
const { InMemorySessionStore } = require('../src/stores/inMemorySessionStore');
const { InMemoryEmailSender } = require('../src/email/inMemoryEmailSender');
const { hashPassword } = require('../src/lib/passwordHasher');

const BASE_URL = 'http://reset.test';
const USER_EMAIL = 'jane@example.com';
const OLD_PASSWORD = 'OldPassw0rd!';

function createFakeClock(start = Date.UTC(2026, 0, 1)) {
  let current = start;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
  };
}

const silentLogger = { info: () => {}, error: () => {} };

function setup() {
  const userStore = new InMemoryUserStore();
  const tokenStore = new InMemoryResetTokenStore();
  const sessionStore = new InMemorySessionStore();
  const emailSender = new InMemoryEmailSender();
  const clock = createFakeClock();
  const user = userStore.create({ email: USER_EMAIL, passwordHash: hashPassword(OLD_PASSWORD) });
  const app = createApp({
    userStore,
    tokenStore,
    sessionStore,
    emailSender,
    clock,
    baseUrl: BASE_URL,
    logger: silentLogger,
  });
  return { app, user, userStore, tokenStore, sessionStore, emailSender, clock };
}

/** Lets the fire-and-forget email delivery settle. */
function flushEmails() {
  return new Promise((resolve) => setImmediate(resolve));
}

function extractResetPath(email) {
  const match = email.text.match(new RegExp(`${BASE_URL}(/password-reset/[0-9a-f]{64})`));
  if (!match) {
    throw new Error('No reset link found in email');
  }
  return match[1];
}

module.exports = {
  BASE_URL,
  USER_EMAIL,
  OLD_PASSWORD,
  setup,
  flushEmails,
  extractResetPath,
};
