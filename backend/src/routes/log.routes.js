const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const { listLogs } = require("../controllers/log.controller");

router.get("/", auth, listLogs);

module.exports = router;
