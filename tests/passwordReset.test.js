'use strict';

const request = require('supertest');
const { verifyPassword } = require('../src/lib/passwordHasher');
const { hashToken, RESET_TOKEN_TTL_MS } = require('../src/services/passwordResetService');
const { validatePassword } = require('../src/services/validation');
const { USER_EMAIL, OLD_PASSWORD, setup, flushEmails, extractResetPath } = require('./helpers');

const RESET_REQUESTED_MESSAGE = 'If an account exists for this email, a reset link has been sent.';
const INVALID_EMAIL_MESSAGE = 'Please enter a valid email address.';
const VALID_NEW_PASSWORD = 'NewPassw0rd!';

async function requestResetLink(ctx, email = USER_EMAIL) {
  await request(ctx.app).post('/password-reset').type('form').send({ email }).expect(200);
  await flushEmails();
  return extractResetPath(ctx.emailSender.sent[ctx.emailSender.sent.length - 1]);
}

function submitNewPassword(ctx, resetPath, password, confirmPassword = password) {
  return request(ctx.app).post(resetPath).type('form').send({ password, confirmPassword });
}

describe('Password reset request form', () => {
  // AC1
  test('AC1: the reset form has a single input field, for the email address', async () => {
    const { app } = setup();
    const res = await request(app).get('/password-reset').expect(200);

    const inputs = res.text.match(/<input\b[^>]*>/g) || [];
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatch(/name="email"/);
    expect(inputs[0]).toMatch(/type="email"/);
    expect(res.text).toMatch(/<form method="post" action="\/password-reset"/);
  });

  // AC2
  test.each([['janeexample.com'], ['jane@'], ['jane@example'], ['@example.com'], ['jane doe@example.com'], ['']])(
    'AC2: invalid email %p shows the inline error and sends no email',
    async (email) => {
      const { app, emailSender } = setup();
      const res = await request(app).post('/password-reset').type('form').send({ email }).expect(400);
      await flushEmails();

      expect(res.text).toContain(INVALID_EMAIL_MESSAGE);
      expect(res.text).toMatch(/<p id="email-error"[^>]*role="alert"/);
      expect(res.text).not.toContain(RESET_REQUESTED_MESSAGE);
      expect(emailSender.sent).toHaveLength(0);
    },
  );

  test('AC2: the submitted value is kept and HTML-escaped in the re-rendered form', async () => {
    const { app } = setup();
    const res = await request(app).post('/password-reset').type('form').send({ email: '<b>x' }).expect(400);
    expect(res.text).toContain('value="&lt;b&gt;x"');
  });

  // AC3
  test('AC3: shows the same confirmation for registered and unregistered emails', async () => {
    const ctx = setup();
    const registered = await request(ctx.app).post('/password-reset').type('form').send({ email: USER_EMAIL });
    const unknown = await request(ctx.app)
      .post('/password-reset')
      .type('form')
      .send({ email: 'nobody@example.com' });
    await flushEmails();

    expect(registered.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(registered.text).toContain(RESET_REQUESTED_MESSAGE);
    expect(unknown.text).toBe(registered.text);
    expect(ctx.emailSender.sent).toHaveLength(1);
    expect(ctx.emailSender.sent[0].to).toBe(USER_EMAIL);
  });

  test('AC3: email lookup ignores case and surrounding whitespace', async () => {
    const ctx = setup();
    await request(ctx.app).post('/password-reset').type('form').send({ email: '  JANE@Example.com ' }).expect(200);
    await flushEmails();
    expect(ctx.emailSender.sent).toHaveLength(1);
  });

  test('stores only a hash of the reset token', async () => {
    const ctx = setup();
    const resetPath = await requestResetLink(ctx);
    const rawToken = resetPath.split('/').pop();

    expect(ctx.tokenStore.findByHash(rawToken)).toBeNull();
    const record = ctx.tokenStore.findByHash(hashToken(rawToken));
    expect(record).toMatchObject({ userId: ctx.user.id, usedAt: null });
    expect(JSON.stringify([...ctx.tokenStore.tokensByHash.values()])).not.toContain(rawToken);
  });
});

describe('Reset link validity', () => {
  // AC4
  test('AC4: the link works just before 15 minutes have passed', async () => {
    const ctx = setup();
    const resetPath = await requestResetLink(ctx);
    ctx.clock.advance(RESET_TOKEN_TTL_MS - 1);

    await request(ctx.app).get(resetPath).expect(200);
  });

  test('AC4: the link expires after 15 minutes', async () => {
    const ctx = setup();
    const resetPath = await requestResetLink(ctx);
    ctx.clock.advance(15 * 60 * 1000);

    const getRes = await request(ctx.app).get(resetPath).expect(303);
    expect(getRes.headers.location).toBe('/password-reset/invalid');

    const postRes = await submitNewPassword(ctx, resetPath, VALID_NEW_PASSWORD).expect(303);
    expect(postRes.headers.location).toBe('/password-reset/invalid');
    expect(verifyPassword(OLD_PASSWORD, ctx.userStore.findById(ctx.user.id).passwordHash)).toBe(true);
  });

  // AC5
  test('AC5: the link works only once; later clicks redirect to the error page', async () => {
    const ctx = setup();
    const resetPath = await requestResetLink(ctx);

    await request(ctx.app).get(resetPath).expect(200);
    await submitNewPassword(ctx, resetPath, VALID_NEW_PASSWORD).expect(200);

    const again = await request(ctx.app).get(resetPath).expect(303);
    expect(again.headers.location).toBe('/password-reset/invalid');

    const reuse = await submitNewPassword(ctx, resetPath, 'Another1!').expect(303);
    expect(reuse.headers.location).toBe('/password-reset/invalid');
    expect(verifyPassword(VALID_NEW_PASSWORD, ctx.userStore.findById(ctx.user.id).passwordHash)).toBe(true);
  });

  test('AC5: the error page says "Expired or invalid link"', async () => {
    const { app } = setup();
    const res = await request(app).get('/password-reset/invalid').expect(410);
    expect(res.text).toContain('Expired or invalid link');
    expect(res.text).toContain('href="/password-reset"');
  });

  test('AC5: an unknown or malformed token redirects to the error page', async () => {
    const { app } = setup();
    for (const path of [`/password-reset/${'a'.repeat(64)}`, '/password-reset/not-a-token']) {
      const res = await request(app).get(path).expect(303);
      expect(res.headers.location).toBe('/password-reset/invalid');
    }
  });

  test('AC5: a successful reset also invalidates other outstanding links for the user', async () => {
    const ctx = setup();
    const firstPath = await requestResetLink(ctx);
    const secondPath = await requestResetLink(ctx);

    await submitNewPassword(ctx, secondPath, VALID_NEW_PASSWORD).expect(200);
    const res = await request(ctx.app).get(firstPath).expect(303);
    expect(res.headers.location).toBe('/password-reset/invalid');
  });

  test('a rejected password does not use up the link', async () => {
    const ctx = setup();
    const resetPath = await requestResetLink(ctx);

    await submitNewPassword(ctx, resetPath, 'weak').expect(400);
    await request(ctx.app).get(resetPath).expect(200);
  });
});

describe('New password', () => {
  // AC6
  test.each([
    ['Ab1!xyz', 'Password must be at least 8 characters long.'],
    ['abcdefg1!', 'Password must contain at least 1 uppercase letter.'],
    ['Abcdefgh!', 'Password must contain at least 1 number.'],
    ['Abcdefgh1', 'Password must contain at least 1 special character (!@#$%^&amp;*).'],
    ['Abcdefgh1?', 'Password must contain at least 1 special character (!@#$%^&amp;*).'],
  ])('AC6: rejects %p with a clear message and keeps the old password', async (password, message) => {
    const ctx = setup();
    const resetPath = await requestResetLink(ctx);

    const res = await submitNewPassword(ctx, resetPath, password).expect(400);
    expect(res.text).toContain(message);
    expect(verifyPassword(OLD_PASSWORD, ctx.userStore.findById(ctx.user.id).passwordHash)).toBe(true);
  });

  test.each(['!', '@', '#', '$', '%', '^', '&', '*'])(
    'AC6: accepts the special character %p',
    (special) => {
      expect(validatePassword(`Abcdefg1${special}`)).toEqual([]);
    },
  );

  test('AC6: a valid password is saved', async () => {
    const ctx = setup();
    const resetPath = await requestResetLink(ctx);

    const res = await submitNewPassword(ctx, resetPath, 'Abcdef1!').expect(200);
    expect(res.text).toContain('Your password has been updated');
    const { passwordHash } = ctx.userStore.findById(ctx.user.id);
    expect(passwordHash).not.toContain('Abcdef1!');
    expect(verifyPassword('Abcdef1!', passwordHash)).toBe(true);
    expect(verifyPassword(OLD_PASSWORD, passwordHash)).toBe(false);
  });

  test('rejects a confirmation that does not match', async () => {
    const ctx = setup();
    const resetPath = await requestResetLink(ctx);

    const res = await submitNewPassword(ctx, resetPath, VALID_NEW_PASSWORD, 'Different1!').expect(400);
    expect(res.text).toContain('Passwords do not match.');
  });

  // AC7
  test('AC7: password fields are masked by default and each has a show/hide toggle', async () => {
    const ctx = setup();
    const resetPath = await requestResetLink(ctx);
    const res = await request(ctx.app).get(resetPath).expect(200);

    const inputs = res.text.match(/<input\b[^>]*>/g) || [];
    expect(inputs).toHaveLength(2);
    inputs.forEach((input) => expect(input).toMatch(/type="password"/));
    expect(res.text).not.toMatch(/<input\b[^>]*type="text"/);

    for (const id of ['password', 'confirmPassword']) {
      expect(res.text).toMatch(
        new RegExp(`<button type="button" class="toggle-password" data-target="${id}"[^>]*>Show</button>`),
      );
    }
    expect(res.text).toContain("input.type = show ? 'text' : 'password'");
  });

  test('AC7: password fields stay masked when the form is re-rendered with errors', async () => {
    const ctx = setup();
    const resetPath = await requestResetLink(ctx);
    const res = await submitNewPassword(ctx, resetPath, 'weak').expect(400);

    const inputs = res.text.match(/<input\b[^>]*>/g) || [];
    expect(inputs).toHaveLength(2);
    inputs.forEach((input) => {
      expect(input).toMatch(/type="password"/);
      expect(input).not.toMatch(/value=/);
    });
  });
});

describe('Sessions', () => {
  // AC8
  test('AC8: a successful password update ends all sessions of the user on every device', async () => {
    const ctx = setup();
    const otherUser = ctx.userStore.create({ email: 'other@example.com', passwordHash: 'x' });
    ctx.sessionStore.create(ctx.user.id, { device: 'laptop' });
    ctx.sessionStore.create(ctx.user.id, { device: 'phone' });
    ctx.sessionStore.create(ctx.user.id, { device: 'tablet' });
    const otherSession = ctx.sessionStore.create(otherUser.id, { device: 'laptop' });

    const resetPath = await requestResetLink(ctx);
    await submitNewPassword(ctx, resetPath, VALID_NEW_PASSWORD).expect(200);

    expect(ctx.sessionStore.listForUser(ctx.user.id)).toHaveLength(0);
    expect(ctx.sessionStore.findById(otherSession.id)).not.toBeNull();
  });

  test('AC8: a failed password update leaves sessions intact', async () => {
    const ctx = setup();
    ctx.sessionStore.create(ctx.user.id, { device: 'laptop' });

    const resetPath = await requestResetLink(ctx);
    await submitNewPassword(ctx, resetPath, 'weak').expect(400);

    expect(ctx.sessionStore.listForUser(ctx.user.id)).toHaveLength(1);
  });
});
