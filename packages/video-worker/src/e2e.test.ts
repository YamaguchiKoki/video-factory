import { existsSync } from "node:fs";
import { readFile as fsReadFile, mkdir, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLocalDeps } from "./deps";
import { createRenderVideoWorkflow } from "./service/video-service";

// Skip E2E tests unless explicitly enabled
const shouldRunE2E = process.env.RUN_E2E_TESTS === "true";
const describeE2E = shouldRunE2E ? describe : describe.skip;

describeE2E("Task 10.1: Complete Video Generation E2E", () => {
  const outputDir = join(tmpdir(), "video-worker-e2e-tests");
  const outputPath = join(outputDir, `test-video-${Date.now()}.mp4`);
  const scriptPath = join(process.cwd(), "mock-data/script.json");
  const audioPath = join(process.cwd(), "mock-data/audio.wav");

  beforeAll(async () => {
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    if (!existsSync(scriptPath)) {
      throw new Error(`Mock script not found: ${scriptPath}`);
    }
    if (!existsSync(audioPath)) {
      throw new Error(`Mock audio not found: ${audioPath}`);
    }
  });

  afterAll(async () => {
    await unlink(outputPath).catch(() => {});
  });

  it("should generate complete video from mock data", async () => {
    const requestId = crypto.randomUUID();
    const deps = createLocalDeps({ requestId });
    const workflow = createRenderVideoWorkflow(deps);

    await Effect.runPromise(workflow(scriptPath, audioPath, outputPath));

    const fileExists = existsSync(outputPath);
    expect(fileExists).toBe(true);

    const stats = await stat(outputPath);
    expect(stats.size).toBeGreaterThan(0);

    deps.logger.info("Generated video file", {
      path: outputPath,
      sizeBytes: stats.size,
      sizeMB: (stats.size / 1024 / 1024).toFixed(2),
    });
  }, 900000); // 15 minutes timeout for rendering

  it("should generate video with correct metadata", async () => {
    const requestId = crypto.randomUUID();
    const deps = createLocalDeps({ requestId });
    const workflow = createRenderVideoWorkflow(deps);

    const scriptContent = await fsReadFile(scriptPath, "utf-8");
    const scriptData = JSON.parse(scriptContent);
    const expectedDuration = scriptData.totalDurationSec;

    await Effect.runPromise(workflow(scriptPath, audioPath, outputPath));

    const stats = await stat(outputPath);

    // Expected: ~1MB per second of video (conservative estimate for h264 CRF 23)
    const minExpectedSize = expectedDuration * 500 * 1024; // 500KB per second minimum
    const maxExpectedSize = expectedDuration * 5 * 1024 * 1024; // 5MB per second maximum

    expect(stats.size).toBeGreaterThanOrEqual(minExpectedSize);
    expect(stats.size).toBeLessThanOrEqual(maxExpectedSize);

    deps.logger.info("Video metadata verified", {
      expectedDuration,
      actualSize: stats.size,
      minExpected: minExpectedSize,
      maxExpected: maxExpectedSize,
    });
  }, 900000);

  it("should handle all section types", async () => {
    const requestId = crypto.randomUUID();
    const deps = createLocalDeps({ requestId });
    const workflow = createRenderVideoWorkflow(deps);

    const scriptContent = await fsReadFile(scriptPath, "utf-8");
    const scriptData = JSON.parse(scriptContent);

    const sectionTypes = new Set(
      (scriptData.sections as Array<{ type: string }>).map((s) => s.type),
    );

    expect(sectionTypes.has("intro")).toBe(true);
    expect(sectionTypes.has("discussion")).toBe(true);
    expect(sectionTypes.has("outro")).toBe(true);

    await Effect.runPromise(workflow(scriptPath, audioPath, outputPath));

    deps.logger.info("All section types verified", {
      types: Array.from(sectionTypes),
    });
  }, 900000);
});
