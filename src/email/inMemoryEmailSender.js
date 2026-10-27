'use strict';

/** Email sender that records messages in memory. Useful for tests. */
class InMemoryEmailSender {
  constructor() {
    this.sent = [];
  }

  async send(message) {
    this.sent.push({ ...message });
  }
}

module.exports = { InMemoryEmailSender };
