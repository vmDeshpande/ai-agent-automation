const router = require("express").Router();
const authMiddleware = require("../middleware/auth.middleware");
const {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask
} = require("../controllers/task.controller");

router.post("/", authMiddleware, createTask);
router.get("/", authMiddleware, listTasks);
router.get("/:id", authMiddleware, getTask);
router.put("/:id", authMiddleware, updateTask);
router.delete("/:id", authMiddleware, deleteTask);

module.exports = router;
