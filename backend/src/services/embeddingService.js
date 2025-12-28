// backend/src/services/embeddingService.js
// Generates embeddings using @xenova/transformers (feature-extraction / MiniLM-L6-v2).
// Returns a plain float[].

const { pipeline } = require("@xenova/transformers");

let embedder = null;

async function getEmbedder() {
  if (embedder) return embedder;
  console.log("🔥 Loading MiniLM-L6-v2 embedder (this may download model files)...");
  // Model name might be "Xenova/all-MiniLM-L6-v2" or similar; if download fails,
  // adjust the model id. This is a free local model.
  embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  return embedder;
}

/**
 * embedText
 * @param {string} text
 * @returns {number[]} embedding vector (1D Float array)
 */
async function embedText(text) {
  if (!text || typeof text !== "string" || text.trim() === "") return [];
  const model = await getEmbedder();
  // model(text) returns nested arrays -> we average-pool token vectors to one vector
  const out = await model(text);
  // Output shape varies by runtime; normalize into a 1D float array
  // Many runtimes return { data: Float32Array } or nested arrays.
  // Handle common shapes:
  if (Array.isArray(out)) {
    // e.g. [[...tokenVecs...]]
    if (Array.isArray(out[0])) {
      // average across tokens
      const tokenVecs = out;
      const len = tokenVecs.length;
      const dim = tokenVecs[0].length;
      const acc = new Array(dim).fill(0);
      for (let i = 0; i < len; i++) {
        for (let j = 0; j < dim; j++) acc[j] += tokenVecs[i][j];
      }
      return acc.map((v) => v / len);
    } else {
      // Already 1D
      return out;
    }
  } else if (out.data && out.data.length) {
    // e.g. { data: Float32Array([...]) }
    return Array.from(out.data);
  } else {
    // Fallback: try JSON conversion
    try {
      const arr = JSON.parse(JSON.stringify(out));
      if (Array.isArray(arr) && Array.isArray(arr[0])) {
        const tokenVecs = arr;
        const len = tokenVecs.length;
        const dim = tokenVecs[0].length;
        const acc = new Array(dim).fill(0);
        for (let i = 0; i < len; i++) {
          for (let j = 0; j < dim; j++) acc[j] += tokenVecs[i][j];
        }
        return acc.map((v) => v / len);
      } else if (Array.isArray(arr)) return arr;
    } catch (e) {}
  }

  throw new Error("Unknown embedding output shape");
}

module.exports = { embedText };
