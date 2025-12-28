// backend/src/routes/document.routes.js
const router = require("express").Router();
const auth = require("../middleware/auth.middleware");
const docCtrl = require("../controllers/document.controller");

// require authentication for documents
router.use(auth);

// Upload: multipart form field name "file"
router.post("/upload", docCtrl.upload.single("file"), docCtrl.uploadDocument);

// List docs for user
router.get("/", docCtrl.listDocs);

// Get single doc metadata
router.get("/:docId", docCtrl.getDoc);

// Chat with doc
router.post("/:docId/chat", docCtrl.chatWithDocument);

module.exports = router;
