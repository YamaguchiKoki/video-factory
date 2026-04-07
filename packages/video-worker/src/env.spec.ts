import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";
import { parseDockerEnv } from "./env";

const run = (env: Record<string, string | undefined>) =>
  Effect.runPromise(Effect.result(parseDockerEnv(env)));

describe("parseDockerEnv", () => {
  it("returns Success with parsed values when S3_BUCKET is set", async () => {
    const result = await run({ S3_BUCKET: "my-bucket" });
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.S3_BUCKET).toBe("my-bucket");
    }
  });

  it("returns Failure when S3_BUCKET is missing", async () => {
    const result = await run({});
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe("EnvValidationError");
    }
  });

  it("returns Failure when S3_BUCKET is empty string", async () => {
    const result = await run({ S3_BUCKET: "" });
    expect(Result.isFailure(result)).toBe(true);
  });

  it("parses optional S3_ENDPOINT_URL", async () => {
    const result = await run({
      S3_BUCKET: "my-bucket",
      S3_ENDPOINT_URL: "http://localhost:4566",
    });
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.S3_ENDPOINT_URL).toBe("http://localhost:4566");
    }
  });

  it("parses optional S3 credentials", async () => {
    const result = await run({
      S3_BUCKET: "my-bucket",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret",
    });
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.S3_ACCESS_KEY_ID).toBe("key");
      expect(result.success.S3_SECRET_ACCESS_KEY).toBe("secret");
    }
  });

  it("ignores unknown env vars", async () => {
    const result = await run({
      S3_BUCKET: "my-bucket",
      UNRELATED: "value",
    });
    expect(Result.isSuccess(result)).toBe(true);
  });
});
