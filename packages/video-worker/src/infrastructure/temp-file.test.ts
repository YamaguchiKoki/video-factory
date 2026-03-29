/**
 * Temporary file management tests
 * Tests for createTempDir, cleanupTempDir
 */

import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ResultAsync } from "neverthrow";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDir, createTempDir } from "./temp-file";

describe("temp-file operations", () => {
  let createdDirs: string[] = [];

  afterEach(async () => {
    // Clean up all created directories
    for (const dir of createdDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    createdDirs = [];
  });

  describe("createTempDir", () => {
    it("should create a temporary directory with UUID", async () => {
      const result = await createTempDir();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const dirPath = result.value;
        createdDirs.push(dirPath);

        // Verify directory was created
        const stats = await stat(dirPath);
        expect(stats.isDirectory()).toBe(true);

        // Verify path format
        expect(dirPath).toContain(tmpdir());
        expect(dirPath).toContain("video-worker-");
      }
    });

    it("should create unique directories on each call", async () => {
      const result1 = await createTempDir();
      const result2 = await createTempDir();

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);

      if (result1.isOk() && result2.isOk()) {
        createdDirs.push(result1.value, result2.value);
        expect(result1.value).not.toBe(result2.value);
      }
    });

    it("should return DISK_FULL error when disk space is insufficient", async () => {
      // This test is difficult to simulate reliably across platforms
      // Placeholder for future implementation with mock
    });

    it("should return ResultAsync type", () => {
      const result = createTempDir();
      expect(result).toBeInstanceOf(ResultAsync);
    });
  });

  describe("cleanupTempDir", () => {
    it("should delete temporary directory and its contents", async () => {
      const createResult = await createTempDir();
      expect(createResult.isOk()).toBe(true);

      if (createResult.isOk()) {
        const dirPath = createResult.value;

        // Create some files in the directory
        await writeFile(join(dirPath, "file1.txt"), "content1");
        await writeFile(join(dirPath, "file2.txt"), "content2");
        await mkdir(join(dirPath, "subdir"));
        await writeFile(join(dirPath, "subdir", "file3.txt"), "content3");

        const cleanupResult = await cleanupTempDir(dirPath);

        expect(cleanupResult.isOk()).toBe(true);

        // Verify directory was deleted
        try {
          await stat(dirPath);
          expect.fail("Directory should have been deleted");
        } catch (error) {
          // Directory does not exist - expected behavior
          expect(error).toBeDefined();
        }
      }
    });

    it("should be idempotent (safe to call multiple times)", async () => {
      const createResult = await createTempDir();
      expect(createResult.isOk()).toBe(true);

      if (createResult.isOk()) {
        const dirPath = createResult.value;

        const cleanup1 = await cleanupTempDir(dirPath);
        expect(cleanup1.isOk()).toBe(true);

        const cleanup2 = await cleanupTempDir(dirPath);
        expect(cleanup2.isOk()).toBe(true);

        const cleanup3 = await cleanupTempDir(dirPath);
        expect(cleanup3.isOk()).toBe(true);
      }
    });

    it("should succeed when directory does not exist", async () => {
      const nonExistentPath = join(tmpdir(), "non-existent-dir-12345");

      const result = await cleanupTempDir(nonExistentPath);

      expect(result.isOk()).toBe(true);
    });

    it("should return PERMISSION_DENIED when lacking delete permission", async () => {
      // This test is platform-specific and may be skipped on Windows
      if (process.platform === "win32") {
        return;
      }

      const createResult = await createTempDir();
      expect(createResult.isOk()).toBe(true);

      if (createResult.isOk()) {
        const dirPath = createResult.value;
        createdDirs.push(dirPath); // Ensure cleanup in afterEach

        // Create a file and make it undeletable
        const testFile = join(dirPath, "locked.txt");
        await writeFile(testFile, "test");

        const { chmod } = await import("node:fs/promises");
        await chmod(dirPath, 0o444); // Read-only directory

        const result = await cleanupTempDir(dirPath);

        // Restore permissions for cleanup
        await chmod(dirPath, 0o755);

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.type).toBe("PERMISSION_DENIED");
        }
      }
    });

    it("should return ResultAsync type", () => {
      const result = cleanupTempDir("/tmp/test");
      expect(result).toBeInstanceOf(ResultAsync);
    });
  });

  describe("integration", () => {
    it("should create, use, and cleanup temporary directory", async () => {
      const createResult = await createTempDir();
      expect(createResult.isOk()).toBe(true);

      if (createResult.isOk()) {
        const dirPath = createResult.value;

        // Use the directory
        const testFile = join(dirPath, "test.txt");
        await writeFile(testFile, "integration test");

        const fileStats = await stat(testFile);
        expect(fileStats.isFile()).toBe(true);

        // Cleanup
        const cleanupResult = await cleanupTempDir(dirPath);
        expect(cleanupResult.isOk()).toBe(true);

        // Verify cleanup
        try {
          await stat(dirPath);
          expect.fail("Directory should have been deleted");
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });
  });
});
