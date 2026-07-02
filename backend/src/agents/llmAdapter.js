const axios = require("axios");
const { createGroq } = require("@ai-sdk/groq");
const { generateText } = require("ai");
const { OpenAI } = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");

require("dotenv").config();

async function runLLM(prompt, opts = {}) {
  let provider = opts.provider;
  let model = opts.model;

  if (!provider || !model) {
    let fallbackProvider = "groq";
    let fallbackModel = "llama-3.1-8b-instant";

    if (process.env.GROQ_API_KEY) {
      fallbackProvider = "groq";
      fallbackModel = "llama-3.1-8b-instant";
    } else if (process.env.OPENAI_API_KEY) {
      fallbackProvider = "openai";
      fallbackModel = "gpt-4o-mini";
    } else if (process.env.GEMINI_API_KEY) {
      fallbackProvider = "gemini";
      fallbackModel = "gemini-1.5-flash";
    } else if (process.env.OLLAMA_HOST) {
      fallbackProvider = "ollama";
      fallbackModel = "llama3";
    } else if (process.env.HF_API_KEY) {
      fallbackProvider = "huggingface";
      fallbackModel = "mistralai/Mistral-7B-Instruct-v0.2";
    } else {
      fallbackProvider = "ollama";
      fallbackModel = "llama3";
    }

    if (!provider) provider = fallbackProvider;
    if (!model) model = fallbackModel;
  }

  const temperature = opts.temperature ?? 0.2;
  const maxTokens = opts.maxTokens || 256;

  if (!model) {
    throw new Error("No model specified for agent");
  }

  console.log("🧠 LLM CALL:", {
    provider,
    model,
  });

  /* ---------------- OLLAMA ---------------- */
  if (provider === "ollama") {
    const response = await axios.post(
      `${process.env.OLLAMA_HOST}/api/generate`,
      {
        model,
        prompt,
        stream: false
      }
    );

    return {
      text: response.data.response,
      raw: response.data,
      success: true
    };
  }

  /* ---------------- GROQ ---------------- */
  if (provider === "groq") {
    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const result = await generateText({
      model: groq(model),
      prompt,
      temperature,
      maxTokens,
    });

    return {
      text: result.text,
      raw: result,
      success: true,
    };
  }

  /* ---------------- OPENAI ---------------- */
  if (provider === "openai") {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens: maxTokens,
    });

    return {
      text: completion.choices[0].message.content,
      raw: completion,
      success: true,
    };
  }

  /* ---------------- GEMINI ---------------- */
  if (provider === "gemini") {
    const genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY
    );

    const geminiModel = genAI.getGenerativeModel({ model });

    const result = await geminiModel.generateContent(prompt);

    return {
      text: result.response.text(),
      raw: result,
      success: true,
    };
  }

  /* ---------------- HUGGINGFACE ---------------- */
  if (provider === "huggingface") {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${model}`,
      { inputs: prompt },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
        },
      }
    );

    return {
      text: response.data?.[0]?.generated_text || "",
      raw: response.data,
      success: true,
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

module.exports = { runLLM };