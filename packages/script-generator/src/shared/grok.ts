import { createXai } from "@ai-sdk/xai";
import { z } from "zod";

// Validate required environment variables at startup to fail fast
// rather than sending "Bearer undefined" to the xAI API.
const envSchema = z.object({
  XAI_API_KEY: z.string().min(1, "XAI_API_KEY is required"),
});

const env = envSchema.safeParse(process.env);
if (!env.success) {
  throw new Error(
    `Missing environment variable: ${env.error.issues.map((i) => i.message).join(", ")}`,
  );
}

export const grok = createXai({
  apiKey: env.data.XAI_API_KEY,
});
