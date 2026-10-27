'use strict';

const { escapeHtml } = require('../lib/html');
const { layout } = require('./layout');
const { PASSWORD_SPECIAL_CHARACTERS } = require('../services/validation');

const RESET_REQUESTED_MESSAGE = 'If an account exists for this email, a reset link has been sent.';
const INVALID_LINK_TITLE = 'Expired or invalid link';

function requestFormPage({ email = '', error = null } = {}) {
  const errorHtml = error
    ? `      <p id="email-error" class="field-error" role="alert">${escapeHtml(error)}</p>\n`
    : '';
  const describedBy = error ? ' aria-invalid="true" aria-describedby="email-error"' : '';
  return layout(
    'Reset your password',
    `    <form method="post" action="/password-reset" novalidate>
      <label for="email">Email address</label>
      <input id="email" name="email" type="email" autocomplete="email" value="${escapeHtml(email)}" required${describedBy}>
${errorHtml}      <button type="submit">Send reset link</button>
    </form>`,
  );
}

function requestSubmittedPage() {
  return layout('Check your email', `    <p role="status">${escapeHtml(RESET_REQUESTED_MESSAGE)}</p>`);
}

function passwordField(id, label) {
  return `      <label for="${id}">${label}</label>
      <input id="${id}" name="${id}" type="password" autocomplete="new-password" required>
      <button type="button" class="toggle-password" data-target="${id}" aria-controls="${id}" aria-pressed="false">Show</button>`;
}

function newPasswordFormPage({ token, errors = [] }) {
  const errorsHtml = errors.length
    ? `    <ul class="form-errors" role="alert">\n${errors
        .map((e) => `      <li>${escapeHtml(e)}</li>`)
        .join('\n')}\n    </ul>\n`
    : '';
  return layout(
    'Choose a new password',
    `${errorsHtml}    <p>Use at least 8 characters, including 1 uppercase letter, 1 number and 1 special character (${escapeHtml(
      PASSWORD_SPECIAL_CHARACTERS,
    )}).</p>
    <form method="post" action="/password-reset/${escapeHtml(token)}">
${passwordField('password', 'New password')}
${passwordField('confirmPassword', 'Confirm new password')}
      <button type="submit">Update password</button>
    </form>
    <script>
      document.querySelectorAll('.toggle-password').forEach(function (button) {
        button.addEventListener('click', function () {
          var input = document.getElementById(button.getAttribute('data-target'));
          var show = input.type === 'password';
          input.type = show ? 'text' : 'password';
          button.textContent = show ? 'Hide' : 'Show';
          button.setAttribute('aria-pressed', String(show));
        });
      });
    </script>`,
  );
}

function resetSuccessPage() {
  return layout(
    'Password updated',
    '    <p role="status">Your password has been updated. You have been signed out on all devices.</p>',
  );
}

function invalidLinkPage() {
  return layout(
    INVALID_LINK_TITLE,
    `    <p>This password reset link has expired or has already been used.</p>
    <p><a href="/password-reset">Request a new reset link</a></p>`,
  );
}

module.exports = {
  RESET_REQUESTED_MESSAGE,
  INVALID_LINK_TITLE,
  requestFormPage,
  requestSubmittedPage,
  newPasswordFormPage,
  resetSuccessPage,
  invalidLinkPage,
};
