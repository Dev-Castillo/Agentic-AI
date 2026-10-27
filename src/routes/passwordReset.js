'use strict';

const express = require('express');
const { INVALID_EMAIL_MESSAGE, isValidEmail } = require('../services/validation');
const views = require('../views/passwordResetViews');

const INVALID_LINK_PATH = '/password-reset/invalid';

function passwordResetRouter(passwordResetService) {
  const router = express.Router();

  router.get('/password-reset', (req, res) => {
    res.send(views.requestFormPage());
  });

  router.post('/password-reset', (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email : '';
    if (!isValidEmail(email)) {
      return res.status(400).send(views.requestFormPage({ email, error: INVALID_EMAIL_MESSAGE }));
    }
    passwordResetService.requestReset(email);
    return res.send(views.requestSubmittedPage());
  });

  router.get(INVALID_LINK_PATH, (req, res) => {
    res.status(410).send(views.invalidLinkPage());
  });

  router.get('/password-reset/:token', (req, res) => {
    const { token } = req.params;
    if (!passwordResetService.findValidToken(token)) {
      return res.redirect(303, INVALID_LINK_PATH);
    }
    return res.send(views.newPasswordFormPage({ token }));
  });

  router.post('/password-reset/:token', (req, res) => {
    const { token } = req.params;
    const result = passwordResetService.resetPassword(token, req.body.password, req.body.confirmPassword);
    if (result.ok) {
      return res.send(views.resetSuccessPage());
    }
    if (result.reason === 'invalid_password') {
      return res.status(400).send(views.newPasswordFormPage({ token, errors: result.errors }));
    }
    return res.redirect(303, INVALID_LINK_PATH);
  });

  return router;
}

module.exports = { passwordResetRouter, INVALID_LINK_PATH };
