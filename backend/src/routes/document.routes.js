const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth.middleware");
const { expensiveLimiter } = require("../middleware/rateLimit.middleware");

const {
  upload,
  uploadDocument,
  chatWithDocument,
  getDocument,
  deleteDocument,
  listDocuments
} = require("../controllers/document.controller");

/* Upload document */
router.post("/upload", auth, expensiveLimiter, upload.single("file"), uploadDocument);

/* List user documents */
router.get("/", auth, listDocuments);

/* Chat with a document */
router.post("/chat", auth, expensiveLimiter, chatWithDocument);

/* Delete document */
router.delete("/:id", auth, deleteDocument);

/* Get document info */
router.get("/:id", auth, getDocument);

module.exports = router;