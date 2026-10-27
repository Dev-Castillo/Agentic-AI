'use strict';

const crypto = require('crypto');
const { hashPassword } = require('../lib/passwordHasher');
const { normalizeEmail, validatePassword } = require('./validation');

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const RESET_TOKEN_BYTES = 32;
const TOKEN_FORMAT = /^[0-9a-f]{64}$/;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

class PasswordResetService {
  constructor({ userStore, tokenStore, sessionStore, emailSender, clock, baseUrl, logger = console }) {
    this.userStore = userStore;
    this.tokenStore = tokenStore;
    this.sessionStore = sessionStore;
    this.emailSender = emailSender;
    this.clock = clock;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.logger = logger;
  }

  /**
   * Issues a reset link if the email belongs to an account. Returns nothing
   * either way, so callers cannot tell whether the account exists. Email
   * delivery is not awaited, which keeps response timing the same for both cases.
   */
  requestReset(email) {
    const user = this.userStore.findByEmail(normalizeEmail(email));
    if (!user) {
      return;
    }

    const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
    this.tokenStore.save({
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: this.clock.now() + RESET_TOKEN_TTL_MS,
    });

    const link = `${this.baseUrl}/password-reset/${token}`;
    Promise.resolve()
      .then(() =>
        this.emailSender.send({
          to: user.email,
          subject: 'Reset your password',
          text:
            'We received a request to reset your password.\n\n' +
            `Open this link to choose a new password: ${link}\n\n` +
            'The link expires in 15 minutes and can be used only once. ' +
            'If you did not request this, you can ignore this email.',
        }),
      )
      .catch((err) => this.logger.error('Failed to send password reset email', err));
  }

  /** Returns the token record if the token is unused and not expired, otherwise null. */
  findValidToken(token) {
    if (typeof token !== 'string' || !TOKEN_FORMAT.test(token)) {
      return null;
    }
    const record = this.tokenStore.findByHash(hashToken(token));
    if (!record || record.usedAt !== null || this.clock.now() >= record.expiresAt) {
      return null;
    }
    return record;
  }

  /**
   * Sets a new password using a reset token.
   * Returns { ok: true } on success, { ok: false, reason: 'invalid_token' }
   * or { ok: false, reason: 'invalid_password', errors: [...] }.
   */
  resetPassword(token, newPassword, confirmPassword) {
    const record = this.findValidToken(token);
    if (!record) {
      return { ok: false, reason: 'invalid_token' };
    }

    const errors = validatePassword(newPassword);
    if (errors.length === 0 && newPassword !== confirmPassword) {
      errors.push('Passwords do not match.');
    }
    if (errors.length > 0) {
      return { ok: false, reason: 'invalid_password', errors };
    }

    const now = this.clock.now();
    if (!this.tokenStore.markUsed(record.tokenHash, now)) {
      return { ok: false, reason: 'invalid_token' };
    }

    this.userStore.updatePasswordHash(record.userId, hashPassword(newPassword));
    this.tokenStore.invalidateAllForUser(record.userId, now);
    this.sessionStore.revokeAllForUser(record.userId);
    return { ok: true };
  }
}

module.exports = { PasswordResetService, RESET_TOKEN_TTL_MS, hashToken };
