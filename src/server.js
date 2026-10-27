'use strict';

const crypto = require('crypto');
const { createApp } = require('./app');
const { InMemoryUserStore } = require('./stores/inMemoryUserStore');
const { hashPassword } = require('./lib/passwordHasher');

const port = Number(process.env.PORT) || 3000;
const baseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;

// The in-memory store starts with one demo account so the flow can be tried locally.
// Its initial password is random; use the reset flow to set one.
const userStore = new InMemoryUserStore();
const demoEmail = process.env.DEMO_USER_EMAIL || 'demo@example.com';
userStore.create({ email: demoEmail, passwordHash: hashPassword(crypto.randomBytes(16).toString('hex')) });

createApp({ userStore, baseUrl }).listen(port, () => {
  console.info(`Password reset app listening on ${baseUrl}/password-reset (demo account: ${demoEmail})`);
});
