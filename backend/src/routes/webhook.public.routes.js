const express = require('express');
const router = express.Router();

const { receiveWebhook } = require('../controllers/webhook.public.controller');

const WEBHOOK_BODY_LIMIT = '1mb';

const webhookJsonParser = express.json({ limit: WEBHOOK_BODY_LIMIT });
const webhookUrlencodedParser = express.urlencoded({
  limit: WEBHOOK_BODY_LIMIT,
  extended: true,
});

function handleBodyParseError(err, req, res, next) {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      ok: false,
      error: 'payload_too_large',
      maxBytes: WEBHOOK_BODY_LIMIT,
    });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      ok: false,
      error: 'invalid_json',
    });
  }
  return next(err);
}

router.post(
  '/:source',
  (req, res, next) => {
    const contentType = (req.headers['content-type'] || '').toLowerCase();
    if (contentType.startsWith('application/x-www-form-urlencoded')) {
      return webhookUrlencodedParser(req, res, (err) => handleBodyParseError(err, req, res, next));
    }
    return webhookJsonParser(req, res, (err) => handleBodyParseError(err, req, res, next));
  },
  receiveWebhook
);

module.exports = router;
