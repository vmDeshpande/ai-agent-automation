const axios = require("axios");
const { OpenAI } = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");

require("dotenv").config();

function supportsEmbedding(provider) {
    return ["ollama", "openai", "gemini", "huggingface"].includes(provider);
}

function defaultEmbeddingModelFor(provider) {
    switch (provider) {
        case "openai":
            return "text-embedding-3-small";
        case "gemini":
            // Replaced text-embedding-004 with text-embedding-001 to match your current SDK version
            return "text-embedding-001";
        case "huggingface":
            return "sentence-transformers/all-MiniLM-L6-v2";
        case "ollama":
            return "nomic-embed-text";
        default:
            throw new Error(`No embedding model defined for ${provider}`);
    }
}

async function runEmbedding(text, agent) {
    const primaryProvider = agent?.config?.provider;
    const configuredEmbeddingProvider = agent?.config?.embeddingProvider;

    let embeddingProvider;

    if (configuredEmbeddingProvider) {
        // Fallback safety if the agent passes an outdated name
        embeddingProvider = configuredEmbeddingProvider;
    } else if (supportsEmbedding(primaryProvider)) {
        embeddingProvider = primaryProvider;
    } else {
        embeddingProvider = "ollama";
    }

    let model =
        agent?.config?.embeddingModel ||
        (embeddingProvider === "ollama"
            ? "nomic-embed-text"
            : defaultEmbeddingModelFor(embeddingProvider));

    // Force fallback update if outdated or mismatched structures slip through configuration parameters
    if (embeddingProvider === "gemini" && (model === "embedding-001" || model === "text-embedding-004" || !model)) {
        model = "text-embedding-001";
    }

    if (!embeddingProvider) {
        throw new Error("No embedding provider configured");
    }

    console.log("🧠 EMBEDDING CALL:", {
        primaryProvider,
        embeddingProvider,
        model,
    });

    /* -------- OLLAMA -------- */
    if (embeddingProvider === "ollama") {
        const response = await axios.post(
            `${process.env.OLLAMA_HOST}/api/embeddings`,
            {
                model,
                prompt: text
            }
        );

        return response.data.embedding;
    }

    /* -------- OPENAI -------- */
    if (embeddingProvider === "openai") {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const response = await openai.embeddings.create({
            model: model || "text-embedding-3-small",
            input: text
        });

        return response.data[0].embedding;
    }

    /* -------- GEMINI -------- */
    if (embeddingProvider === "gemini") {
        const genAI = new GoogleGenerativeAI(
            process.env.GEMINI_API_KEY
        );

        const modelInstance = genAI.getGenerativeModel({
            model: model
        });

        const result = await modelInstance.embedContent(text);

        return result.embedding.values;
    }

    throw new Error(`Embedding not supported for provider: ${embeddingProvider}`);
}

module.exports = { runEmbedding };