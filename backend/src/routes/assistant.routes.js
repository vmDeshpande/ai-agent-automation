const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const { chatWithAssistant } = require("../controllers/assistant.controller");
const { expensiveLimiter } = require("../middleware/rateLimit.middleware");

router.post("/chat", auth, expensiveLimiter, chatWithAssistant);

module.exports = router;
