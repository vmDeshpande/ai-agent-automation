const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const { chatWithAssistant } = require("../controllers/assistant.controller");

router.post("/chat", auth, chatWithAssistant);

module.exports = router;
