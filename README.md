# Agentic-AI

A small Node.js + Express app for password reset by email (CTM-119 / US-204).
It serves HTML forms rendered on the server, keeps data in memory, and has an email sender you can swap out.

## Requirements

- Node.js 18 or later (developed on Node 22)
- npm

## Getting started

```bash
npm install
npm start
```

Then open http://localhost:3000/password-reset.

The app starts with one demo account, `demo@example.com`. In development, emails go to the console, so the reset link shows up in the server output.

### Configuration

| Variable          | Default                  | Purpose                                      |
| ----------------- | ------------------------ | -------------------------------------------- |
| `PORT`            | `3000`                   | HTTP port                                    |
| `APP_BASE_URL`    | `http://localhost:$PORT` | Public base URL used to build reset links    |
| `DEMO_USER_EMAIL` | `demo@example.com`       | Email of the demo account created at startup |

## Running tests

```bash
npm test
```

Tests use Jest and Supertest. They inject in-memory stores, an in-memory email sender and a fake clock.

## How it works

| Route                         | Description                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| `GET /password-reset`         | Form with one email field                                                             |
| `POST /password-reset`        | Checks the email format, then always shows the same message (no account enumeration)  |
| `GET /password-reset/:token`  | New password form, or a redirect to `/password-reset/invalid`                         |
| `POST /password-reset/:token` | Checks the password policy, updates the password and ends all of the user's sessions  |
| `GET /password-reset/invalid` | "Expired or invalid link" page                                                        |

- Reset tokens are 32 random bytes from `crypto.randomBytes`. Only their SHA-256 hash is stored.
- Tokens expire after 15 minutes and work only once. A successful reset also invalidates any other open links for that user.
- Passwords need at least 8 characters, with 1 uppercase letter, 1 number and 1 special character from `!@#$%^&*`. They are hashed with scrypt.
- Password fields are masked, and each one has a Show/Hide toggle.

## Project layout

```
src/
  app.js          createApp(): builds the Express app from injectable dependencies
  server.js       entry point for `npm start`
  routes/         HTTP routes
  services/       password reset logic and validation
  stores/         in-memory user, reset-token and session stores
  email/          console and in-memory email senders
  views/          server-rendered HTML
  lib/            clock, password hashing, HTML escaping
tests/            Jest + Supertest tests
```

To use a different email provider, pass any object with an async `send({ to, subject, text })` method as `emailSender` to `createApp()`.
