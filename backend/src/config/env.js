const { z } = require("zod");

const emptyStringToUndefined = (value) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  return value;
};

const preprocessOptional = (schema) =>
  z.preprocess(emptyStringToUndefined, schema.optional());

const optionalString = () => preprocessOptional(z.string());

const optionalBoolean = () => preprocessOptional(z.coerce.boolean());

const envSchema = z.object({
  // server
  PORT: z.coerce
    .number()
    .int()
    .min(1, "PORT must be greater than 0")
    .max(65535, "PORT must be less than 65536")
    .optional(),

  // database
  MONGO_URI: z
    .string({
      required_error: "Missing MONGO_URI",
    })
    .min(1, "Missing MONGO_URI")
    .refine(
      (value) =>
        value.startsWith("mongodb://") ||
        value.startsWith("mongodb+srv://"),
      {
        message: "Invalid MONGO_URI",
      }
    ),
  MONGO_MAX_POOL_SIZE: preprocessOptional(
    z.coerce
      .number()
      .int()
      .positive("MONGO_MAX_POOL_SIZE must be a positive number")
  ),
  MONGO_MIN_POOL_SIZE: preprocessOptional(
    z.coerce
      .number()
      .int()
      .positive("MONGO_MIN_POOL_SIZE must be a positive number")
  ),

  // auth
  JWT_SECRET: z
    .string({
      required_error: "Missing JWT_SECRET",
    })
    .min(32, "JWT_SECRET must be at least 32 characters"),

  // optional AI providers
  OLLAMA_HOST: optionalString(),
  GROQ_API_KEY: optionalString(),
  GEMINI_API_KEY: optionalString(),
  HF_API_KEY: optionalString(),
  OPENAI_API_KEY: optionalString(),

  // worker
  WORKER_POLL_INTERVAL_MS: preprocessOptional(
    z.coerce
      .number()
      .int()
      .positive("WORKER_POLL_INTERVAL_MS must be a positive number")
  ),

  WORKER_BATCH_SIZE: preprocessOptional(
    z.coerce
      .number()
      .int()
      .positive("WORKER_BATCH_SIZE must be a positive number")
  ),

  WORKER_MAX_ATTEMPTS: preprocessOptional(
    z.coerce
      .number()
      .int()
      .positive("WORKER_MAX_ATTEMPTS must be a positive number")
  ),

  WORKER_CONCURRENCY_LIMIT: preprocessOptional(
    z.coerce
      .number()
      .int()
      .positive("WORKER_CONCURRENCY_LIMIT must be a positive number")
  ),

  WORKER_SERVICE_TOKEN: optionalString(),

  // email
  EMAIL_HOST: optionalString(),

  EMAIL_PORT: preprocessOptional(
    z.coerce
      .number()
      .int()
      .min(1, "EMAIL_PORT must be greater than 0")
      .max(65535, "EMAIL_PORT must be less than 65536")
  ),

  EMAIL_USER: optionalString(),
  EMAIL_PASS: optionalString(),
  EMAIL_FROM: optionalString(),

  // telemetry
  TELEMETRY_ENABLED: optionalBoolean(),

  DISABLE_ALL_ANALYTICS: optionalBoolean(),

  TELEMETRY_ENDPOINT: optionalString(),

  MCP_ENABLED: optionalBoolean(),
  MCP_CONFIG_PATH: optionalString(),
  MCP_CONFIG_JSON: optionalString(),
  MCP_SERVER_URL: optionalString(),

  // rate limiting
  RATE_LIMIT_WINDOW_MS: preprocessOptional(
    z.coerce
      .number()
      .int()
      .positive("RATE_LIMIT_WINDOW_MS must be a positive number")
  ),

  RATE_LIMIT_GLOBAL_MAX: preprocessOptional(
    z.coerce
      .number()
      .int()
      .positive("RATE_LIMIT_GLOBAL_MAX must be a positive number")
  ),

  RATE_LIMIT_AUTH_MAX: preprocessOptional(
    z.coerce
      .number()
      .int()
      .positive("RATE_LIMIT_AUTH_MAX must be a positive number")
  ),

  RATE_LIMIT_EXPENSIVE_MAX: preprocessOptional(
    z.coerce
      .number()
      .int()
      .positive("RATE_LIMIT_EXPENSIVE_MAX must be a positive number")
  ),

  RATE_LIMIT_WEBHOOK_MAX: preprocessOptional(
    z.coerce
      .number()
      .int()
      .positive("RATE_LIMIT_WEBHOOK_MAX must be a positive number")
  ),

  // tool sandbox isolation options
  TOOL_SANDBOX_UID: preprocessOptional(
    z.coerce
      .number()
      .int()
      .positive("TOOL_SANDBOX_UID must be a positive number")
  ),

  TOOL_SANDBOX_GID: preprocessOptional(
    z.coerce
      .number()
      .int()
      .positive("TOOL_SANDBOX_GID must be a positive number")
  ),

  TOOL_EXECUTION_TIMEOUT_MS: preprocessOptional(
    z.coerce
      .number()
      .int()
      .positive("TOOL_EXECUTION_TIMEOUT_MS must be a positive number")
  ),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("\n❌ Environment Validation Failed:\n");

    result.error.issues.forEach((issue) => {
      console.error(`- ${issue.message}`);
    });

    console.error("\n🛑 Server startup aborted.\n");

    process.exit(1);
  }

  console.log("✅ Environment variables validated successfully.\n");
}

module.exports = validateEnv;
