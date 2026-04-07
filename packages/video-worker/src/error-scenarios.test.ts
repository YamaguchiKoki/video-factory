import { existsSync } from "node:fs";
import { writeFile as fsWriteFile, mkdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLocalDeps } from "./deps";
import { createRenderVideoWorkflow } from "./service/video-service";

// Skip error scenario tests unless explicitly enabled
const shouldRunErrorTests = process.env.RUN_ERROR_TESTS === "true";
const describeError = shouldRunErrorTests ? describe : describe.skip;

describeError("Task 10.3: Error Scenarios E2E", () => {
  const testDir = join(tmpdir(), "video-worker-error-tests");
  const outputPath = join(testDir, `error-test-${Date.now()}.mp4`);

  beforeAll(async () => {
    if (!existsSync(testDir)) {
      await mkdir(testDir, { recursive: true });
    }
  });

  afterAll(async () => {
    await unlink(outputPath).catch(() => {});
  });

  it("should handle missing script file gracefully", async () => {
    const deps = createLocalDeps({ requestId: crypto.randomUUID() });
    const workflow = createRenderVideoWorkflow(deps);

    const nonExistentScriptPath = join(testDir, "non-existent-script.json");
    const audioPath = join(process.cwd(), "mock-data/audio.wav");

    const error = await Effect.runPromise(
      Effect.flip(workflow(nonExistentScriptPath, audioPath, outputPath)),
    );

    expect(error._tag).toBe("FileSystemError");
    expect(error.message).toContain("no such file or directory");
    expect(existsSync(outputPath)).toBe(false);
  });

  it("should handle missing audio file gracefully", async () => {
    const deps = createLocalDeps({ requestId: crypto.randomUUID() });
    const workflow = createRenderVideoWorkflow(deps);

    const scriptPath = join(process.cwd(), "mock-data/script.json");
    const nonExistentAudioPath = join(testDir, "non-existent-audio.wav");

    const error = await Effect.runPromise(
      Effect.flip(workflow(scriptPath, nonExistentAudioPath, outputPath)),
    );

    expect(error._tag).toBe("FileSystemError");
    expect(existsSync(outputPath)).toBe(false);
  });

  it("should handle invalid JSON in script file", async () => {
    const deps = createLocalDeps({ requestId: crypto.randomUUID() });
    const workflow = createRenderVideoWorkflow(deps);

    const invalidScriptPath = join(testDir, "invalid-script.json");
    await fsWriteFile(invalidScriptPath, "{ invalid json }", "utf-8");

    const audioPath = join(process.cwd(), "mock-data/audio.wav");

    const error = await Effect.runPromise(
      Effect.flip(workflow(invalidScriptPath, audioPath, outputPath)),
    );

    expect(error._tag).toBe("ValidationError");
    expect(error.message).toContain("JSON");

    await unlink(invalidScriptPath);
  });

  it("should handle script with invalid schema", async () => {
    const deps = createLocalDeps({ requestId: crypto.randomUUID() });
    const workflow = createRenderVideoWorkflow(deps);

    const invalidSchemaPath = join(testDir, "invalid-schema.json");
    const invalidScript = {
      title: "Test",
      // Missing totalDurationSec, newsItems, sections
    };

    await fsWriteFile(
      invalidSchemaPath,
      JSON.stringify(invalidScript),
      "utf-8",
    );

    const audioPath = join(process.cwd(), "mock-data/audio.wav");

    const error = await Effect.runPromise(
      Effect.flip(workflow(invalidSchemaPath, audioPath, outputPath)),
    );

    expect(error._tag).toBe("ValidationError");

    await unlink(invalidSchemaPath);
  });

  it("should cleanup temp files after error", async () => {
    const deps = createLocalDeps({ requestId: crypto.randomUUID() });
    const workflow = createRenderVideoWorkflow(deps);

    const invalidScriptPath = join(testDir, "cleanup-test.json");
    await fsWriteFile(invalidScriptPath, "{ invalid }", "utf-8");

    const audioPath = join(process.cwd(), "mock-data/audio.wav");

    const error = await Effect.runPromise(
      Effect.flip(workflow(invalidScriptPath, audioPath, outputPath)),
    );

    expect(error._tag).toBeDefined();

    await unlink(invalidScriptPath);
  });

  it("should log detailed error information", async () => {
    const deps = createLocalDeps({ requestId: crypto.randomUUID() });
    const workflow = createRenderVideoWorkflow(deps);

    const nonExistentPath = join(testDir, "does-not-exist.json");
    const audioPath = join(process.cwd(), "mock-data/audio.wav");

    const error = await Effect.runPromise(
      Effect.flip(workflow(nonExistentPath, audioPath, outputPath)),
    );

    expect(error._tag).toBeDefined();
    expect(error.message).toBeDefined();
  });
});
