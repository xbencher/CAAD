import Constants from "expo-constants";
import { z } from "zod";

const envSchema = z.object({
  API_BASE_URL: z.string().url(),
});

function readEnv() {
  const extra = Constants.expoConfig?.extra ?? {};
  const result = envSchema.safeParse(extra);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "API_BASE_URL"}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `Invalid app configuration (expo.extra): ${issues}. ` +
        "Set API_BASE_URL in your .env file (see .env.example).",
    );
  }

  return result.data;
}

export const env = readEnv();
