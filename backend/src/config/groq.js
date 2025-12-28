const { Groq } = require("@ai-sdk/groq");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

module.exports = groq;
