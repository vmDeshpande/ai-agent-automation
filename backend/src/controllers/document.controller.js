// backend/src/controllers/document.controller.js
const fs = require("fs");
const path = require("path");
const pdf = require("pdf-parse");
const multer = require("multer");
const { embedText } = require("../services/embeddingService");
const { saveDocument, newId, listDocumentsByUser, getDocument, addChunksToDocument, queryTopK } = require("../services/vectorStore");
const { runLLM } = require("../agents/llmAdapter"); // use your LLM adapter

// multer storage (in-memory)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

/** Helper: chunk text into pieces ~ chunkSize chars with overlap */
function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + chunkSize);
    const piece = text.slice(i, end).trim();
    if (piece) chunks.push(piece);
    i += chunkSize - overlap;
  }
  return chunks;
}

/** POST /api/documents/upload (multipart form 'file') */
async function uploadDocument(req, res) {
  try {
    // multer middleware puts file on req.file
    const file = req.file;
    if (!file) return res.status(400).json({ ok: false, error: "file_required" });

    // create docId and runtime dir
    const docId = newId("doc_");
    const runtimeDir = path.join(process.cwd(), "runtime", "docs", docId);
    fs.mkdirSync(runtimeDir, { recursive: true });

    // save raw file
    const filename = file.originalname || `${docId}.pdf`;
    const filePath = path.join(runtimeDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    // extract text from pdf using pdf-parse
    const pdfData = await pdf(file.buffer);
    const text = (pdfData && pdfData.text) ? pdfData.text : "";

    // chunk text
    const chunks = chunkText(text, 1200, 200);

    // embed each chunk (sequential to avoid big memory spikes)
    const savedChunks = [];
    for (let idx = 0; idx < chunks.length; idx++) {
      const ctext = chunks[idx];
      const embedding = await embedText(ctext);
      savedChunks.push({
        id: newId("chunk_"),
        text: ctext,
        embedding,
        order: idx
      });
    }

    // Save doc metadata and chunks to vector store
    const doc = {
      docId,
      userId: req.user ? String(req.user._id) : null,
      filename,
      filepath: filePath,
      createdAt: Date.now(),
      chunks: savedChunks
    };
    saveDocument(doc);

    return res.status(201).json({ ok: true, docId, doc });
  } catch (err) {
    console.error("uploadDocument error", err);
    return res.status(500).json({ ok: false, error: "server_error", detail: err.message });
  }
}

/** GET /api/documents (list current user's documents) */
async function listDocs(req, res) {
  try {
    const docs = listDocumentsByUser(String(req.user._id));
    return res.json({ ok: true, docs });
  } catch (err) {
    console.error("listDocs error", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

/** GET /api/documents/:docId (get metadata) */
async function getDoc(req, res) {
  try {
    const doc = getDocument(req.params.docId);
    if (!doc) return res.status(404).json({ ok: false, error: "not_found" });
    if (doc.userId !== String(req.user._id)) return res.status(403).json({ ok: false, error: "forbidden" });
    return res.json({ ok: true, doc });
  } catch (err) {
    console.error("getDoc error", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

/**
 * POST /api/documents/:docId/chat
 * body: { question: string, topK?: number }
 */
async function chatWithDocument(req, res) {
  try {
    const { question, topK = 4 } = req.body;
    if (!question) return res.status(400).json({ ok: false, error: "question_required" });

    const doc = getDocument(req.params.docId);
    if (!doc) return res.status(404).json({ ok: false, error: "not_found" });
    if (doc.userId !== String(req.user._id)) return res.status(403).json({ ok: false, error: "forbidden" });

    // embed question
    const qEmb = await embedText(question);

    // retrieve topK chunks
    const hits = queryTopK(req.params.docId, qEmb, topK);
    const contextText = hits.map((h, i) => `---\nContext ${i+1} (score=${(h.score||0).toFixed(3)}):\n${h.chunk.text}\n`).join("\n");

    // build prompt for LLM (you can modify this prompt template)
    const prompt = `You are an assistant that answers questions using the provided document context. 
Do not hallucinate. If the answer is not in the context, say you don't know.
Context:
${contextText}

Question:
${question}

Answer concisely (in 1-3 paragraphs). Also provide which context chunks were used (ids).`;

    // call your existing runLLM adapter to get answer
    const llmResponse = await runLLM(prompt, { max_tokens: 512 });

    // format response
    const answerText = (llmResponse && (llmResponse.text || llmResponse.output || llmResponse)) ? (llmResponse.text || llmResponse.output || String(llmResponse)) : "";

    return res.json({
      ok: true,
      answer: answerText,
      raw: llmResponse,
      sources: hits.map(h => ({ id: h.chunk.id, score: h.score }))
    });
  } catch (err) {
    console.error("chatWithDocument error", err);
    return res.status(500).json({ ok: false, error: "server_error", detail: err.message });
  }
}

// Export multer middleware where needed
module.exports = {
  upload, // use as middleware: upload.single('file')
  uploadDocument,
  listDocs,
  getDoc,
  chatWithDocument
};
