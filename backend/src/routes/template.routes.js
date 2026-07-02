const router = require("express").Router();
const authMiddleware = require("../middleware/auth.middleware");
const {
  listTemplates,
  getTemplate,
  validateTemplateRoute,
  importTemplate,
} = require("../controllers/template.controller");

router.use(authMiddleware);
router.get("/", listTemplates);
router.get("/:id/validate", validateTemplateRoute);
router.get("/:id", getTemplate);
router.post("/import/:id", importTemplate);

module.exports = router;
