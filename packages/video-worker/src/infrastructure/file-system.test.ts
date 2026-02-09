/**
 * File system operations tests
 * Tests for readFile, writeFile, fileExists
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ResultAsync } from "neverthrow";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { fileExists, readFile, writeFile } from "./file-system";

describe("file-system operations", () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a unique test directory for each test
    testDir = join(tmpdir(), `video-worker-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe("readFile", () => {
    it("should read file content successfully", async () => {
      const testPath = join(testDir, "test.txt");
      const testContent = Buffer.from("Hello, World!");
      await writeFile(testPath, testContent);

      const result = await readFile(testPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(testContent);
      }
    });

    it("should return IO_ERROR when file does not exist", async () => {
      const nonExistentPath = join(testDir, "non-existent.txt");

      const result = await readFile(nonExistentPath);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("IO_ERROR");
        expect(result.error.message).toContain("Failed to read file");
        expect(result.error.context.path).toBe(nonExistentPath);
      }
    });

    it("should return PERMISSION_DENIED when lacking read permission", async () => {
      // This test is platform-specific and may be skipped on Windows
      if (process.platform === "win32") {
        return;
      }

      const testPath = join(testDir, "no-read-permission.txt");
      await writeFile(testPath, Buffer.from("test"));

      // Change file permissions to make it unreadable
      const { chmod } = await import("node:fs/promises");
      await chmod(testPath, 0o000);

      const result = await readFile(testPath);

      // Restore permissions for cleanup
      await chmod(testPath, 0o644);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("PERMISSION_DENIED");
      }
    });
  });

  describe("writeFile", () => {
    it("should write file content successfully", async () => {
      const testPath = join(testDir, "output.txt");
      const testContent = Buffer.from("Test content");

      const result = await writeFile(testPath, testContent);

      expect(result.isOk()).toBe(true);

      // Verify file was written
      const readResult = await readFile(testPath);
      expect(readResult.isOk()).toBe(true);
      if (readResult.isOk()) {
        expect(readResult.value).toEqual(testContent);
      }
    });

    it("should overwrite existing file", async () => {
      const testPath = join(testDir, "overwrite.txt");
      const initialContent = Buffer.from("Initial");
      const newContent = Buffer.from("Updated");

      await writeFile(testPath, initialContent);
      const result = await writeFile(testPath, newContent);

      expect(result.isOk()).toBe(true);

      const readResult = await readFile(testPath);
      if (readResult.isOk()) {
        expect(readResult.value).toEqual(newContent);
      }
    });

    it("should return PERMISSION_DENIED when lacking write permission", async () => {
      // This test is platform-specific and may be skipped on Windows
      if (process.platform === "win32") {
        return;
      }

      const testPath = join(testDir, "no-write-dir", "file.txt");
      const noWriteDir = join(testDir, "no-write-dir");

      await mkdir(noWriteDir);

      // Change directory permissions to make it unwritable
      const { chmod } = await import("node:fs/promises");
      await chmod(noWriteDir, 0o444);

      const result = await writeFile(testPath, Buffer.from("test"));

      // Restore permissions for cleanup
      await chmod(noWriteDir, 0o755);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("PERMISSION_DENIED");
      }
    });
  });

  describe("fileExists", () => {
    it("should return true for existing file", async () => {
      const testPath = join(testDir, "exists.txt");
      await writeFile(testPath, Buffer.from("test"));

      const result = await fileExists(testPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(true);
      }
    });

    it("should return false for non-existent file", async () => {
      const testPath = join(testDir, "does-not-exist.txt");

      const result = await fileExists(testPath);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(false);
      }
    });

    it("should return true for existing directory", async () => {
      const result = await fileExists(testDir);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(true);
      }
    });

    it("should return error when path access fails", async () => {
      // This test is platform-specific and may be skipped on Windows
      if (process.platform === "win32") {
        return;
      }

      const noAccessDir = join(testDir, "no-access");
      await mkdir(noAccessDir);

      const testPath = join(noAccessDir, "file.txt");

      // Change directory permissions to deny access
      const { chmod } = await import("node:fs/promises");
      await chmod(noAccessDir, 0o000);

      const result = await fileExists(testPath);

      // Restore permissions for cleanup
      await chmod(noAccessDir, 0o755);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("PERMISSION_DENIED");
      }
    });
  });

  describe("type safety", () => {
    it("should return ResultAsync type", () => {
      const testPath = join(testDir, "type-test.txt");

      const readResult = readFile(testPath);
      const writeResult = writeFile(testPath, Buffer.from("test"));
      const existsResult = fileExists(testPath);

      expect(readResult).toBeInstanceOf(ResultAsync);
      expect(writeResult).toBeInstanceOf(ResultAsync);
      expect(existsResult).toBeInstanceOf(ResultAsync);
    });
  });
});
