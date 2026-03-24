import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./infrastructure/s3", () => ({
  createS3Client: vi.fn(() => ({ send: vi.fn() })),
  downloadToFile: vi.fn(),
  uploadFromFile: vi.fn(),
}));

vi.mock("./infrastructure", () => ({
  readFile: vi.fn(),
  createTempDir: vi.fn(),
  cleanupTempDir: vi.fn(),
  createRenderVideo: vi.fn(() => vi.fn()),
  bundleComposition: vi.fn(),
}));

vi.mock("./infrastructure/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("./core/enriched-parser", () => ({
  parseEnrichedScript: vi.fn(),
}));

import { createDockerDeps, createLocalDeps } from "./deps";
import { createS3Client } from "./infrastructure/s3";
import { createLogger } from "./infrastructure/logger";
import { createRenderVideo } from "./infrastructure";
import type { RenderVideoWorkflowDeps } from "./service/video-service";

const assertDepsShape = (deps: RenderVideoWorkflowDeps) => {
  expect(deps.readFile).toBeTypeOf("function");
  expect(deps.parseEnrichedScript).toBeTypeOf("function");
  expect(deps.bundleComposition).toBeTypeOf("function");
  expect(deps.renderVideo).toBeTypeOf("function");
  expect(deps.downloadFromS3).toBeTypeOf("function");
  expect(deps.uploadToS3).toBeTypeOf("function");
  expect(deps.createTempDir).toBeTypeOf("function");
  expect(deps.cleanupTempDir).toBeTypeOf("function");
  expect(deps.logger).toBeDefined();
  expect(deps.entryPoint).toBeTypeOf("string");
};

describe("createDockerDeps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a valid RenderVideoWorkflowDeps object", () => {
    const deps = createDockerDeps({ bucket: "my-bucket", requestId: "req-123" });
    assertDepsShape(deps);
  });

  it("creates an S3 client", () => {
    createDockerDeps({ bucket: "my-bucket", requestId: "req-123" });
    expect(createS3Client).toHaveBeenCalled();
  });

  it("creates a logger with the given requestId", () => {
    createDockerDeps({ bucket: "my-bucket", requestId: "req-456" });
    expect(createLogger).toHaveBeenCalledWith("req-456");
  });

  it("creates renderVideo using the logger", () => {
    const deps = createDockerDeps({ bucket: "my-bucket", requestId: "req-789" });
    expect(createRenderVideo).toHaveBeenCalled();
    expect(deps.renderVideo).toBeDefined();
  });

  it("resolves entryPoint to a remotion/index.ts path", () => {
    const deps = createDockerDeps({ bucket: "my-bucket", requestId: "req-123" });
    expect(deps.entryPoint).toMatch(/remotion\/index\.ts$/);
  });
});

describe("createLocalDeps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a valid RenderVideoWorkflowDeps object", () => {
    const deps = createLocalDeps({ requestId: "req-local-123" });
    assertDepsShape(deps);
  });

  it("creates a logger with the given requestId", () => {
    createLocalDeps({ requestId: "req-local-456" });
    expect(createLogger).toHaveBeenCalledWith("req-local-456");
  });

  it("does not create an S3 client", () => {
    createLocalDeps({ requestId: "req-local-789" });
    expect(createS3Client).not.toHaveBeenCalled();
  });

  it("resolves entryPoint to a remotion/index.ts path", () => {
    const deps = createLocalDeps({ requestId: "req-local-123" });
    expect(deps.entryPoint).toMatch(/remotion\/index\.ts$/);
  });
});
