const Document = require('../models/document.model');
const retrievalManager = require("../retrieval");

const STALE_PROCESSING_THRESHOLD_MS = 10 * 60 * 1000;

// --- Retrieval scalability caps ---
// Safety bounds for in-memory chunk scoring until a proper vector index / ANN search is introduced.

function safeProcessingError(error) {
  if (!error) return 'Document processing failed';

  const message = error instanceof Error ? error.message : String(error);

  return message.slice(0, 500) || 'Document processing failed';
}

function chunkText(text, chunkSize = 1200, overlap = 200) {
  const chunks = [];

  let start = 0;

  while (start < text.length) {
    const end = start + chunkSize;

    const piece = text.slice(start, end).trim();

    if (piece) chunks.push(piece);

    start += chunkSize - overlap;
  }

  return chunks;
}

async function processDocument(agent, document, text) {
  try {
    await Document.findByIdAndUpdate(document._id, {
      processingStep: 'Chunking',
    });

    const chunks = chunkText(text);

    await Document.findByIdAndUpdate(document._id, {
      processingStep: 'Embedding chunks',
      processedChunks: 0,
      totalChunks: chunks.length,
    });

    const records = [];

    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i];

      const embedding = await runEmbedding(content, agent);

      records.push({
        documentId: document._id,
        userId: document.userId,
        chunkIndex: i,
        content,
        embedding,
      });

      await Document.updateOne(
        {
          _id: document._id,
          status: 'processing',
        },
        {
          processedChunks: i + 1,
        }
      );
    }

    const currentDocument = await Document.findById(document._id).select('status').lean();

    if (!currentDocument || currentDocument.status !== 'processing') {
      throw new Error('Document processing was interrupted');
    }

    await DocumentChunk.insertMany(records);

    await Document.updateOne(
      {
        _id: document._id,
        status: 'processing',
      },
      {
        $set: {
          status: 'ready',
          processingStep: 'Ready',
          processedAt: new Date(),
          processedChunks: records.length,
          totalChunks: records.length,
          chunkCount: records.length,
        },
        $unset: { processingError: '' },
      }
    );
  } catch (error) {
    await DocumentChunk.deleteMany({
      documentId: document._id,
    });

    await Document.findByIdAndUpdate(document._id, {
      status: 'failed',
      processingStep: 'Failed',
      processingError: safeProcessingError(error),
      processedAt: new Date(),
    });

    throw error;
  }
}

async function markStaleProcessingDocumentsAsFailed() {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS);

  return Document.updateMany(
    {
      status: 'processing',
      $or: [
        { processingStartedAt: { $lt: staleBefore } },
        { processingStartedAt: { $exists: false } },
      ],
    },
    {
      status: 'failed',
      processingStep: 'Failed',
      processingError: 'Processing was interrupted or timed out',
      processedAt: new Date(),
    }
  );
}

async function queryDocument(agent, userId, documentId, query, topK = 3) {
  return queryDocuments(agent, userId, [documentId], query, topK);
}

async function queryDocuments(agent, userId, documentIds, query, topK = 3) {
  return retrievalManager.retrieve(
    agent,
    userId,
    documentIds,
    query,
    topK
  );
}

module.exports = {
  processDocument,
  queryDocument,
  queryDocuments,
  markStaleProcessingDocumentsAsFailed,
  STALE_PROCESSING_THRESHOLD_MS,
};
