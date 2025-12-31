const express = require("express");
const router = express.Router();
const { getSystemEnvStatus } = require("../controllers/system.controller");
const auth = require("../middleware/auth.middleware");

router.get("/env", auth, getSystemEnvStatus);

module.exports = router;
