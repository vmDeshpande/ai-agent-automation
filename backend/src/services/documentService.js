const Document = require("../models/document.model");
const DocumentChunk = require("../models/documentChunk.model");

const { runEmbedding } = require("../agents/embeddingAdapter");

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

function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function processDocument(agent, document, text) {
    const chunks = chunkText(text);
    const records = [];

    for (let i = 0; i < chunks.length; i++) {
        const content = chunks[i];
        const embedding = await runEmbedding(content, agent);

        records.push({
            documentId: document._id,
            userId: document.userId,
            chunkIndex: i,
            content,
            embedding
        });
    }

    await DocumentChunk.insertMany(records);

    await Document.findByIdAndUpdate(document._id, {
        status: "ready",
        chunkCount: records.length
    });
}

/**
 * Queries one or multiple documents for context.
 * @param {Object} agent - The AI agent configuration.
 * @param {string} userId - ID of the user.
 * @param {string|string[]} documentIds - Single ID or array of IDs.
 * @param {string} query - The search query.
 * @param {number} topK - Number of top results to return.
 */
async function queryDocument(agent, userId, documentIds, query, topK = 3) {
    // Generate embedding for the query
    const queryEmbedding = await runEmbedding(query, agent);

    // Support both single string and array of strings
    const ids = Array.isArray(documentIds) ? documentIds : [documentIds];

    // Fetch chunks from ALL specified documents
    const chunks = await DocumentChunk.find({
        userId,
        documentId: { $in: ids }
    })
    .select("content embedding documentId") // Include documentId for attribution
    .lean();

    if (!chunks.length) {
        return [];
    }

    // Compute cosine similarity across the combined chunk pool
    const scored = chunks.map(chunk => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding)
    }));

    // Sort by similarity score descending
    scored.sort((a, b) => b.score - a.score);

    // Return the top K combined results
    return scored.slice(0, topK);
}

module.exports = {
    processDocument,
    queryDocument
};