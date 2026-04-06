import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Result } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileExists, readFile, writeFile } from "./file-system";

const run = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(Effect.result(effect));

describe("file-system operations", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `video-worker-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe("readFile", () => {
    it("should read file content successfully", async () => {
      const testPath = join(testDir, "test.txt");
      const testContent = Buffer.from("Hello, World!");
      await Effect.runPromise(writeFile(testPath, testContent));

      const result = await run(readFile(testPath));

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success).toEqual(testContent);
      }
    });

    it("should return FileSystemError when file does not exist", async () => {
      const nonExistentPath = join(testDir, "non-existent.txt");

      const result = await run(readFile(nonExistentPath));

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("FileSystemError");
        expect(result.failure.message).toContain("Failed to read file");
      }
    });

    it("should return FileSystemError with cause when lacking read permission", async () => {
      if (process.platform === "win32") {
        return;
      }

      const testPath = join(testDir, "no-read-permission.txt");
      await Effect.runPromise(writeFile(testPath, Buffer.from("test")));

      const { chmod } = await import("node:fs/promises");
      await chmod(testPath, 0o000);

      const result = await run(readFile(testPath));

      await chmod(testPath, 0o644);

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("FileSystemError");
      }
    });
  });

  describe("writeFile", () => {
    it("should write file content successfully", async () => {
      const testPath = join(testDir, "output.txt");
      const testContent = Buffer.from("Test content");

      const result = await run(writeFile(testPath, testContent));

      expect(Result.isSuccess(result)).toBe(true);

      const readResult = await run(readFile(testPath));
      expect(Result.isSuccess(readResult)).toBe(true);
      if (Result.isSuccess(readResult)) {
        expect(readResult.success).toEqual(testContent);
      }
    });

    it("should overwrite existing file", async () => {
      const testPath = join(testDir, "overwrite.txt");
      const initialContent = Buffer.from("Initial");
      const newContent = Buffer.from("Updated");

      await Effect.runPromise(writeFile(testPath, initialContent));
      const result = await run(writeFile(testPath, newContent));

      expect(Result.isSuccess(result)).toBe(true);

      const readResult = await run(readFile(testPath));
      if (Result.isSuccess(readResult)) {
        expect(readResult.success).toEqual(newContent);
      }
    });

    it("should return FileSystemError when lacking write permission", async () => {
      if (process.platform === "win32") {
        return;
      }

      const testPath = join(testDir, "no-write-dir", "file.txt");
      const noWriteDir = join(testDir, "no-write-dir");

      await mkdir(noWriteDir);

      const { chmod } = await import("node:fs/promises");
      await chmod(noWriteDir, 0o444);

      const result = await run(writeFile(testPath, Buffer.from("test")));

      await chmod(noWriteDir, 0o755);

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("FileSystemError");
      }
    });
  });

  describe("fileExists", () => {
    it("should return true for existing file", async () => {
      const testPath = join(testDir, "exists.txt");
      await Effect.runPromise(writeFile(testPath, Buffer.from("test")));

      const result = await run(fileExists(testPath));

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success).toBe(true);
      }
    });

    it("should return false for non-existent file", async () => {
      const testPath = join(testDir, "does-not-exist.txt");

      const result = await run(fileExists(testPath));

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success).toBe(false);
      }
    });

    it("should return true for existing directory", async () => {
      const result = await run(fileExists(testDir));

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        expect(result.success).toBe(true);
      }
    });

    it("should return FileSystemError when path access fails", async () => {
      if (process.platform === "win32") {
        return;
      }

      const noAccessDir = join(testDir, "no-access");
      await mkdir(noAccessDir);

      const testPath = join(noAccessDir, "file.txt");

      const { chmod } = await import("node:fs/promises");
      await chmod(noAccessDir, 0o000);

      const result = await run(fileExists(testPath));

      await chmod(noAccessDir, 0o755);

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("FileSystemError");
      }
    });
  });

  describe("type safety", () => {
    it("readFile returns Effect type", () => {
      const testPath = join(testDir, "type-test.txt");
      const readResult = readFile(testPath);
      expect(typeof readResult.pipe).toBe("function");
    });

    it("writeFile returns Effect type", () => {
      const testPath = join(testDir, "type-test.txt");
      const writeResult = writeFile(testPath, Buffer.from("test"));
      expect(typeof writeResult.pipe).toBe("function");
    });

    it("fileExists returns Effect type", () => {
      const testPath = join(testDir, "type-test.txt");
      const existsResult = fileExists(testPath);
      expect(typeof existsResult.pipe).toBe("function");
    });
  });
});
