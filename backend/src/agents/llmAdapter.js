const axios = require('axios');
const { createGroq } = require('@ai-sdk/groq');
const { generateText } = require('ai');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

require('dotenv').config();

/**
 * Normalize the per-provider response into a single `tokenUsage` shape:
 *
 *   {
 *     provider: 'groq' | 'openai' | 'gemini' | 'ollama' | 'huggingface',
 *     model:    string,
 *     promptTokens:     number | 0,
 *     completionTokens: number | 0,
 *     totalTokens:      number | 0,
 *   }
 *
 * Returns `null` when the underlying SDK surface doesn't expose token
 * counts (HuggingFace inference endpoint, for example, doesn't return
 * a usage block). Frontend/aggregate code treats `null` as "unknown"
 * and skips it from the totals rather than reporting a misleading 0.
 *
 * Issue #281: the previous `runLLM()` return shape only carried `text`
 * and the raw SDK object, so handlers could not persist structured token
 * counts. This helper centralizes the per-provider extraction so the
 * handler stays provider-agnostic.
 */
function extractTokenUsage(provider, model, raw) {
  if (!raw || typeof raw !== 'object') return null;

  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  /* ---------------- OpenAI ---------------- */
  // The OpenAI JS SDK surfaces `completion.usage = { prompt_tokens,
  // completion_tokens, total_tokens }` on the chat.completions response body.
  if (provider === 'openai' && raw?.usage) {
    promptTokens = Number(raw.usage.prompt_tokens) || 0;
    completionTokens = Number(raw.usage.completion_tokens) || 0;
    totalTokens = Number(raw.usage.total_tokens) || promptTokens + completionTokens;
    return { provider, model, promptTokens, completionTokens, totalTokens };
  }

  /* ---------------- Groq (via ai-sdk) ---------------- */
  // The Vercel AI SDK's `generateText()` result carries `.usage` =
  // { promptTokens, completionTokens, totalTokens }. Field names match
  // across @ai-sdk/groq and (future) ollama-provider integrations.
  if (provider === 'groq' && raw?.usage) {
    promptTokens = Number(raw.usage.promptTokens) || 0;
    completionTokens = Number(raw.usage.completionTokens) || 0;
    totalTokens = Number(raw.usage.totalTokens) || promptTokens + completionTokens;
    return { provider, model, promptTokens, completionTokens, totalTokens };
  }

  /* ---------------- Gemini ---------------- */
  // `@google/generative-ai` returns result.response.usageMetadata =
  // { promptTokenCount, candidatesTokenCount, totalTokenCount }.
  if (provider === 'gemini' && raw?.response?.usageMetadata) {
    const m = raw.response.usageMetadata;
    promptTokens = Number(m.promptTokenCount) || 0;
    completionTokens = Number(m.candidatesTokenCount) || 0;
    totalTokens = Number(m.totalTokenCount) || promptTokens + completionTokens;
    return { provider, model, promptTokens, completionTokens, totalTokens };
  }

  /* ---------------- Ollama ---------------- */
  // Ollama's `/api/generate` response surfaces `eval_count` (completion
  // tokens) and `prompt_eval_count` (prompt tokens) when the model is
  // run with `stream: false`. When the prompt is cached on the server
  // side, `prompt_eval_count` is 0 (or absent). We don't synthesize a
  // fake prompt-token count — we report what the server returned.
  if (provider === 'ollama' && raw) {
    completionTokens = Number(raw.eval_count) || 0;
    promptTokens = Number(raw.prompt_eval_count) || 0;
    if (completionTokens === 0 && promptTokens === 0) return null;
    totalTokens = promptTokens + completionTokens;
    return { provider, model, promptTokens, completionTokens, totalTokens };
  }

  /* ---------------- HuggingFace ---------------- */
  // HuggingFace's /models/{id} inference endpoint does not return a
  // structured usage block in v1 — the response is the bare generation.
  // Returning `null` here means the handler/aggregate code will skip
  // this call rather than pollute the totals with a misleading 0 count.
  if (provider === 'huggingface') {
    return null;
  }

  // Defensive fallback for an unknown SDK surface
  return null;
}

async function runLLM(prompt, opts = {}) {
  let provider = opts.provider;
  let model = opts.model;

  if (!provider || !model) {
    let fallbackProvider = 'groq';
    let fallbackModel = 'llama-3.1-8b-instant';

    if (process.env.GROQ_API_KEY) {
      fallbackProvider = 'groq';
      fallbackModel = 'llama-3.1-8b-instant';
    } else if (process.env.OPENAI_API_KEY) {
      fallbackProvider = 'openai';
      fallbackModel = 'gpt-4o-mini';
    } else if (process.env.GEMINI_API_KEY) {
      fallbackProvider = 'gemini';
      fallbackModel = 'gemini-1.5-flash';
    } else if (process.env.OLLAMA_HOST) {
      fallbackProvider = 'ollama';
      fallbackModel = 'llama3';
    } else if (process.env.HF_API_KEY) {
      fallbackProvider = 'huggingface';
      fallbackModel = 'mistralai/Mistral-7B-Instruct-v0.2';
    } else {
      fallbackProvider = 'ollama';
      fallbackModel = 'llama3';
    }

    if (!provider) provider = fallbackProvider;
    if (!model) model = fallbackModel;
  }

  const temperature = opts.temperature ?? 0.2;
  const maxTokens = opts.maxTokens || 256;

  if (!model) {
    throw new Error('No model specified for agent');
  }

  console.log('🧠 LLM CALL:', {
    provider,
    model,
  });

  /* ---------------- OLLAMA ---------------- */
  if (provider === 'ollama') {
    const response = await axios.post(`${process.env.OLLAMA_HOST}/api/generate`, {
      model,
      prompt,
      stream: false,
    });

    return {
      text: response.data.response,
      raw: response.data,
      tokenUsage: extractTokenUsage(provider, model, response.data),
      provider,
      model,
      success: true,
    };
  }

  /* ---------------- GROQ ---------------- */
  if (provider === 'groq') {
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
      tokenUsage: extractTokenUsage(provider, model, result),
      provider,
      model,
      success: true,
    };
  }

  /* ---------------- OPENAI ---------------- */
  if (provider === 'openai') {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    });

    return {
      text: completion.choices[0].message.content,
      raw: completion,
      tokenUsage: extractTokenUsage(provider, model, completion),
      provider,
      model,
      success: true,
    };
  }

  /* ---------------- GEMINI ---------------- */
  if (provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const geminiModel = genAI.getGenerativeModel({ model });

    const result = await geminiModel.generateContent(prompt);

    return {
      text: result.response.text(),
      raw: result,
      tokenUsage: extractTokenUsage(provider, model, result),
      provider,
      model,
      success: true,
    };
  }

  /* ---------------- HUGGINGFACE ---------------- */
  if (provider === 'huggingface') {
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
      text: response.data?.[0]?.generated_text || '',
      raw: response.data,
      tokenUsage: extractTokenUsage(provider, model, response.data),
      provider,
      model,
      success: true,
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

module.exports = { runLLM, extractTokenUsage };
