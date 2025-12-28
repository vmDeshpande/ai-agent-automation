// src/routes/schedule.routes.js
const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const { createSchedule, listSchedules, getSchedule, updateSchedule, deleteSchedule } = require("../controllers/schedule.controller");

router.use(auth);

router.post("/", createSchedule);
router.get("/", listSchedules);
router.get("/:id", getSchedule);
router.put("/:id", updateSchedule);
router.delete("/:id", deleteSchedule);

module.exports = router;
