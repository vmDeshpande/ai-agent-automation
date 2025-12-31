const router = require("express").Router();
const { getSettings, updateSettings } = require("../controllers/settings.controller");
const auth = require("../middleware/auth.middleware");

router.get("/", auth, getSettings);
router.put("/", auth, updateSettings);

module.exports = router;
