const router = require('express').Router();
const { receiveAgentMessage } = require('../controllers/a2a.webhook.controller');

router.post('/:teamId', receiveAgentMessage);

module.exports = router;
