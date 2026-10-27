'use strict';

const INVALID_EMAIL_MESSAGE = 'Please enter a valid email address.';
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const PASSWORD_SPECIAL_CHARACTERS = '!@#$%^&*';
const PASSWORD_MIN_LENGTH = 8;

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  const value = normalizeEmail(email);
  return value.length > 0 && value.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(value);
}

/**
 * Returns a list of human-readable policy violations. An empty list means
 * the password satisfies the policy.
 */
function validatePassword(password) {
  const value = typeof password === 'string' ? password : '';
  const errors = [];
  if (value.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
  }
  if (!/[A-Z]/.test(value)) {
    errors.push('Password must contain at least 1 uppercase letter.');
  }
  if (!/[0-9]/.test(value)) {
    errors.push('Password must contain at least 1 number.');
  }
  if (!/[!@#$%^&*]/.test(value)) {
    errors.push(`Password must contain at least 1 special character (${PASSWORD_SPECIAL_CHARACTERS}).`);
  }
  return errors;
}

module.exports = {
  INVALID_EMAIL_MESSAGE,
  PASSWORD_SPECIAL_CHARACTERS,
  normalizeEmail,
  isValidEmail,
  validatePassword,
};
