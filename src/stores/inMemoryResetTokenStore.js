'use strict';

/**
 * Stores password reset tokens by their SHA-256 hash. The raw token is never
 * kept, so a leaked store cannot be used to reset passwords.
 */
class InMemoryResetTokenStore {
  constructor() {
    this.tokensByHash = new Map();
  }

  save({ tokenHash, userId, expiresAt }) {
    this.tokensByHash.set(tokenHash, { tokenHash, userId, expiresAt, usedAt: null });
  }

  findByHash(tokenHash) {
    const record = this.tokensByHash.get(tokenHash);
    return record ? { ...record } : null;
  }

  /**
   * Marks the token as used only if it is still unused. Returns true when
   * this call consumed the token, false if it was already used or missing.
   */
  markUsed(tokenHash, usedAt) {
    const record = this.tokensByHash.get(tokenHash);
    if (!record || record.usedAt !== null) {
      return false;
    }
    record.usedAt = usedAt;
    return true;
  }

  invalidateAllForUser(userId, usedAt) {
    for (const record of this.tokensByHash.values()) {
      if (record.userId === userId && record.usedAt === null) {
        record.usedAt = usedAt;
      }
    }
  }
}

module.exports = { InMemoryResetTokenStore };
