'use strict';

const express = require('express');
const { systemClock } = require('./lib/clock');
const { ConsoleEmailSender } = require('./email/consoleEmailSender');
const { InMemoryUserStore } = require('./stores/inMemoryUserStore');
const { InMemoryResetTokenStore } = require('./stores/inMemoryResetTokenStore');
const { InMemorySessionStore } = require('./stores/inMemorySessionStore');
const { PasswordResetService } = require('./services/passwordResetService');
const { passwordResetRouter } = require('./routes/passwordReset');

/**
 * Builds the Express app. Every dependency can be injected, which lets tests
 * supply their own stores, email sender and clock.
 */
function createApp({
  userStore = new InMemoryUserStore(),
  tokenStore = new InMemoryResetTokenStore(),
  sessionStore = new InMemorySessionStore(),
  emailSender = new ConsoleEmailSender(),
  clock = systemClock,
  baseUrl = 'http://localhost:3000',
  logger = console,
} = {}) {
  const passwordResetService = new PasswordResetService({
    userStore,
    tokenStore,
    sessionStore,
    emailSender,
    clock,
    baseUrl,
    logger,
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));
  app.use((req, res, next) => {
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use(passwordResetRouter(passwordResetService));

  app.use((req, res) => {
    res.status(404).type('text').send('Not found');
  });

  app.use((err, req, res, next) => {
    logger.error(err);
    res.status(500).type('text').send('Something went wrong');
  });

  return app;
}

module.exports = { createApp };
