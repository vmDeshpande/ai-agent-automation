const pdf = require('pdf-parse');
const multer = require('multer');

const Document = require('../models/document.model');
const DocumentChunk = require('../models/documentChunk.model');
const SystemSettings = require('../models/systemSettings.model');

const { processDocument, queryDocument } = require('../services/documentService');
const { runLLM } = require('../agents/llmAdapter');

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

    await processDocument(agent, document, text);

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
    const { documentId, question } = req.body;

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

    const chunks = await queryDocument(agent, req.user._id, documentId, question, topK);

    const context = chunks.map((c) => c.content).join('\n\n');

    const prompt = `
You are an advanced document analysis assistant.

Your task is to answer questions using ONLY the provided document content.

The document may originate from:

* PDF
* CSV
* Excel spreadsheets
* TXT files
* Markdown files
* JSON files
* Log files
* Reports
* Tables
* Database exports
* Configuration files
* Mixed structured and unstructured content

---

## STEP 1: UNDERSTAND THE DOCUMENT

Before answering, determine:

* Document type
* Overall purpose
* Main topics
* Structure of the content

Examples:

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

"I could not find this information in the document."

for these document-level questions.

---

## STEP 3: HANDLE SEARCH QUESTIONS

Answer questions using information found in the document.

Examples:

* Who is listed?
* What companies appear?
* What is the total?
* What errors occurred?
* What settings are configured?

Extract the relevant information directly from the document.

---

## STEP 4: HANDLE TABLES AND CSV DATA

When the document contains tabular data:

* Identify headers
* Understand column meanings
* Treat each row as a record

Example:

Name,Role,Company

John,Developer,OpenAI

means:

Name = John
Role = Developer
Company = OpenAI

Use this structure when answering questions.

---

## STEP 5: HANDLE JSON FILES

When the document contains JSON:

* Understand nested objects
* Understand arrays
* Understand relationships between keys

Provide human-readable explanations.

Example:

{
"name": "John",
"role": "Developer"
}

Answer:

John's role is Developer.

---

## STEP 6: HANDLE MARKDOWN FILES

Use headings and document structure.

Understand:

* Titles
* Sections
* Bullet lists
* Tables
* Code blocks

Answer based on the logical structure of the document.

---

## STEP 7: HANDLE CODE FILES

If the document contains source code:

* Explain functionality
* Identify classes
* Identify functions
* Identify APIs
* Explain architecture when asked

Do not invent behavior that is not present.

---

## STEP 8: HANDLE LIST QUESTIONS

If the user asks:

* List all
* Show all
* Give every
* Find all entries

Return every matching result found in the document.

Do not stop after the first match.

---

## STEP 9: HANDLE AMBIGUOUS QUESTIONS

If a question uses vague references such as:

* this
* that
* it
* these
* those

Infer the most likely meaning from:

1. The document content
2. The document structure
3. The conversation context

If the meaning is still unclear, explain the most likely interpretation instead of immediately claiming the information is missing.

---

## STEP 10: TRUTHFULNESS

Use only information present in the document.

Do not invent facts.

If the requested information genuinely does not exist in the document, respond:

"I could not find that information in the document."

---

## DOCUMENT CONTENT

${context}

---

## USER QUESTION

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
    console.error('Document query error:', err);

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
