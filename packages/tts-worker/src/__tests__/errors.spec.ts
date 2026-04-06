// Tests for the TaggedErrorClass error types (errors.ts).

import { describe, expect, it } from "vitest";
import {
  AudioQueryError,
  EmptyInputError,
  EnvValidationError,
  FormatMismatchError,
  InvalidHeaderError,
  S3GetObjectError,
  S3PutObjectError,
  S3ValidationError,
  SynthesisError,
} from "../errors";

describe("AudioQueryError", () => {
  it("has the correct _tag", () => {
    const error = new AudioQueryError({ message: "fetch failed" });
    expect(error._tag).toBe("AudioQueryError");
  });

  it("stores the message", () => {
    const error = new AudioQueryError({ message: "VOICEVOX unreachable" });
    expect(error.message).toBe("VOICEVOX unreachable");
  });

  it("is an instance of Error", () => {
    const error = new AudioQueryError({ message: "test" });
    expect(error).toBeInstanceOf(Error);
  });
});

describe("SynthesisError", () => {
  it("has the correct _tag", () => {
    const error = new SynthesisError({ message: "synthesis failed" });
    expect(error._tag).toBe("SynthesisError");
  });

  it("stores the message", () => {
    const error = new SynthesisError({ message: "timeout" });
    expect(error.message).toBe("timeout");
  });
});

describe("InvalidHeaderError", () => {
  it("has the correct _tag", () => {
    const error = new InvalidHeaderError({ message: "missing RIFF" });
    expect(error._tag).toBe("InvalidHeaderError");
  });
});

describe("FormatMismatchError", () => {
  it("has the correct _tag", () => {
    const error = new FormatMismatchError({ message: "sample rate differs" });
    expect(error._tag).toBe("FormatMismatchError");
  });
});

describe("EmptyInputError", () => {
  it("has the correct _tag", () => {
    const error = new EmptyInputError({ message: "no buffers" });
    expect(error._tag).toBe("EmptyInputError");
  });
});

describe("S3GetObjectError", () => {
  it("has the correct _tag", () => {
    const error = new S3GetObjectError({ message: "AccessDenied" });
    expect(error._tag).toBe("S3GetObjectError");
  });
});

describe("S3PutObjectError", () => {
  it("has the correct _tag", () => {
    const error = new S3PutObjectError({ message: "NoSuchBucket" });
    expect(error._tag).toBe("S3PutObjectError");
  });
});

describe("S3ValidationError", () => {
  it("has the correct _tag", () => {
    const error = new S3ValidationError({ message: "invalid JSON" });
    expect(error._tag).toBe("S3ValidationError");
  });
});

describe("EnvValidationError", () => {
  it("has the correct _tag", () => {
    const error = new EnvValidationError({ message: "S3_BUCKET is missing" });
    expect(error._tag).toBe("EnvValidationError");
  });
});
