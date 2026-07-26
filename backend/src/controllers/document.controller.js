const pdf = require('pdf-parse');
const multer = require('multer');
const mongoose = require('mongoose');

const Document = require('../models/document.model');
const DocumentChunk = require('../models/documentChunk.model');
const SystemSettings = require('../models/systemSettings.model');

const { processDocument, queryDocuments } = require('../services/documentService');
const { runLLM } = require('../agents/llmAdapter');

const upload = multer({ storage: multer.memoryStorage() });
const MAX_SELECTED_DOCUMENTS = 10;
const MAX_RAG_CONTEXT_CHARS = 12000;
const DOCUMENT_PROCESSING_TIMEOUT_MS = 2 * 60 * 1000;

function safeProcessingError(error) {
  if (!error) return 'Document processing failed';

  const message = error instanceof Error ? error.message : String(error);

  return message.slice(0, 500) || 'Document processing failed';
}

function withTimeout(promise, timeoutMs) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Document processing timed out'));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/* -----------------------------
   Upload Document
----------------------------- */

async function uploadDocument(req, res) {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        ok: false,
        error: 'file_required',
      });
    }

    const extension = file.originalname.split('.').pop().toLowerCase();

    let text = '';

    /* ---------- PDF ---------- */
    if (extension === 'pdf') {
      const pdfData = await pdf(file.buffer);
      text = pdfData.text || '';
    } else if (extension === 'txt' || extension === 'md') {
      /* ---------- TEXT / MARKDOWN ---------- */
      text = file.buffer.toString('utf-8');
    } else if (extension === 'json') {
      /* ---------- JSON ---------- */
      const json = JSON.parse(file.buffer.toString('utf-8'));
      text = JSON.stringify(json, null, 2);
    } else if (extension === 'csv') {
      /* ---------- CSV ---------- */
      text = file.buffer.toString('utf-8');
    } else {
      /* ---------- UNSUPPORTED ---------- */
      return res.status(400).json({
        ok: false,
        error: 'unsupported_file_type',
      });
    }

    if (!text.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'empty_document',
      });
    }

    /* ---------- Create document record ---------- */

    const document = await Document.create({
      userId: req.user._id,
      title: file.originalname,
      fileType: extension,
      size: file.size,
      status: 'processing',
      processingStartedAt: new Date(),
      processingStep: 'Queued',
      processedChunks: 0,
      totalChunks: 0,
      processingError: undefined,
    });

    /* ---------- Process document (chunk + embed) ---------- */

    const settings = await SystemSettings.findOne({
      userId: req.user._id,
    });

    const chatSettings = settings?.documentChat || {};

    const provider = chatSettings.provider || 'ollama';
    const model = chatSettings.model || 'gemma3:4b';
    const topK = chatSettings.topK || 3;
    const temperature = chatSettings.temperature ?? 0.2;

    const agent = { config: { provider } };

    try {
      await Document.findByIdAndUpdate(document._id, {
        processingStep: 'Extracting text',
      });

      await withTimeout(processDocument(agent, document, text), DOCUMENT_PROCESSING_TIMEOUT_MS);
    } catch (processingError) {
      await Document.findByIdAndUpdate(document._id, {
        status: 'failed',
        processingStep: 'Failed',
        processingError: safeProcessingError(processingError),
        processedAt: new Date(),
      });

      throw processingError;
    }

    res.json({
      ok: true,
      document,
    });
  } catch (err) {
    console.error('Document upload error:', err);

    res.status(500).json({
      ok: false,
      error: 'upload_failed',
    });
  }
}

/* -----------------------------
   List Documents
----------------------------- */

async function listDocuments(req, res) {
  const docs = await Document.find({
    userId: req.user._id,
  }).sort({ createdAt: -1 });

  res.json({
    ok: true,
    documents: docs,
  });
}

/* -----------------------------
   Document Chat (RAG)
----------------------------- */

