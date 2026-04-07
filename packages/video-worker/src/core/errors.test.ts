import { describe, expect, it } from "vitest";
import {
  EnvValidationError,
  FileSystemError,
  RenderError,
  S3DownloadError,
  S3UploadError,
  ValidationError,
} from "./errors";

describe("Domain Error Types", () => {
  describe("ValidationError", () => {
    it("has the correct _tag", () => {
      const error = new ValidationError({ message: "Invalid JSON format" });
      expect(error._tag).toBe("ValidationError");
    });

    it("stores the message", () => {
      const error = new ValidationError({ message: "Invalid JSON format" });
      expect(error.message).toBe("Invalid JSON format");
    });

    it("is an instance of Error", () => {
      const error = new ValidationError({ message: "test" });
      expect(error).toBeInstanceOf(Error);
    });

    it("stores optional cause", () => {
      const cause = new Error("Parse failed");
      const error = new ValidationError({ message: "Invalid JSON", cause });
      expect(error.cause).toBe(cause);
    });

    it("works without cause", () => {
      const error = new ValidationError({ message: "Schema mismatch" });
      expect(error.cause).toBeUndefined();
    });
  });

  describe("S3DownloadError", () => {
    it("has the correct _tag", () => {
      const error = new S3DownloadError({ message: "S3 object not found" });
      expect(error._tag).toBe("S3DownloadError");
    });

    it("stores the message", () => {
      const error = new S3DownloadError({ message: "Network error" });
      expect(error.message).toBe("Network error");
    });

    it("is an instance of Error", () => {
      const error = new S3DownloadError({ message: "test" });
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("S3UploadError", () => {
    it("has the correct _tag", () => {
      const error = new S3UploadError({ message: "Upload failed" });
      expect(error._tag).toBe("S3UploadError");
    });

    it("stores the message", () => {
      const error = new S3UploadError({ message: "Quota exceeded" });
      expect(error.message).toBe("Quota exceeded");
    });
  });

  describe("RenderError", () => {
    it("has the correct _tag", () => {
      const error = new RenderError({ message: "Rendering timeout" });
      expect(error._tag).toBe("RenderError");
    });

    it("stores the message", () => {
      const error = new RenderError({ message: "Render failed" });
      expect(error.message).toBe("Render failed");
    });

    it("stores optional cause", () => {
      const cause = new Error("Codec error");
      const error = new RenderError({ message: "Render failed", cause });
      expect(error.cause).toBe(cause);
    });

    it("is an instance of Error", () => {
      const error = new RenderError({ message: "test" });
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("FileSystemError", () => {
    it("has the correct _tag", () => {
      const error = new FileSystemError({ message: "Disk space exhausted" });
      expect(error._tag).toBe("FileSystemError");
    });

    it("stores the message", () => {
      const error = new FileSystemError({ message: "Permission denied" });
      expect(error.message).toBe("Permission denied");
    });

    it("stores optional cause", () => {
      const cause = new Error("ENOSPC");
      const error = new FileSystemError({ message: "No space left", cause });
      expect(error.cause).toBe(cause);
    });
  });

  describe("EnvValidationError", () => {
    it("has the correct _tag", () => {
      const error = new EnvValidationError({ message: "S3_BUCKET is missing" });
      expect(error._tag).toBe("EnvValidationError");
    });

    it("stores the message", () => {
      const error = new EnvValidationError({ message: "Invalid env" });
      expect(error.message).toBe("Invalid env");
    });
  });
});
