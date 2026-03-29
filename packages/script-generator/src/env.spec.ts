import { describe, expect, it } from "vitest";
import { parseDockerEnv } from "./env";

describe("parseDockerEnv", () => {
  it("returns ok with parsed values when S3_BUCKET is set", () => {
    const result = parseDockerEnv({ S3_BUCKET: "my-bucket" });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().S3_BUCKET).toBe("my-bucket");
  });

  it("returns err when S3_BUCKET is missing", () => {
    const result = parseDockerEnv({});
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("ENV_VALIDATION_ERROR");
  });

  it("returns err when S3_BUCKET is empty string", () => {
    const result = parseDockerEnv({ S3_BUCKET: "" });
    expect(result.isErr()).toBe(true);
  });

  it("parses optional S3_ENDPOINT_URL", () => {
    const result = parseDockerEnv({
      S3_BUCKET: "my-bucket",
      S3_ENDPOINT_URL: "http://localhost:4566",
    });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().S3_ENDPOINT_URL).toBe(
      "http://localhost:4566",
    );
  });

  it("parses optional S3 credentials", () => {
    const result = parseDockerEnv({
      S3_BUCKET: "my-bucket",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret",
    });
    expect(result.isOk()).toBe(true);
  });
});
