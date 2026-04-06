import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Result } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupTempDir, createTempDir } from "./temp-file";

const run = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(Effect.result(effect));

describe("temp-file operations", () => {
  let createdDirs: string[] = [];

  afterEach(async () => {
    for (const dir of createdDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    createdDirs = [];
  });

  describe("createTempDir", () => {
    it("should create a temporary directory with UUID", async () => {
      const result = await run(createTempDir());

      expect(Result.isSuccess(result)).toBe(true);
      if (Result.isSuccess(result)) {
        const dirPath = result.success;
        createdDirs.push(dirPath);

        const stats = await stat(dirPath);
        expect(stats.isDirectory()).toBe(true);

        expect(dirPath).toContain(tmpdir());
        expect(dirPath).toContain("video-worker-");
      }
    });

    it("should create unique directories on each call", async () => {
      const result1 = await run(createTempDir());
      const result2 = await run(createTempDir());

      expect(Result.isSuccess(result1)).toBe(true);
      expect(Result.isSuccess(result2)).toBe(true);

      if (Result.isSuccess(result1) && Result.isSuccess(result2)) {
        createdDirs.push(result1.success, result2.success);
        expect(result1.success).not.toBe(result2.success);
      }
    });

    it("should return Effect type", () => {
      const result = createTempDir();
      expect(typeof result.pipe).toBe("function");
    });
  });

  describe("cleanupTempDir", () => {
    it("should delete temporary directory and its contents", async () => {
      const createResult = await run(createTempDir());
      expect(Result.isSuccess(createResult)).toBe(true);

      if (Result.isSuccess(createResult)) {
        const dirPath = createResult.success;

        await writeFile(join(dirPath, "file1.txt"), "content1");
        await writeFile(join(dirPath, "file2.txt"), "content2");
        await mkdir(join(dirPath, "subdir"));
        await writeFile(join(dirPath, "subdir", "file3.txt"), "content3");

        const cleanupResult = await run(cleanupTempDir(dirPath));

        expect(Result.isSuccess(cleanupResult)).toBe(true);

        try {
          await stat(dirPath);
          expect.fail("Directory should have been deleted");
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });

    it("should be idempotent (safe to call multiple times)", async () => {
      const createResult = await run(createTempDir());
      expect(Result.isSuccess(createResult)).toBe(true);

      if (Result.isSuccess(createResult)) {
        const dirPath = createResult.success;

        const cleanup1 = await run(cleanupTempDir(dirPath));
        expect(Result.isSuccess(cleanup1)).toBe(true);

        const cleanup2 = await run(cleanupTempDir(dirPath));
        expect(Result.isSuccess(cleanup2)).toBe(true);

        const cleanup3 = await run(cleanupTempDir(dirPath));
        expect(Result.isSuccess(cleanup3)).toBe(true);
      }
    });

    it("should succeed when directory does not exist", async () => {
      const nonExistentPath = join(tmpdir(), "non-existent-dir-12345");

      const result = await run(cleanupTempDir(nonExistentPath));

      expect(Result.isSuccess(result)).toBe(true);
    });

    it("should return FileSystemError when lacking delete permission", async () => {
      if (process.platform === "win32") {
        return;
      }

      const createResult = await run(createTempDir());
      expect(Result.isSuccess(createResult)).toBe(true);

      if (Result.isSuccess(createResult)) {
        const dirPath = createResult.success;
        createdDirs.push(dirPath);

        const testFile = join(dirPath, "locked.txt");
        await writeFile(testFile, "test");

        const { chmod } = await import("node:fs/promises");
        await chmod(dirPath, 0o444);

        const result = await run(cleanupTempDir(dirPath));

        await chmod(dirPath, 0o755);

        expect(Result.isFailure(result)).toBe(true);
        if (Result.isFailure(result)) {
          expect(result.failure._tag).toBe("FileSystemError");
        }
      }
    });

    it("should return Effect type", () => {
      const result = cleanupTempDir("/tmp/test");
      expect(typeof result.pipe).toBe("function");
    });
  });

  describe("integration", () => {
    it("should create, use, and cleanup temporary directory", async () => {
      const createResult = await run(createTempDir());
      expect(Result.isSuccess(createResult)).toBe(true);

      if (Result.isSuccess(createResult)) {
        const dirPath = createResult.success;

        const testFile = join(dirPath, "test.txt");
        await writeFile(testFile, "integration test");

        const fileStats = await stat(testFile);
        expect(fileStats.isFile()).toBe(true);

        const cleanupResult = await run(cleanupTempDir(dirPath));
        expect(Result.isSuccess(cleanupResult)).toBe(true);

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
