const router = require("express").Router();
const { receiveWebhook } = require("../controllers/webhook.public.controller");

// Public, no auth. Use secret query param or header to authorize
router.post("/:source", receiveWebhook);

module.exports = router;
