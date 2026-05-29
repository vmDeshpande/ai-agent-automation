const pdf = require("pdf-parse");
const multer = require("multer");

const Document = require("../models/document.model");
const DocumentChunk = require("../models/documentChunk.model");
const SystemSettings = require("../models/systemSettings.model");

const { processDocument, queryDocument } = require("../services/documentService");
const { runLLM } = require("../agents/llmAdapter");

const upload = multer({ storage: multer.memoryStorage() });

/* -----------------------------
   Upload Document
----------------------------- */

async function uploadDocument(req, res) {
  try {

    const file = req.file;

    if (!file) {
      return res.status(400).json({
        ok: false,
        error: "file_required"
      });
    }

    const extension = file.originalname.split(".").pop().toLowerCase();

    let text = "";

    /* ---------- PDF ---------- */
    if (extension === "pdf") {

      const pdfData = await pdf(file.buffer);
      text = pdfData.text || "";

    }

    /* ---------- TEXT / MARKDOWN ---------- */
    else if (extension === "txt" || extension === "md") {

      text = file.buffer.toString("utf-8");

    }

    /* ---------- JSON ---------- */
    else if (extension === "json") {

      const json = JSON.parse(file.buffer.toString("utf-8"));
      text = JSON.stringify(json, null, 2);

    }

    /* ---------- CSV ---------- */
    else if (extension === "csv") {

      text = file.buffer.toString("utf-8");

    }

    /* ---------- UNSUPPORTED ---------- */
    else {

      return res.status(400).json({
        ok: false,
        error: "unsupported_file_type"
      });

    }

    if (!text.trim()) {
      return res.status(400).json({
        ok: false,
        error: "empty_document"
      });
    }

    /* ---------- Create document record ---------- */

    const document = await Document.create({
      userId: req.user._id,
      title: file.originalname,
      fileType: extension,
      size: file.size
    });

    /* ---------- Process document (chunk + embed) ---------- */

    const settings = await SystemSettings.findOne({
      userId: req.user._id,
    });

    const chatSettings = settings?.documentChat || {};

    const provider = chatSettings.provider || "ollama";
    const model = chatSettings.model || "gemma3:4b";
    const topK = chatSettings.topK || 3;
    const temperature = chatSettings.temperature ?? 0.2;

    const agent = { config: { provider } };

    await processDocument(agent, document, text);

    res.json({
      ok: true,
      document
    });

  } catch (err) {

    console.error("Document upload error:", err);

    res.status(500).json({
      ok: false,
      error: "upload_failed"
    });

  }
}

/* -----------------------------
   List Documents
----------------------------- */

async function listDocuments(req, res) {

  const docs = await Document.find({
    userId: req.user._id
  }).sort({ createdAt: -1 });

  res.json({
    ok: true,
    documents: docs
  });

}

/* -----------------------------
   Document Chat (RAG)
----------------------------- */

async function chatWithDocument(req, res) {
  try {

    const { documentId, question } = req.body;

    /* ---------- Load user settings ---------- */

    const settings = await SystemSettings.findOne({
      userId: req.user._id,
    });

    const chatSettings = settings?.documentChat || {};

    const provider = chatSettings.provider || "ollama";
    const model = chatSettings.model || "gemma3:4b";
    const topK = chatSettings.topK || 3;
    const temperature = chatSettings.temperature ?? 0.2;

    const agent = { config: { provider } };

    /* ---------- Query vector store ---------- */

    const chunks = await queryDocument(
      agent,
      req.user._id,
      documentId,
      question,
      topK
    );

    const context = chunks.map((c) => c.content).join("\n\n");

    const prompt = `
You are analyzing a document that may contain structured data such as CSV rows or tables.

Each line may represent an entry such as:
Name, Role, Company

Extract information carefully from the rows.

If the question asks for a list, extract all matching rows from the provided context.

If the information cannot be found in the context, say:
"I could not find this information in the document."

CONTEXT:
${context}

QUESTION:
${question}
`;

    /* ---------- Run LLM ---------- */

    const llm = await runLLM(prompt, {
      provider,
      model,
      temperature,
    });

    res.json({
      ok: true,
      answer: llm.text,
    });

  } catch (err) {

    console.error("Document query error:", err);

    res.status(500).json({
      ok: false,
      error: "query_failed",
    });

  }
}

/* -----------------------------
   Delete Document
----------------------------- */

async function deleteDocument(req, res) {

  try {

    const { id } = req.params;

    await Document.deleteOne({
      _id: id,
      userId: req.user._id
    });

    await DocumentChunk.deleteMany({
      documentId: id,
      userId: req.user._id
    });

    res.json({ ok: true });

  } catch (err) {

    console.error("Delete document error:", err);

    res.status(500).json({ ok: false });

  }

}

/* -----------------------------
   Get Single Document
----------------------------- */

async function getDocument(req, res) {

  try {

    const { id } = req.params;

    const document = await Document.findById(id).lean();

    if (!document) {

      return res.status(404).json({
        ok: false,
        error: "Document not found"
      });

    }

    res.json({
      ok: true,
      document
    });

  } catch (err) {

    console.error("Get document error:", err);

    res.status(500).json({
      ok: false,
      error: "fetch_failed"
    });

  }

}

/* ----------------------------- */

module.exports = {
  upload,
  uploadDocument,
  listDocuments,
  getDocument,
  chatWithDocument,
  deleteDocument
};