async function chatWithDocument(req, res) {
  try {
    const {
      documentId,
      documentIds,
      question,
      strategy = 'auto',
    } = req.body;

    if (typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({
        ok: false,
        error: 'question_required',
      });
    }

    const requestedDocumentIds = Array.isArray(documentIds) ? documentIds : [documentId];

    const selectedDocumentIds = [
      ...new Set(requestedDocumentIds.filter(Boolean).map((id) => id.toString())),
    ];

    if (!selectedDocumentIds.length) {
      return res.status(400).json({
        ok: false,
        error: 'document_required',
      });
    }

    if (selectedDocumentIds.length > MAX_SELECTED_DOCUMENTS) {
      return res.status(400).json({
        ok: false,
        error: 'too_many_documents',
      });
    }

    const hasInvalidDocumentId = selectedDocumentIds.some(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );

    if (hasInvalidDocumentId) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_document_id',
      });
    }

    const documents = await Document.find({
      _id: { $in: selectedDocumentIds },
      userId: req.user._id,
    }).lean();

    if (documents.length !== selectedDocumentIds.length) {
      return res.status(404).json({
        ok: false,
        error: 'Document not found',
      });
    }

    const hasFailedDocument = documents.some((document) => document.status === 'failed');

    if (hasFailedDocument) {
      return res.status(400).json({
        ok: false,
        error: 'document_processing_failed',
      });
    }

    const hasNonReadyDocument = documents.some((document) => document.status !== 'ready');

    if (hasNonReadyDocument) {
      return res.status(400).json({
        ok: false,
        error: 'document_not_ready',
      });
    }

    const trimmedQuestion = question.trim();
    const documentTitleById = new Map(
      documents.map((document) => [
        document._id.toString(),
        document.title || document.name || 'Untitled document',
      ])
    );

    /* ---------- Load user settings ---------- */

    const settings = await SystemSettings.findOne({
      userId: req.user._id,
    });

    const chatSettings = settings?.documentChat || {};

    const provider = chatSettings.provider || 'ollama';
    const model = chatSettings.model || 'gemma3:4b';
    const topK = chatSettings.topK || 3;
    const temperature = chatSettings.temperature ?? 0.2;

    const agent = { config: { provider } };

    /* ---------- Query vector store ---------- */

    const chunks = await queryDocuments(
      agent,
      req.user._id,
      selectedDocumentIds,
      trimmedQuestion,
      topK,
      strategy
    );

    if (!chunks.length) {
      return res.json({
        ok: true,
        answer: 'I could not find relevant information in the selected document(s).',
        sources: [],
        documentIds: selectedDocumentIds,
      });
    }

    const enrichedChunks = chunks.map((chunk) => {
      const chunkDocumentId = chunk.documentId.toString();

      return {
        _id: chunk._id,
        documentId: chunkDocumentId,
        title: documentTitleById.get(chunkDocumentId) || 'Untitled document',
        chunkIndex: chunk.chunkIndex,
        score: chunk.score,
        content: chunk.content,
      };
    });

    const contextBlocks = [];
    const includedChunks = [];
    let contextLength = 0;

    for (const chunk of enrichedChunks) {
      const separator = contextBlocks.length ? '\n\n---\n\n' : '';
      const header = `[${chunk.title}]
Chunk ${chunk.chunkIndex}
`;
      let content = chunk.content || '';
      let block = `${header}${content}`;
      let nextLength = contextLength + separator.length + block.length;

      if (nextLength > MAX_RAG_CONTEXT_CHARS) {
        if (contextBlocks.length > 0) {
          break;
        }

        // If the top chunk alone is too large, include a truncated version within the context budget.
        const availableContentLength = Math.max(
          MAX_RAG_CONTEXT_CHARS - separator.length - header.length,
          0
        );

        content = content.slice(0, availableContentLength).trim();
        block = `${header}${content}`;
        nextLength = contextLength + separator.length + block.length;
      }

      contextBlocks.push(`${separator}${block}`);
      includedChunks.push({
        ...chunk,
        content,
      });
      contextLength = nextLength;
    }

    const context = contextBlocks.join('');

    const seenSources = new Set();
    const sources = includedChunks
      .filter((chunk) => {
        const sourceKey = chunk._id
          ? chunk._id.toString()
          : `${chunk.documentId}:${chunk.chunkIndex}`;

        if (seenSources.has(sourceKey)) {
          return false;
        }

        seenSources.add(sourceKey);
        return true;
      })
      .map((chunk) => ({
        documentId: chunk.documentId,
        title: chunk.title,
        chunkIndex: chunk.chunkIndex,
        score: typeof chunk.score === 'number' ? Number(chunk.score.toFixed(4)) : chunk.score,
      }));

    const prompt = `
You are analyzing one or more selected documents using only the provided context.

Answer only from the context. If the answer is not present, say you could not find the information in the selected document(s).

When multiple documents are relevant, synthesize across them and use document names naturally when comparing or attributing claims.

Do not invent information or rely on knowledge outside the context.

The context may contain structured data such as CSV rows or tables.

CSV:

* Detect columns
* Detect rows
* Treat rows as records

JSON:

* Detect objects
* Detect arrays
* Understand key/value relationships

Markdown:

* Detect headings
* Detect sections
* Detect lists and code blocks

PDF:

* Understand sections, tables, paragraphs, and reports

TXT:

* Understand the document as natural language text

Logs:

* Detect timestamps
* Detect events
* Detect errors and warnings

---

## STEP 2: HANDLE GENERAL QUESTIONS

If the user asks:

* What is this?
* Explain this document
* Summarize this
* What does this contain?
* Describe this file
* What am I looking at?

Provide:

1. Document type
2. Main purpose
3. Key sections
4. Important information
5. Short summary

Never answer:

CONTEXT:
${context}

QUESTION:
${trimmedQuestion}
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
      sources,
      documentIds: selectedDocumentIds,
    });
  } catch (err) {
    console.error('Document query error:', err);

    if (
      err.message &&
      err.message.includes('Retrieval strategy')
    ) {
      return res.status(400).json({
        ok: false,
        error: 'invalid_retrieval_strategy',
        message: err.message,
      });
    }

    res.status(500).json({
      ok: false,
      error: 'query_failed',
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
      userId: req.user._id,
    });

    await DocumentChunk.deleteMany({
      documentId: id,
      userId: req.user._id,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete document error:', err);

    res.status(500).json({ ok: false });
  }
}

/* -----------------------------
   Get Single Document
----------------------------- */

async function getDocument(req, res) {
  try {
    const { id } = req.params;

    const document = await Document.findOne({
      _id: id,
      userId: req.user._id,
    }).lean();

    if (!document) {
      return res.status(404).json({
        ok: false,
        error: 'Document not found',
      });
    }

    res.json({
      ok: true,
      document,
    });
  } catch (err) {
    console.error('Get document error:', err);

    res.status(500).json({
      ok: false,
      error: 'fetch_failed',
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
  deleteDocument,
};
