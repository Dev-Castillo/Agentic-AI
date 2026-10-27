'use strict';

const crypto = require('crypto');

class InMemorySessionStore {
  constructor() {
    this.sessionsById = new Map();
  }

  create(userId, { device = 'unknown' } = {}) {
    const session = { id: crypto.randomBytes(32).toString('hex'), userId, device };
    this.sessionsById.set(session.id, session);
    return { ...session };
  }

  findById(id) {
    const session = this.sessionsById.get(id);
    return session ? { ...session } : null;
  }

  listForUser(userId) {
    return [...this.sessionsById.values()].filter((s) => s.userId === userId).map((s) => ({ ...s }));
  }

  /** Deletes every session of the user, on every device. Returns the count removed. */
  revokeAllForUser(userId) {
    let removed = 0;
    for (const [id, session] of this.sessionsById) {
      if (session.userId === userId) {
        this.sessionsById.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}

module.exports = { InMemorySessionStore };
