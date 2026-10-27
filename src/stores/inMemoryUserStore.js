'use strict';

const crypto = require('crypto');

class InMemoryUserStore {
  constructor() {
    this.usersById = new Map();
  }

  create({ email, passwordHash }) {
    const user = { id: crypto.randomUUID(), email, passwordHash };
    this.usersById.set(user.id, user);
    return { ...user };
  }

  findByEmail(email) {
    for (const user of this.usersById.values()) {
      if (user.email === email) {
        return { ...user };
      }
    }
    return null;
  }

  findById(id) {
    const user = this.usersById.get(id);
    return user ? { ...user } : null;
  }

  updatePasswordHash(id, passwordHash) {
    const user = this.usersById.get(id);
    if (user) {
      user.passwordHash = passwordHash;
    }
  }
}

module.exports = { InMemoryUserStore };
