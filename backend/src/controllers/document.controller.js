const pdf = require("pdf-parse");
const multer = require("multer");

const Document = require("../models/document.model");
const DocumentChunk = require("../models/documentChunk.model");
const SystemSettings = require("../models/systemSettings.model");

const { processDocument, queryDocument } = require("../services/documentService");
const { runLLM } = require("../agents/llmAdapter");

const upload = multer({ storage: multer.memoryStorage() });

// A structurally valid 24-character hex string for local auth bypass testing
const MOCK_OBJECT_ID = "64f1fa2b9f1d4b2e8c8b4567";

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

    if (extension === "pdf") {
      const pdfData = await pdf(file.buffer);
      text = pdfData.text || "";
    } else if (extension === "txt" || extension === "md") {
      text = file.buffer.toString("utf-8");
    } else if (extension === "json") {
      const json = JSON.parse(file.buffer.toString("utf-8"));
      text = JSON.stringify(json, null, 2);
    } else if (extension === "csv") {
      text = file.buffer.toString("utf-8");
    } else {
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

    const currentUserId = req.user ? req.user._id : MOCK_OBJECT_ID;

    const document = await Document.create({
      userId: currentUserId,
      title: file.originalname,
      fileType: extension,
      size: file.size
    });

    const settings = await SystemSettings.findOne({ userId: currentUserId });
    const chatSettings = settings?.documentChat || {};
    
    const provider = chatSettings.provider && chatSettings.provider !== "ollama" ? chatSettings.provider : "gemini";
    const agent = { 
      config: { 
        provider: provider,
        embeddingProvider: "gemini"
      } 
    };

    await processDocument(agent, document, text);

    res.json({ ok: true, document });
  } catch (err) {
    console.error("Document upload error:", err);
    res.status(500).json({ ok: false, error: "upload_failed" });
  }
}

/* -----------------------------
   List Documents
----------------------------- */

async function listDocuments(req, res) {
  const currentUserId = req.user ? req.user._id : MOCK_OBJECT_ID;
  const docs = await Document.find({ userId: currentUserId }).sort({ createdAt: -1 });
  res.json({ ok: true, documents: docs });
}

/* -----------------------------
   Document Chat (RAG) - Multi-Document Support
----------------------------- */

async function chatWithDocument(req, res) {
  try {
    const { documentIds, question, message } = req.body;
    const finalQuestion = question || message;

    if (!finalQuestion) {
      return res.status(400).json({
        ok: false,
        error: "missing_question",
        message: "Please provide a question or message string parameter."
      });
    }

    const currentUserId = req.user ? req.user._id : MOCK_OBJECT_ID;

    const settings = await SystemSettings.findOne({ userId: currentUserId });
    const chatSettings = settings?.documentChat || {};

    const provider = "gemini";
    const model = "models/gemini-1.5-flash";
    const topK = chatSettings.topK || 3;
    const temperature = chatSettings.temperature ?? 0.2;

    const agent = { config: { provider } };

    const chunks = await queryDocument(
      agent,
      currentUserId,
      documentIds || [],
      finalQuestion,
      topK
    );

    const context = chunks && chunks.length > 0
      ? chunks.map((c) => `[Source: Document ID ${c.documentId}]\n${c.content}`).join("\n\n")
      : "No contextual data segments match the matching document identifiers.";

    const prompt = `
You are analyzing documents. Some may contain structured data such as CSV rows or tables.

If the information cannot be found in the context, say:
"I could not find this information in the document(s)."

CONTEXT:
${context}

QUESTION:
${finalQuestion}
`;

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
    const currentUserId = req.user ? req.user._id : MOCK_OBJECT_ID;
    
    await Document.deleteOne({ _id: id, userId: currentUserId });
    await DocumentChunk.deleteMany({ documentId: id, userId: currentUserId });
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
      return res.status(404).json({ ok: false, error: "Document not found" });
    }
    res.json({ ok: true, document });
  } catch (err) {
    console.error("Get document error:", err);
    res.status(500).json({ ok: false, error: "fetch_failed" });
  }
}

module.exports = {
  upload,
  uploadDocument,
  listDocuments,
  getDocument,
  chatWithDocument,
  deleteDocument
};