const DocumentChunk = require('../../models/documentChunk.model');
const { runEmbedding } = require('../../agents/embeddingAdapter');

const BaseRetrievalStrategy = require('./BaseRetrievalStrategy');

// --- Retrieval scalability caps ---
// Safety bounds for in-memory chunk scoring until a proper vector index / ANN search is introduced.
const MAX_CHUNKS_PER_DOCUMENT_TO_SCORE = 200;
const MAX_TOTAL_CHUNKS_TO_SCORE = 1000;
const MIN_CHUNKS_PER_DOCUMENT_TO_SCORE = 25;

function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;

  let dot = 0,
    normA = 0,
    normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (!normA || !normB) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function isComparisonQuery(query) {
  const normalizedQuery = (query || '').toLowerCase();

  return [
    'compare',
    'contrast',
    'difference',
    'differences',
    'similar',
    'similarities',
    'both',
    'all documents',
    'across documents',
  ].some((term) => normalizedQuery.includes(term));
}

function getChunkKey(chunk) {
  return chunk._id ? chunk._id.toString() : `${chunk.documentId.toString()}:${chunk.chunkIndex}`;
}

function selectBalancedChunks(scoredChunks, documentIds, limit, query) {
  const chunksByDocumentId = new Map();

  for (const chunk of scoredChunks) {
    const documentId = chunk.documentId.toString();

    if (!chunksByDocumentId.has(documentId)) {
      chunksByDocumentId.set(documentId, []);
    }

    chunksByDocumentId.get(documentId).push(chunk);
  }

  for (const chunks of chunksByDocumentId.values()) {
    chunks.sort((a, b) => b.score - a.score);
  }

  const selectedChunks = [];
  const seenChunkKeys = new Set();

  const addChunk = (chunk) => {
    if (!chunk) return;

    const chunkKey = getChunkKey(chunk);

    if (seenChunkKeys.has(chunkKey)) return;

    seenChunkKeys.add(chunkKey);
    selectedChunks.push(chunk);
  };

  // Balanced retrieval applies to every multi-document query; comparison detection keeps the intent explicit.
  const shouldPrioritizeCoverage = documentIds.length > 1 || isComparisonQuery(query);

  if (!shouldPrioritizeCoverage) {
    return scoredChunks.slice(0, limit);
  }

  for (const documentId of documentIds.map((id) => id.toString())) {
    addChunk(chunksByDocumentId.get(documentId)?.[0]);
  }

  // For multi-document comparison, source coverage is prioritized over strict topK.
  if (selectedChunks.length >= limit) {
    return selectedChunks;
  }

  for (const chunk of scoredChunks) {
    if (selectedChunks.length >= limit) break;
    addChunk(chunk);
  }

  return selectedChunks;
}

class HybridRetrievalStrategy extends BaseRetrievalStrategy {
  async retrieve(agent, userId, documentIds, query, topK = 3) {
    const parsedTopK = Number(topK);
    const limit = Number.isFinite(parsedTopK) ? Math.max(0, Math.floor(parsedTopK)) : 3;

    const uniqueDocumentIds = [
        ...new Map(
        (Array.isArray(documentIds) ? documentIds : [])
            .filter(Boolean)
            .map((id) => [id.toString(), id])
        ).values(),
    ];

    if (!uniqueDocumentIds.length) {
        return [];
    }

    // Generate embedding for the query (computed once, reused for all chunk scoring)
    const queryEmbedding = await runEmbedding(query, agent);

    // --- Bounded per-document chunk loading ---
    // Calculate a fair per-document limit that keeps total scored chunks within MAX_TOTAL_CHUNKS_TO_SCORE.
    // For very large documents, this caps at the first safePerDocumentLimit chunks (by chunkIndex).
    // Later chunks may be missed — this is a safety cap for predictable performance
    // until a proper vector index / ANN search is introduced.
    const perDocumentLimit = Math.max(
        MIN_CHUNKS_PER_DOCUMENT_TO_SCORE,
        Math.floor(MAX_TOTAL_CHUNKS_TO_SCORE / uniqueDocumentIds.length)
    );
    const safePerDocumentLimit = Math.min(MAX_CHUNKS_PER_DOCUMENT_TO_SCORE, perDocumentLimit);

    // Load chunks per-document with bounded queries (parallel for throughput)
    const chunkArrays = await Promise.all(
        uniqueDocumentIds.map((docId) =>
        DocumentChunk.find({ userId, documentId: docId })
            .select('documentId chunkIndex content embedding')
            .sort({ chunkIndex: 1 })
            .limit(safePerDocumentLimit)
            .lean()
        )
    );

    // Flatten and apply global cap — trim evenly across documents if total still exceeds budget
    let allChunks = chunkArrays.flat();

    if (allChunks.length > MAX_TOTAL_CHUNKS_TO_SCORE) {
        // Trim to global cap: keep first N chunks (already sorted by chunkIndex within each doc)
        allChunks = allChunks.slice(0, MAX_TOTAL_CHUNKS_TO_SCORE);
    }

    if (!allChunks.length) {
        return [];
    }

    // Compute cosine similarity — skip chunks without a valid embedding to avoid crashes
    const scored = [];
    for (const chunk of allChunks) {
        if (!Array.isArray(chunk.embedding) || chunk.embedding.length === 0) {
        continue;
        }
        scored.push({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
        });
    }

    if (!scored.length) {
        return [];
    }

    // Sort by similarity score
    scored.sort((a, b) => b.score - a.score);

    let finalChunks;

    if (uniqueDocumentIds.length === 1) {
        // Return topK results
        finalChunks = scored.slice(0, limit);
    } else {
        finalChunks = selectBalancedChunks(scored, uniqueDocumentIds, limit, query);
    }

    return finalChunks;
    }
}

module.exports = HybridRetrievalStrategy;