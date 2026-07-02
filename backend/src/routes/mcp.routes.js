const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const {
  getServers,
  getTools,
  getHealth,
  invoke,
} = require("../controllers/mcp.controller");

router.use(auth);

router.get("/servers", getServers);
router.get("/tools", getTools);
router.get("/health", getHealth);
router.post("/tools/:serverId/:toolName/invoke", invoke);

module.exports = router;
