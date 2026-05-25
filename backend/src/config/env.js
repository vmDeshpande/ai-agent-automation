const { z } = require("zod");

const optionalNumber = (fieldName) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce
      .number({
        invalid_type_error: `${fieldName} must be a number`,
      })
      .int(`${fieldName} must be an integer`)
      .positive(`${fieldName} must be a positive number`)
      .optional()
  );

const optionalPort = (fieldName) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce
      .number({
        invalid_type_error: `${fieldName} must be a number`,
      })
      .int(`${fieldName} must be an integer`)
      .min(1, `${fieldName} must be greater than 0`)
      .max(65535, `${fieldName} must be less than 65536`)
      .optional()
  );

const optionalBoolean = () =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.boolean().optional()
  );

const envSchema = z.object({
  // server
  PORT: optionalPort("PORT"),

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

  // auth
  JWT_SECRET: z
    .string({
      required_error: "Missing JWT_SECRET",
    })
    .min(32, "JWT_SECRET must be at least 32 characters"),

  // optional AI providers
  OLLAMA_HOST: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  HF_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // worker
  WORKER_POLL_INTERVAL_MS: optionalNumber(
    "WORKER_POLL_INTERVAL_MS"
  ),

  WORKER_BATCH_SIZE: optionalNumber(
    "WORKER_BATCH_SIZE"
  ),

  WORKER_MAX_ATTEMPTS: optionalNumber(
    "WORKER_MAX_ATTEMPTS"
  ),

  WORKER_SERVICE_TOKEN: z.string().optional(),

  // email
  EMAIL_HOST: z.string().optional(),

  EMAIL_PORT: optionalPort("EMAIL_PORT"),

  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // telemetry
  TELEMETRY_ENABLED: optionalBoolean(),

  DISABLE_ALL_ANALYTICS: optionalBoolean(),

  TELEMETRY_ENDPOINT: z.string().optional(),
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