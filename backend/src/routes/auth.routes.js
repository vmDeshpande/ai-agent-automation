const router = require("express").Router();
const { register, login, me } = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");
const { authLimiter } = require("../middleware/rateLimit.middleware");

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", authMiddleware, me);

module.exports = router;
