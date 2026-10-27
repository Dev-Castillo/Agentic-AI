'use strict';

/**
 * Development email sender that writes messages to the console.
 * Any object with an async `send({ to, subject, text })` method can replace it.
 */
class ConsoleEmailSender {
  constructor(logger = console) {
    this.logger = logger;
  }

  async send({ to, subject, text }) {
    this.logger.info(`[email] to=${to} subject="${subject}"\n${text}`);
  }
}

module.exports = { ConsoleEmailSender };
