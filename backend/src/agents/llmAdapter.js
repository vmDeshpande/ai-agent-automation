const { createGroq } = require("@ai-sdk/groq");
const { generateText } = require("ai");
require("dotenv").config();

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

async function runLLM(prompt, opts = {}) {
  const model = opts.model || "llama-3.1-8b-instant";

  try {
    const result = await generateText({
      model: groq(model),
      prompt,
      temperature: opts.temperature ?? 0.2,
      maxTokens: opts.maxTokens || 256,
    });

    return {
      text: result.text,
      raw: result,
      success: true,
    };
  } catch (err) {
    console.error("LLM error:", err);
    return { text: null, error: err, success: false };
  }
}

module.exports = { runLLM };
