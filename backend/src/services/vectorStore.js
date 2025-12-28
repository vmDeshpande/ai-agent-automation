// backend/src/services/vectorStore.js
// Simple JSON vector DB stored at runtime/vector-db.json
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DB_PATH = path.join(process.cwd(), "runtime", "vector-db.json");

function ensureDB() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ documents: [] }, null, 2));
}

function loadDB() {
  ensureDB();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function saveDB(db) {
  ensureDB();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function newId(prefix = "") {
  return prefix + crypto.randomBytes(8).toString("hex");
}

/**
 * Save a document entry
 * doc: { docId, userId, filename, chunks: [{ id, text, embedding }] , createdAt }
 */
function saveDocument(doc) {
  const db = loadDB();
  db.documents = db.documents || [];
  const existing = db.documents.find((d) => d.docId === doc.docId);
  if (existing) {
    // replace
    Object.assign(existing, doc);
  } else {
    db.documents.push(doc);
  }
  saveDB(db);
}

/** Get document by id */
function getDocument(docId) {
  const db = loadDB();
  db.documents = db.documents || [];
  return db.documents.find((d) => d.docId === docId) || null;
}

/** List documents for user */
function listDocumentsByUser(userId) {
  const db = loadDB();
  db.documents = db.documents || [];
  return db.documents.filter((d) => d.userId === userId);
}

/** Add chunk(s) to document */
function addChunksToDocument(docId, chunks) {
  const db = loadDB();
  db.documents = db.documents || [];
  const doc = db.documents.find((d) => d.docId === docId);
  if (!doc) throw new Error("document_not_found");
  doc.chunks = doc.chunks || [];
  for (const c of chunks) {
    doc.chunks.push(c);
  }
  saveDB(db);
}

/** Simple nearest neighbour search (cosine) */
function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return -1;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Query topK chunks for a docId given queryEmbedding
 * returns [{chunk, score}, ...] sorted desc
 */
function queryTopK(docId, queryEmbedding, topK = 5) {
  const doc = getDocument(docId);
  if (!doc || !doc.chunks || doc.chunks.length === 0) return [];
  const results = doc.chunks.map((c) => {
    return { chunk: c, score: cosine(queryEmbedding, c.embedding || [] ) || 0 };
  });
  results.sort((a,b) => b.score - a.score);
  return results.slice(0, topK);
}

module.exports = {
  saveDocument,
  getDocument,
  listDocumentsByUser,
  addChunksToDocument,
  queryTopK,
  newId
};
