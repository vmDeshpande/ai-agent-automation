const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const { createWebhook, listWebhooks, deleteWebhook } = require("../controllers/webhook.controller");

router.use(auth); // admin-only
router.post("/", createWebhook);
router.get("/", listWebhooks);
router.delete("/:id", deleteWebhook);

module.exports = router;
